#!/usr/bin/env python3
"""
Analyze a single simulation run from Docknet SQLite DB and generate a Markdown report with charts.

Usage:
    python analyze_run.py --run-id <RUN_ID> --db <DB_PATH> --out <OUT_DIR>

Example:
    python analyze_run.py --run-id 1 --db ../data/db.sqlite3 --out ./reports/run_1
"""

import argparse
import atexit
import json
import logging
import os
import shutil
import sqlite3
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from tabulate import tabulate


__version__ = "1.0.0"

# Configuration constants
CONFIG = {
    "chart_dpi": 150,
    "histogram_bins": 25,
    "max_conflicts_display": 20,
    "truncation": {
        "tx_id": 30,
        "node_id": 20,
        "signature": 40,
        "parents": 50,
    },
    "colors": {
        "primary": "#2563eb",      # Blue
        "secondary": "#64748b",    # Slate
        "success": "#10b981",      # Emerald
        "warning": "#f59e0b",      # Amber
        "danger": "#ef4444",       # Red
        "grid": "#e2e8f0",         # Light slate
    }
}

# Global logger
logger = logging.getLogger("analyze_run")


def setup_logging(log_dir: Optional[Path] = None, verbose: bool = False) -> None:
    """Setup logging with console and optional file handlers."""
    level = logging.DEBUG if verbose else logging.INFO
    logger.setLevel(level)
    
    # Clear any existing handlers
    logger.handlers = []
    
    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    fmt = "%(asctime)s | %(levelname)-8s | %(message)s"
    datefmt = "%H:%M:%S"
    console.setFormatter(logging.Formatter(fmt, datefmt))
    logger.addHandler(console)
    
    # File handler if log_dir provided
    if log_dir:
        log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"analyze_run_{datetime.now():%Y%m%d_%H%M%S}.log"
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"))
        logger.addHandler(fh)
        logger.debug(f"Logging to: {log_file}")


def validate_inputs(run_id: int, db_path: Path, out_dir: str) -> Tuple[bool, str]:
    """Validate all inputs and return (is_valid, error_message)."""
    # Validate run_id
    if run_id < 0:
        return False, f"run_id must be non-negative, got {run_id}"
    
    # Validate DB path
    if not db_path.exists():
        return False, f"Database not found: {db_path}"
    
    if not db_path.is_file():
        return False, f"Database path is not a file: {db_path}"
    
    # Try to read a few bytes to verify it's a valid SQLite file
    try:
        with open(db_path, "rb") as f:
            header = f.read(16)
            if not header.startswith(b"SQLite format 3"):
                return False, f"File does not appear to be a valid SQLite database: {db_path}"
    except Exception as e:
        return False, f"Cannot read database file: {e}"
    
    # Validate output directory is writable
    try:
        out_path = Path(out_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        # Try writing a test file
        test_file = out_path / ".write_test"
        test_file.write_text("test")
        test_file.unlink()
    except Exception as e:
        return False, f"Output directory not writable: {e}"
    
    return True, ""


def get_db_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    """Return actual column names for a table."""
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def check_run_exists(conn: sqlite3.Connection, run_id: int) -> Optional[Dict]:
    """Return run record if exists, None otherwise."""
    cols = get_db_columns(conn, "runs")
    query = f"SELECT {', '.join(cols)} FROM runs WHERE run_id = ?"
    cur = conn.cursor()
    cur.execute(query, (run_id,))
    row = cur.fetchone()
    if not row:
        return None
    return dict(zip(cols, row))


def get_run_params(conn: sqlite3.Connection, run_internal_id: int) -> Optional[Dict]:
    """Get run_params for a run by internal id."""
    cols = get_db_columns(conn, "run_params")
    query = f"SELECT {', '.join(cols)} FROM run_params WHERE run_id = ?"
    cur = conn.cursor()
    cur.execute(query, (run_internal_id,))
    row = cur.fetchone()
    if not row:
        return None
    return dict(zip(cols, row))


def get_nodes(conn: sqlite3.Connection, run_internal_id: int) -> pd.DataFrame:
    """Get all nodes for a run."""
    query = """
        SELECT n.*,
               (SELECT COUNT(*) FROM transactions t WHERE t.node_id = n.id) as tx_count,
               (SELECT COUNT(*) FROM peers p WHERE p.node_id = n.id) as peer_count,
               CASE WHEN EXISTS (SELECT 1 FROM metrics m WHERE m.node_id = n.id LIMIT 1) THEN 1 ELSE 0 END as has_metrics
        FROM nodes n
        WHERE n.run_id = ?
        ORDER BY n.node_index
    """
    return pd.read_sql_query(query, conn, params=(run_internal_id,))


def get_transactions(conn: sqlite3.Connection, run_internal_id: int) -> pd.DataFrame:
    """Get all transactions for a run, parsing JSON fields."""
    query = """
        SELECT t.*, n.node_index, n.original_node_id as node_original_id
        FROM transactions t
        JOIN nodes n ON t.node_id = n.id
        WHERE n.run_id = ?
    """
    df = pd.read_sql_query(query, conn, params=(run_internal_id,))
    # Parse JSON columns
    if "parents" in df.columns:
        df["parents"] = df["parents"].apply(lambda x: json.loads(x) if x else [])
    if "weight_map" in df.columns:
        df["weight_map"] = df["weight_map"].apply(lambda x: json.loads(x) if x else [])
    return df


def get_transaction_hops(conn: sqlite3.Connection, run_internal_id: int) -> pd.DataFrame:
    """Get all transaction hops for a run (column name aware)."""
    cols = get_db_columns(conn, "transaction_hops")
    hop_node_col = "hop_node_id" if "hop_node_id" in cols else "node_id"
    
    select_cols = [f"th.{c}" for c in cols if c != "transaction_id"]
    select_cols_str = ", ".join(select_cols)
    
    query = f"""
        SELECT th.*, t.transaction_id as tx_id, t.node_id
        FROM transaction_hops th
        JOIN transactions t ON th.transaction_id = t.id
        JOIN nodes n ON t.node_id = n.id
        WHERE n.run_id = ?
    """
    return pd.read_sql_query(query, conn, params=(run_internal_id,))


def get_peers(conn: sqlite3.Connection, run_internal_id: int) -> pd.DataFrame:
    """Get all peers for a run."""
    query = """
        SELECT p.*, n.node_index, n.original_node_id as source_node_id
        FROM peers p
        JOIN nodes n ON p.node_id = n.id
        WHERE n.run_id = ?
    """
    return pd.read_sql_query(query, conn, params=(run_internal_id,))


def get_metrics(conn: sqlite3.Connection, run_internal_id: int) -> pd.DataFrame:
    """Get all metrics for a run."""
    query = """
        SELECT m.*, n.node_index, n.original_node_id
        FROM metrics m
        JOIN nodes n ON m.node_id = n.id
        WHERE n.run_id = ?
        ORDER BY m.ts
    """
    return pd.read_sql_query(query, conn, params=(run_internal_id,))


def compute_statistics(series: pd.Series) -> Dict[str, float]:
    """Compute mean, median, p95 for a series, ignoring NaN/None."""
    clean = series.dropna()
    clean = clean[clean != 0]  # 0 often means "not measured"
    if len(clean) == 0:
        return {"mean": 0, "median": 0, "p95": 0, "count": 0}
    return {
        "mean": round(clean.mean(), 2),
        "median": round(clean.median(), 2),
        "p95": round(clean.quantile(0.95), 2),
        "count": len(clean)
    }


def compute_consistency(df_tx: pd.DataFrame) -> Dict[str, Any]:
    """
    Compute tangle consistency across nodes.
    Ported from reportController.js:54-163
    Optimized for large datasets with vectorized operations.
    """
    if df_tx.empty:
        return {
            "score": 100,
            "fully_replicated": [],
            "partially_replicated": [],
            "parent_conflicts": [],
            "signature_conflicts": [],
            "data_conflicts": [],
            "weight_diffs": [],
            "consensus_diffs": [],
            "total_unique": 0,
            "fully_count": 0,
            "partial_count": 0,
        }
    
    # Get unique nodes (vectorized)
    node_ids = sorted(df_tx["node_index"].unique().tolist())
    node_set = set(node_ids)
    total_unique = len(df_tx["transaction_id"].unique())
    
    # Pre-compute replication status (vectorized)
    replication_counts = df_tx.groupby("transaction_id")["node_index"].nunique()
    fully_replicated = replication_counts[replication_counts == len(node_ids)].index.tolist()
    partially_replicated_ids = replication_counts[replication_counts < len(node_ids)].index.tolist()
    
    # Build partially_replicated list efficiently
    partially_replicated = []
    if partially_replicated_ids:
        partial_groups = df_tx[df_tx["transaction_id"].isin(partially_replicated_ids)].groupby("transaction_id")
        for tx_id, group in partial_groups:
            present = group["node_index"].unique().tolist()
            missing = [nid for nid in node_ids if nid not in present]
            partially_replicated.append({
                "tx_id": tx_id,
                "present_in": present,
                "missing_from": missing
            })
    
    # Only check conflicts for transactions with multiple versions (vectorized)
    multi_version_ids = replication_counts[replication_counts > 1].index.tolist()
    
    parent_conflicts = []
    signature_conflicts = []
    data_conflicts = []
    weight_diffs = []
    consensus_diffs = []
    
    if multi_version_ids:
        multi_df = df_tx[df_tx["transaction_id"].isin(multi_version_ids)]
        multi_groups = multi_df.groupby("transaction_id")
        
        for tx_id, group in multi_groups:
            # Parent conflicts (vectorized)
            if "parents" in group.columns:
                parents_set = set()
                for p in group["parents"]:
                    if p:
                        parents_set.add(json.dumps(sorted(p)))
                if len(parents_set) > 1:
                    parent_conflicts.append({
                        "tx_id": tx_id,
                        "versions": group[["node_index", "parents"]].to_dict("records")
                    })
            
            # Signature conflicts
            if "signature1" in group.columns and "signature2" in group.columns:
                sig1_unique = group["signature1"].dropna().nunique()
                sig2_unique = group["signature2"].dropna().nunique()
                if sig1_unique > 1 or sig2_unique > 1:
                    signature_conflicts.append({
                        "tx_id": tx_id,
                        "versions": group[["node_index", "signature1", "signature2"]].fillna("").to_dict("records")
                    })
            
            # Data conflicts (sender, receiver, amount) - vectorized
            if all(col in group.columns for col in ["sender", "receiver", "amount"]):
                data_tuples = set()
                for _, row in group[["sender", "receiver", "amount"]].iterrows():
                    data_tuples.add((str(row.get("sender", "")), str(row.get("receiver", "")), str(row.get("amount", ""))))
                if len(data_tuples) > 1:
                    data_conflicts.append({
                        "tx_id": tx_id,
                        "versions": group[["node_index", "sender", "receiver", "amount"]].fillna("").to_dict("records")
                    })
            
            # Weight differences
            if "cumulative_weight" in group.columns:
                weight_unique = group["cumulative_weight"].dropna().nunique()
                if weight_unique > 1:
                    weight_diffs.append({
                        "tx_id": tx_id,
                        "versions": group[["node_index", "cumulative_weight"]].dropna().to_dict("records")
                    })
            
            # Consensus timestamp differences
            if "consensus_timestamp" in group.columns:
                consensus_unique = group["consensus_timestamp"].dropna().nunique()
                if consensus_unique > 1:
                    consensus_diffs.append({
                        "tx_id": tx_id,
                        "versions": group[["node_index", "consensus_timestamp"]].dropna().to_dict("records")
                    })
    
    score = (len(fully_replicated) / total_unique * 100) if total_unique > 0 else 100
    
    return {
        "score": round(score, 2),
        "fully_replicated": fully_replicated,
        "partially_replicated": partially_replicated,
        "parent_conflicts": parent_conflicts,
        "signature_conflicts": signature_conflicts,
        "data_conflicts": data_conflicts,
        "weight_diffs": weight_diffs,
        "consensus_diffs": consensus_diffs,
        "total_unique": total_unique,
        "fully_count": len(fully_replicated),
        "partial_count": len(partially_replicated),
    }


def compute_replication_distribution(df_tx: pd.DataFrame) -> Dict[int, int]:
    """Count how many nodes have each transaction (histogram buckets)."""
    if df_tx.empty:
        return {}
    dist = df_tx.groupby("transaction_id").size().value_counts().to_dict()
    return {int(k): int(v) for k, v in sorted(dist.items())}


def create_histogram_chart(values: pd.Series, title: str, xlabel: str, ylabel: str, 
                          output_path: Path, bins: int = None) -> bool:
    """Create and save a professionally styled histogram chart."""
    clean = values.dropna()
    clean = clean[clean > 0]
    if len(clean) < 2:
        return False
    
    if bins is None:
        bins = min(CONFIG["histogram_bins"], len(clean))
    
    fig, ax = plt.subplots(figsize=(9, 5))
    
    # Professional styling
    color = CONFIG["colors"]["primary"]
    ax.hist(clean, bins=bins, color=color, edgecolor='white', alpha=0.85, linewidth=1.2)
    
    ax.set_title(title, fontsize=13, fontweight='bold', pad=15)
    ax.set_xlabel(xlabel, fontsize=10)
    ax.set_ylabel(ylabel, fontsize=10)
    ax.grid(axis='y', alpha=0.4, linestyle='--', color=CONFIG["colors"]["grid"])
    ax.set_axisbelow(True)
    
    # Add statistics text
    mean_val = clean.mean()
    median_val = clean.median()
    ax.axvline(mean_val, color=CONFIG["colors"]["danger"], linestyle='--', linewidth=2, label=f'Mean: {mean_val:.1f}')
    ax.axvline(median_val, color=CONFIG["colors"]["success"], linestyle='--', linewidth=2, label=f'Median: {median_val:.1f}')
    ax.legend(loc='upper right', fontsize=8)
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG["chart_dpi"], bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return True


def create_bar_chart(x: List, y: List, title: str, xlabel: str, ylabel: str,
                     output_path: Path, rotation: int = 45) -> bool:
    """Create and save a professionally styled bar chart."""
    if not x or not y or len(x) == 0 or len(y) == 0:
        return False
    
    fig, ax = plt.subplots(figsize=(max(9, len(x) * 0.5), 5.5))
    
    # Professional styling with gradient effect
    bars = ax.bar(range(len(x)), y, color=CONFIG["colors"]["primary"], 
                  edgecolor='white', alpha=0.85, linewidth=1.5)
    
    # Add value labels on bars
    for i, (bar, val) in enumerate(zip(bars, y)):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(val)}',
                ha='center', va='bottom', fontsize=8, fontweight='bold')
    
    ax.set_xticks(range(len(x)))
    ax.set_xticklabels([str(xi)[:15] for xi in x], rotation=rotation, ha='right')
    ax.set_title(title, fontsize=13, fontweight='bold', pad=15)
    ax.set_xlabel(xlabel, fontsize=10)
    ax.set_ylabel(ylabel, fontsize=10)
    ax.grid(axis='y', alpha=0.4, linestyle='--', color=CONFIG["colors"]["grid"])
    ax.set_axisbelow(True)
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG["chart_dpi"], bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return True


def create_pie_chart(labels: List[str], sizes: List[int], title: str, output_path: Path) -> bool:
    """Create and save a professionally styled pie chart."""
    if not sizes or all(s == 0 for s in sizes):
        return False
    
    fig, ax = plt.subplots(figsize=(7, 7))
    
    # Professional color palette
    colors = [CONFIG["colors"]["success"], CONFIG["colors"]["warning"], 
              CONFIG["colors"]["danger"], CONFIG["colors"]["primary"]]
    
    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, autopct='%1.1f%%', startangle=90,
        colors=colors[:len(sizes)], explode=[0.02] * len(sizes),
        shadow=False, textprops={'fontsize': 10}
    )
    
    # Style the percentage text
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')
        autotext.set_fontsize(11)
    
    ax.set_title(title, fontsize=13, fontweight='bold', pad=20)
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG["chart_dpi"], bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return True


def create_line_chart(df: pd.DataFrame, x_col: str, y_col: str, hue_col: str,
                      title: str, xlabel: str, ylabel: str, output_path: Path) -> bool:
    """Create a professionally styled multi-line chart grouped by hue_col."""
    if df.empty or x_col not in df.columns or y_col not in df.columns:
        return False
    
    fig, ax = plt.subplots(figsize=(11, 5.5))
    
    # Professional color palette for lines
    line_colors = [CONFIG["colors"]["primary"], CONFIG["colors"]["success"], 
                   CONFIG["colors"]["danger"], CONFIG["colors"]["warning"],
                   "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]
    
    if hue_col in df.columns:
        groups = list(df.groupby(hue_col))
        for i, (name, group) in enumerate(groups):
            color = line_colors[i % len(line_colors)]
            ax.plot(group[x_col], group[y_col], label=f"Node {name}", 
                   alpha=0.8, linewidth=1.8, color=color, marker='o', 
                   markersize=3, markevery=max(1, len(group)//20))
        ax.legend(bbox_to_anchor=(1.02, 1), loc='upper left', fontsize=9, 
                 frameon=True, fancybox=True, shadow=True)
    else:
        ax.plot(df[x_col], df[y_col], color=CONFIG["colors"]["primary"], 
               linewidth=2, marker='o', markersize=3)
    
    ax.set_title(title, fontsize=13, fontweight='bold', pad=15)
    ax.set_xlabel(xlabel, fontsize=10)
    ax.set_ylabel(ylabel, fontsize=10)
    ax.grid(alpha=0.4, linestyle='--', color=CONFIG["colors"]["grid"])
    ax.set_axisbelow(True)
    
    # Format x-axis if it's a timestamp
    if x_col == "ts":
        fig.autofmt_xdate()
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG["chart_dpi"], bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return True


def format_duration(start: Optional[str], end: Optional[str]) -> str:
    """Format duration between two timestamps."""
    if not start or not end:
        return "N/A"
    try:
        s = datetime.fromisoformat(start.replace('Z', '+00:00').replace('+00:00', ''))
        e = datetime.fromisoformat(end.replace('Z', '+00:00').replace('+00:00', ''))
        duration = e - s
        return str(duration)
    except:
        return "N/A"


def _atomic_write(filepath: Path, content: str) -> None:
    """Write content atomically using temp file and rename."""
    temp_fd, temp_path = tempfile.mkstemp(dir=filepath.parent, suffix=".tmp")
    try:
        with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
            f.write(content)
        os.replace(temp_path, filepath)
    except Exception:
        os.unlink(temp_path)
        raise


def generate_report(run_id: int, db_path: str, out_dir: str) -> Dict[str, Any]:
    """Main report generation function with logging and atomic writes."""
    logger.info(f"Starting report generation for run {run_id}")
    logger.debug(f"Database: {db_path}, Output: {out_dir}")
    
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    charts_dir = out_path / "charts"
    charts_dir.mkdir(exist_ok=True)
    
    # Clean old charts
    logger.debug("Cleaning old chart files...")
    for f in charts_dir.glob("*.png"):
        f.unlink()
    
    conn = None
    charts_created = []
    
    try:
        # Open DB (read-only)
        logger.info("Connecting to database...")
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        
        # Check run exists
        logger.info(f"Checking run {run_id} exists...")
        run = check_run_exists(conn, run_id)
        if not run:
            raise ValueError(f"Run {run_id} not found in database")
        
        run_internal_id = run["id"]
        logger.info(f"Found run (internal id: {run_internal_id}, status: {run.get('status', 'unknown')})")
        
        # Load data with progress logging
        logger.info("Loading nodes...")
        nodes_df = get_nodes(conn, run_internal_id)
        logger.info(f"Loaded {len(nodes_df)} nodes")
        
        logger.info("Loading transactions...")
        tx_df = get_transactions(conn, run_internal_id)
        logger.info(f"Loaded {len(tx_df)} transactions ({len(tx_df['transaction_id'].unique()) if not tx_df.empty else 0} unique)")
        
        logger.info("Loading transaction hops...")
        hops_df = get_transaction_hops(conn, run_internal_id)
        logger.info(f"Loaded {len(hops_df)} hops")
        
        logger.info("Loading peers...")
        peers_df = get_peers(conn, run_internal_id)
        logger.info(f"Loaded {len(peers_df)} peers")
        
        logger.info("Loading metrics...")
        metrics_df = get_metrics(conn, run_internal_id)
        logger.info(f"Loaded {len(metrics_df)} metrics records")
        
        run_params = get_run_params(conn, run_internal_id)
        if run_params:
            logger.debug(f"Run params: {run_params}")
        
        # Compute statistics
        logger.info("Computing consistency analysis...")
        consistency = compute_consistency(tx_df)
        logger.info(f"Consistency score: {consistency['score']:.2f}%")
        
        logger.info("Computing replication distribution...")
        repl_dist = compute_replication_distribution(tx_df)
        
        # Build report sections
        sections = []
        
        # 1. Header
        sections.append(f"# Tangle Simulation Report — Run {run_id}\n")
        sections.append(f"*Generated: {datetime.now().isoformat()}*\n")
        sections.append(f"*Script version: {__version__}*\n\n---\n")
        
        # 2. Run Summary
        sections.append("## Run Summary\n")
        
        summary_data = [
            ["Run ID", run_id],
            ["Status", run.get("status", "N/A")],
            ["Started", run.get("started_at", "N/A")],
            ["Ended", run.get("ended_at", "N/A")],
            ["Duration", format_duration(run.get("started_at"), run.get("ended_at"))],
        ]
        
        if run_params:
            summary_data.extend([
                ["Node Count (params)", run_params.get("node_count", "N/A")],
                ["Tx Count (params)", run_params.get("tx_count", "N/A")],
                ["Tx Delay (ms)", run_params.get("tx_delay", "N/A")],
                ["Max Peers", run_params.get("max_peers", "N/A")],
                ["PoW", run_params.get("pow", "N/A")],
                ["Wait (ms)", run_params.get("wait", "N/A")],
            ])
        
        summary_data.extend([
            ["Total Nodes (actual)", len(nodes_df)],
            ["Total Transactions", len(tx_df)],
            ["Unique Transactions", len(tx_df["transaction_id"].unique()) if not tx_df.empty else 0],
            ["Total Hops", len(hops_df)],
            ["Total Peers", len(peers_df)],
            ["Metrics Records", len(metrics_df)],
        ])
        
        sections.append(tabulate(summary_data, headers=["Metric", "Value"], tablefmt="pipe"))
        sections.append("\n")
        
        # 3. Node Overview
        if not nodes_df.empty:
            logger.info("Generating node overview section...")
            sections.append("## Node Overview\n")
            
            node_table = nodes_df[["node_index", "original_node_id", "tx_count", "peer_count", "has_metrics"]].copy()
            trunc = CONFIG["truncation"]["node_id"]
            node_table["original_node_id"] = node_table["original_node_id"].str[:trunc] + "..."
            node_table.columns = ["Index", "Node ID", "Tx Count", "Peer Count", "Has Metrics"]
            sections.append(tabulate(node_table, headers="keys", tablefmt="pipe", showindex=False))
            sections.append("\n")
            
            # Chart: tx per node
            logger.debug("Creating tx_per_node chart...")
            chart_path = charts_dir / "tx_per_node.png"
            if create_bar_chart(
                nodes_df["node_index"].tolist(),
                nodes_df["tx_count"].tolist(),
                "Transactions per Node",
                "Node Index",
                "Transaction Count",
                chart_path,
                rotation=0
            ):
                sections.append(f"![Transactions per Node](charts/tx_per_node.png)\n\n")
                charts_created.append(chart_path)
        
        # 4. Transaction Timing Statistics
        if not tx_df.empty:
            logger.info("Generating timing statistics...")
            sections.append("## Transaction Timing Statistics\n")
            
            timing_cols = [
                ("pow_duration", "PoW Duration (ms)"),
                ("consensus_duration", "Consensus Duration (ms)"),
                ("verification_duration", "Verification Duration (ms)"),
                ("completion_duration", "Completion Duration (ms)"),
                ("propagation_delay", "Propagation Delay (ms)"),
                ("avg_propagation_delay", "Avg Propagation per Hop (ms)"),
            ]
            
            timing_data = []
            for col, label in timing_cols:
                if col in tx_df.columns:
                    stats = compute_statistics(tx_df[col])
                    timing_data.append([
                        label,
                        stats["count"],
                        stats["mean"],
                        stats["median"],
                        stats["p95"]
                    ])
                    
                    # Create histogram
                    if stats["count"] > 0:
                        chart_path = charts_dir / f"{col}_distribution.png"
                        if create_histogram_chart(
                            tx_df[col],
                            f"{label} Distribution",
                            label,
                            "Count",
                            chart_path
                        ):
                            sections.append(f"![{label} Distribution](charts/{col}_distribution.png)\n\n")
                            charts_created.append(chart_path)
            
            if timing_data:
                sections.append(tabulate(
                    timing_data,
                    headers=["Metric", "Count", "Mean", "Median", "P95"],
                    tablefmt="pipe"
                ))
                sections.append("\n")
        
        # 5. Consistency Analysis
        logger.info("Generating consistency analysis section...")
        sections.append("## Consistency Analysis\n")
        
        consistency_data = [
            ["Consistency Score", f"{consistency['score']:.2f}%"],
            ["Fully Replicated Tx", consistency["fully_count"]],
            ["Partially Replicated Tx", consistency["partial_count"]],
            ["Total Unique Tx", consistency["total_unique"]],
            ["Parent Conflicts", len(consistency["parent_conflicts"])],
            ["Signature Conflicts", len(consistency["signature_conflicts"])],
            ["Data Conflicts", len(consistency["data_conflicts"])],
            ["Weight Differences", len(consistency["weight_diffs"])],
            ["Consensus Differences", len(consistency["consensus_diffs"])],
        ]
        
        sections.append(tabulate(consistency_data, headers=["Metric", "Value"], tablefmt="pipe"))
        sections.append("\n")
        
        # Consistency pie chart
        if consistency["total_unique"] > 0:
            logger.debug("Creating consistency pie chart...")
            chart_path = charts_dir / "consistency_pie.png"
            if create_pie_chart(
                ["Fully Replicated", "Partially Replicated"],
                [consistency["fully_count"], consistency["partial_count"]],
                "Transaction Replication Status",
                chart_path
            ):
                sections.append(f"![Consistency](charts/consistency_pie.png)\n\n")
                charts_created.append(chart_path)
        
        # Replication distribution histogram
        if repl_dist:
            sections.append("### Replication Distribution\n")
            sections.append("How many nodes have each transaction:\n\n")
            
            repl_table = [[f"{k} nodes", v] for k, v in repl_dist.items()]
            sections.append(tabulate(repl_table, headers=["Node Count", "Transactions"], tablefmt="pipe"))
            sections.append("\n")
            
            logger.debug("Creating replication histogram...")
            chart_path = charts_dir / "replication_histogram.png"
            if create_bar_chart(
                [str(k) for k in repl_dist.keys()],
                list(repl_dist.values()),
                "Transaction Replication Distribution",
                "Number of Nodes",
                "Transaction Count",
                chart_path,
                rotation=0
            ):
                sections.append(f"![Replication Distribution](charts/replication_histogram.png)\n\n")
                charts_created.append(chart_path)
        
        # 6. Conflict Details
        max_conflicts = CONFIG["max_conflicts_display"]
        trunc_tx = CONFIG["truncation"]["tx_id"]
        
        if consistency["parent_conflicts"]:
            logger.info(f"Documenting {len(consistency['parent_conflicts'])} parent conflicts...")
            sections.append(f"### Parent Conflicts (first {max_conflicts})\n")
            for conflict in consistency["parent_conflicts"][:max_conflicts]:
                sections.append(f"**{conflict['tx_id'][:trunc_tx]}...**\n\n")
                trunc_p = CONFIG["truncation"]["parents"]
                versions_table = [[v["node_index"], str(v.get("parents", []))[:trunc_p]] for v in conflict["versions"]]
                sections.append(tabulate(versions_table, headers=["Node", "Parents"], tablefmt="pipe"))
                sections.append("\n")
        
        if consistency["signature_conflicts"]:
            logger.info(f"Documenting {len(consistency['signature_conflicts'])} signature conflicts...")
            sections.append(f"### Signature Conflicts (first {max_conflicts})\n")
            trunc_sig = CONFIG["truncation"]["signature"]
            for conflict in consistency["signature_conflicts"][:max_conflicts]:
                sections.append(f"**{conflict['tx_id'][:trunc_tx]}...**\n\n")
                versions_table = [
                    [v["node_index"], str(v.get("signature1", ""))[:trunc_sig], str(v.get("signature2", ""))[:trunc_sig]]
                    for v in conflict["versions"]
                ]
                sections.append(tabulate(versions_table, headers=["Node", "Signature 1", "Signature 2"], tablefmt="pipe"))
                sections.append("\n")
        
        if consistency["data_conflicts"]:
            logger.info(f"Documenting {len(consistency['data_conflicts'])} data conflicts...")
            sections.append(f"### Data Conflicts (first {max_conflicts})\n")
            for conflict in consistency["data_conflicts"][:max_conflicts]:
                sections.append(f"**{conflict['tx_id'][:trunc_tx]}...**\n\n")
                versions_table = [
                    [v["node_index"], v.get("sender", "N/A"), v.get("receiver", "N/A"), v.get("amount", "N/A")]
                    for v in conflict["versions"]
                ]
                sections.append(tabulate(versions_table, headers=["Node", "Sender", "Receiver", "Amount"], tablefmt="pipe"))
                sections.append("\n")
        
        # 7. Peer Topology
        if not peers_df.empty:
            logger.info("Generating peer topology section...")
            sections.append("## Peer Topology\n")
            
            peer_stats = peers_df.groupby("node_index").size().reset_index(name="peer_count")
            isolated = peer_stats[peer_stats["peer_count"] == 0]
            
            topology_data = [
                ["Total Peer Connections", len(peers_df)],
                ["Avg Peers per Node", round(peers_df.groupby("node_index").size().mean(), 2)],
                ["Isolated Nodes", len(isolated)],
            ]
            
            if "state" in peers_df.columns:
                state_counts = peers_df["state"].value_counts().to_dict()
                for state, count in state_counts.items():
                    topology_data.append([f"Peers in state {state}", count])
            
            sections.append(tabulate(topology_data, headers=["Metric", "Value"], tablefmt="pipe"))
            sections.append("\n")
            
            logger.debug("Creating peers_per_node chart...")
            chart_path = charts_dir / "peers_per_node.png"
            if create_bar_chart(
                peer_stats["node_index"].tolist(),
                peer_stats["peer_count"].tolist(),
                "Peers per Node",
                "Node Index",
                "Peer Count",
                chart_path,
                rotation=0
            ):
                sections.append(f"![Peers per Node](charts/peers_per_node.png)\n\n")
                charts_created.append(chart_path)
        
        # 8. Resource Metrics
        if not metrics_df.empty:
            logger.info("Generating resource metrics section...")
            sections.append("## Resource Metrics\n")
            
            sections.append(f"Total metric records: {len(metrics_df)}\n\n")
            
            # CPU chart
            if "cpu_percent" in metrics_df.columns:
                logger.debug("Creating CPU chart...")
                chart_path = charts_dir / "cpu_over_time.png"
                if create_line_chart(
                    metrics_df,
                    "ts",
                    "cpu_percent",
                    "node_index",
                    "CPU % Over Time",
                    "Time",
                    "CPU %",
                    chart_path
                ):
                    sections.append(f"![CPU Over Time](charts/cpu_over_time.png)\n\n")
                    charts_created.append(chart_path)
            
            # RAM chart
            if "ram_used_mb" in metrics_df.columns:
                logger.debug("Creating RAM chart...")
                chart_path = charts_dir / "ram_over_time.png"
                if create_line_chart(
                    metrics_df,
                    "ts",
                    "ram_used_mb",
                    "node_index",
                    "RAM Usage Over Time (MB)",
                    "Time",
                    "RAM Used (MB)",
                    chart_path
                ):
                    sections.append(f"![RAM Over Time](charts/ram_over_time.png)\n\n")
                    charts_created.append(chart_path)
            
            # RAM stats table
            if all(col in metrics_df.columns for col in ["ram_total_mb", "ram_used_mb"]):
                ram_stats = metrics_df.groupby("node_index").agg({
                    "ram_used_mb": ["mean", "max"],
                    "ram_total_mb": "first"
                }).reset_index()
                ram_stats.columns = ["Node", "Avg RAM Used (MB)", "Max RAM Used (MB)", "Total RAM (MB)"]
                sections.append("### RAM Statistics per Node\n")
                sections.append(tabulate(ram_stats, headers="keys", tablefmt="pipe", showindex=False))
                sections.append("\n")
        
        # 9. Appendix
        sections.append("## Appendix\n")
        appendix_data = [
            ["Generated At", datetime.now().isoformat()],
            ["Script Version", __version__],
            ["Database Path", db_path],
            ["Run ID", run_id],
            ["Internal Run ID", run_internal_id],
            ["Charts Created", len(charts_created)],
        ]
        sections.append(tabulate(appendix_data, headers=["Field", "Value"], tablefmt="pipe"))
        sections.append("\n")
        
        # Write report atomically
        report_path = out_path / "report.md"
        report_content = "\n".join(sections)
        
        logger.info(f"Writing report to {report_path}...")
        _atomic_write(report_path, report_content)
        logger.info(f"Report written successfully ({len(report_content)} chars)")
        
        return {
            "report_path": str(report_path),
            "charts_dir": str(charts_dir),
            "charts_count": len(charts_created),
            "run_id": run_id,
        }
        
    except Exception as e:
        logger.error(f"Error during report generation: {e}")
        raise
    finally:
        # Ensure resources are cleaned up
        if conn:
            try:
                conn.close()
                logger.debug("Database connection closed")
            except Exception as e:
                logger.warning(f"Error closing database connection: {e}")
        
        # Clean up any remaining matplotlib figures
        try:
            plt.close('all')
            logger.debug("Matplotlib figures cleaned up")
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(
        description="Generate analysis report for a simulation run from SQLite DB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python analyze_run.py --run-id 1 --db ../data/db.sqlite3 --out ./reports/run_1
  python analyze_run.py --run-id 0 --db ./data/db.sqlite3 --out /tmp/report --verbose
        """
    )
    parser.add_argument(
        "--run-id",
        type=int,
        required=True,
        help="Run ID to analyze (non-negative integer)"
    )
    parser.add_argument(
        "--db",
        type=str,
        default="../data/db.sqlite3",
        help="Path to SQLite database file (default: ../data/db.sqlite3)"
    )
    parser.add_argument(
        "--out",
        type=str,
        required=True,
        help="Output directory for report and charts"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging (DEBUG level)"
    )
    
    args = parser.parse_args()
    
    # Setup logging first
    setup_logging(log_dir=Path(args.out), verbose=args.verbose)
    logger.info(f"analyze_run v{__version__} starting")
    
    # Resolve DB path
    db_path = Path(args.db)
    if not db_path.is_absolute():
        script_dir = Path(__file__).parent
        db_path = (script_dir / db_path).resolve()
    
    # Validate inputs
    is_valid, error_msg = validate_inputs(args.run_id, db_path, args.out)
    if not is_valid:
        logger.error(f"Validation failed: {error_msg}")
        error = {"error": error_msg, "type": "validation_error"}
        sys.stderr.write(json.dumps(error))
        sys.exit(1)
    
    logger.info("Input validation passed")
    
    try:
        result = generate_report(args.run_id, str(db_path), args.out)
        logger.info(f"Report generation completed: {result['charts_count']} charts created")
        print(json.dumps({"success": True, "result": result}))
        sys.exit(0)
    except ValueError as e:
        logger.error(f"Report generation failed: {e}")
        error = {"error": str(e), "type": "value_error"}
        sys.stderr.write(json.dumps(error))
        sys.exit(2)
    except Exception as e:
        import traceback
        logger.exception("Unexpected error during report generation")
        error = {
            "error": str(e),
            "type": "unexpected_error",
            "trace": traceback.format_exc()
        }
        sys.stderr.write(json.dumps(error))
        sys.exit(3)


if __name__ == "__main__":
    main()
