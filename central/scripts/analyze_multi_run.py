#!/usr/bin/env python3
"""
Multi-Run Tangle Simulation Analysis Tool
Generates research-grade comparative reports for IEEE publication.

Usage:
    # By run IDs
    python analyze_multi_run.py --run-ids 1,2,3,4,5 --db ../data/db.sqlite3 --out ./reports/multi_run_1

    # By filters
    python analyze_multi_run.py --db ../data/db.sqlite3 --out ./reports/multi_run_1 \
        --min-nodes 5 --max-nodes 20 --min-tx 100 --max-tx 1000

    # With all filters
    python analyze_multi_run.py --db ../data/db.sqlite3 --out ./reports/multi_run_1 \
        --node-range 5,50 --tx-range 100,2000 --max-peers 10 --pow 3 --status complete

Features:
    - Comparative analysis across multiple simulation runs
    - Trend analysis (metrics vs parameters)
    - Statistical correlation matrices
    - Distribution comparisons (CDF, box plots)
    - Research-grade visualizations with R², p-values, confidence intervals
    - IEEE-style markdown report with numbered figures and tables
"""

import argparse
import atexit
import json
import logging
import os
import sqlite3
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, asdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import pearsonr, spearmanr, linregress
from tabulate import tabulate

# Optional: Use analyze_run.py functions if available
try:
    from analyze_run import (
        compute_statistics, 
        get_db_columns,
        setup_logging,
        _atomic_write,
        CONFIG as SINGLE_CONFIG
    )
    SINGLE_RUN_AVAILABLE = True
except ImportError:
    SINGLE_RUN_AVAILABLE = False

__version__ = "2.0.0"

# Configuration
CONFIG = {
    "chart_dpi": 300,  # Higher DPI for publication quality
    "histogram_bins": 30,
    "figure_format": "png",
    "confidence_level": 0.95,
    "colors": {
        "primary": "#2563eb",
        "secondary": "#64748b",
        "success": "#10b981",
        "warning": "#f59e0b",
        "danger": "#ef4444",
        "accent1": "#8b5cf6",
        "accent2": "#ec4899",
        "accent3": "#06b6d4",
        "grid": "#e2e8f0",
        "background": "#f8fafc",
    },
    "fonts": {
        "title": 14,
        "label": 11,
        "tick": 9,
        "annotation": 9,
    }
}

logger = logging.getLogger("analyze_multi_run")


@dataclass
class RunData:
    """Container for a single run's data."""
    run_id: int
    internal_id: int
    status: str
    started_at: Optional[str]
    ended_at: Optional[str]
    params: Dict[str, Any]
    nodes_df: pd.DataFrame
    tx_df: pd.DataFrame
    metrics_df: pd.DataFrame
    
    @property
    def duration_hours(self) -> float:
        if self.started_at and self.ended_at:
            try:
                s = datetime.fromisoformat(self.started_at.replace('Z', '+00:00'))
                e = datetime.fromisoformat(self.ended_at.replace('Z', '+00:00'))
                return (e - s).total_seconds() / 3600
            except:
                pass
        return 0.0
    
    @property
    def tx_per_node(self) -> float:
        if self.params.get('node_count'):
            return self.params.get('tx_count', 0) / self.params['node_count']
        return 0.0


def setup_logging_internal(log_dir: Optional[Path] = None, verbose: bool = False) -> None:
    """Setup logging."""
    level = logging.DEBUG if verbose else logging.INFO
    logger.setLevel(level)
    logger.handlers = []
    
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    fmt = "%(asctime)s | %(levelname)-8s | %(message)s"
    console.setFormatter(logging.Formatter(fmt, "%H:%M:%S"))
    logger.addHandler(console)
    
    if log_dir:
        log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"analyze_multi_run_{datetime.now():%Y%m%d_%H%M%S}.log"
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"))
        logger.addHandler(fh)


def get_db_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    """Return column names for a table."""
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def query_runs_by_filters(
    conn: sqlite3.Connection,
    node_range: Optional[Tuple[int, int]] = None,
    tx_range: Optional[Tuple[int, int]] = None,
    tx_delay: Optional[int] = None,
    max_peers: Optional[int] = None,
    pow_val: Optional[int] = None,
    wait: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> pd.DataFrame:
    """Query runs matching filter criteria."""
    
    query = """
        SELECT r.run_id, r.id as internal_id, r.status, r.started_at, r.ended_at,
               rp.node_count, rp.tx_count, rp.tx_delay, rp.max_peers, rp.pow, rp.wait
        FROM runs r
        LEFT JOIN run_params rp ON r.id = rp.run_id
        WHERE 1=1
    """
    params = []
    
    if node_range:
        query += " AND rp.node_count BETWEEN ? AND ?"
        params.extend(node_range)
    if tx_range:
        query += " AND rp.tx_count BETWEEN ? AND ?"
        params.extend(tx_range)
    if tx_delay is not None:
        query += " AND rp.tx_delay = ?"
        params.append(tx_delay)
    if max_peers is not None:
        query += " AND rp.max_peers = ?"
        params.append(max_peers)
    if pow_val is not None:
        query += " AND rp.pow = ?"
        params.append(pow_val)
    if wait is not None:
        query += " AND rp.wait = ?"
        params.append(wait)
    if status:
        query += " AND r.status = ?"
        params.append(status)
    if date_from:
        query += " AND r.started_at >= ?"
        params.append(date_from)
    if date_to:
        query += " AND r.started_at <= ?"
        params.append(date_to)
    
    query += " ORDER BY r.started_at DESC"
    
    return pd.read_sql_query(query, conn, params=params)


def get_run_data(conn: sqlite3.Connection, run_internal_id: int) -> RunData:
    """Load complete data for a single run."""
    # Run info
    run_info = pd.read_sql_query(
        "SELECT * FROM runs WHERE id = ?", 
        conn, 
        params=(run_internal_id,)
    ).iloc[0]
    
    # Run params
    params_df = pd.read_sql_query(
        "SELECT * FROM run_params WHERE run_id = ?",
        conn,
        params=(run_internal_id,)
    )
    params = params_df.iloc[0].to_dict() if not params_df.empty else {}
    
    # Nodes
    nodes_df = pd.read_sql_query(
        """
        SELECT n.*, 
               (SELECT COUNT(*) FROM transactions t WHERE t.node_id = n.id) as tx_count,
               (SELECT COUNT(*) FROM peers p WHERE p.node_id = n.id) as peer_count
        FROM nodes n
        WHERE n.run_id = ?
        ORDER BY n.node_index
        """,
        conn,
        params=(run_internal_id,)
    )
    
    # Transactions with metrics
    tx_df = pd.read_sql_query(
        """
        SELECT t.*, n.node_index
        FROM transactions t
        JOIN nodes n ON t.node_id = n.id
        WHERE n.run_id = ?
        """,
        conn,
        params=(run_internal_id,)
    )
    
    # Metrics
    metrics_df = pd.read_sql_query(
        """
        SELECT m.*, n.node_index
        FROM metrics m
        JOIN nodes n ON m.node_id = n.id
        WHERE n.run_id = ?
        ORDER BY m.ts
        """,
        conn,
        params=(run_internal_id,)
    )
    
    return RunData(
        run_id=int(run_info['run_id']),
        internal_id=run_internal_id,
        status=run_info['status'],
        started_at=run_info.get('started_at'),
        ended_at=run_info.get('ended_at'),
        params=params,
        nodes_df=nodes_df,
        tx_df=tx_df,
        metrics_df=metrics_df
    )


def compute_run_summary(run_data: RunData) -> Dict[str, Any]:
    """Compute summary metrics for a single run."""
    tx_df = run_data.tx_df
    nodes_df = run_data.nodes_df
    
    summary = {
        "run_id": run_data.run_id,
        "status": run_data.status,
        "node_count": len(nodes_df),
        "tx_total": len(tx_df),
        "tx_unique": len(tx_df['transaction_id'].unique()) if not tx_df.empty else 0,
        "duration_hours": run_data.duration_hours,
    }
    
    # Add params
    summary.update({k: v for k, v in run_data.params.items() if k != 'id' and k != 'run_id'})
    
    # Timing metrics
    if not tx_df.empty:
        for col in ['pow_duration', 'consensus_duration', 'verification_duration', 
                    'completion_duration', 'propagation_delay']:
            if col in tx_df.columns:
                clean = tx_df[col].dropna()
                clean = clean[clean > 0]
                if len(clean) > 0:
                    summary[f"{col}_mean"] = clean.mean()
                    summary[f"{col}_median"] = clean.median()
                    summary[f"{col}_std"] = clean.std()
    
    # Consistency (simplified for single run)
    if not tx_df.empty:
        total_nodes = len(nodes_df)
        if total_nodes > 0:
            tx_by_id = tx_df.groupby('transaction_id')
            fully_replicated = 0
            for tx_id, group in tx_by_id:
                if len(group['node_id'].unique()) == total_nodes:
                    fully_replicated += 1
            summary['consistency_score'] = (fully_replicated / len(tx_by_id)) * 100
            summary['fully_replicated_count'] = fully_replicated
            summary['partially_replicated_count'] = len(tx_by_id) - fully_replicated
    
    # Resource metrics
    if not run_data.metrics_df.empty:
        metrics_df = run_data.metrics_df
        if 'cpu_percent' in metrics_df.columns:
            summary['cpu_mean'] = metrics_df['cpu_percent'].mean()
            summary['cpu_max'] = metrics_df['cpu_percent'].max()
        if 'ram_used_mb' in metrics_df.columns:
            summary['ram_mean_mb'] = metrics_df['ram_used_mb'].mean()
            summary['ram_max_mb'] = metrics_df['ram_used_mb'].max()
    
    return summary


def compute_correlation_matrix(df: pd.DataFrame, param_cols: List[str], 
                               metric_cols: List[str]) -> pd.DataFrame:
    """Compute correlation matrix between parameters and metrics."""
    all_cols = param_cols + metric_cols
    available_cols = [c for c in all_cols if c in df.columns]
    
    if len(available_cols) < 2:
        return pd.DataFrame()
    
    corr_df = df[available_cols].corr(method='pearson')
    return corr_df


def compute_regression_stats(x: pd.Series, y: pd.Series) -> Dict[str, float]:
    """Compute linear regression with statistical significance."""
    clean_df = pd.DataFrame({'x': x, 'y': y}).dropna()
    clean_df = clean_df[(clean_df['x'] > 0) | (clean_df['x'] == 0)]  # Keep valid zeros

    if len(clean_df) < 3:
        return {'r2': 0, 'slope': 0, 'intercept': 0, 'p_value': 1, 'stderr': 0}

    # Check if all x values are identical (can't compute regression)
    if clean_df['x'].nunique() <= 1:
        return {'r2': 0, 'slope': 0, 'intercept': 0, 'p_value': 1, 'stderr': 0, 'note': 'identical_x'}

    slope, intercept, r_value, p_value, stderr = linregress(clean_df['x'], clean_df['y'])

    return {
        'r2': r_value ** 2,
        'slope': slope,
        'intercept': intercept,
        'p_value': p_value,
        'stderr': stderr,
        'r_value': r_value
    }


def create_scatter_with_trend(x: pd.Series, y: pd.Series, xlabel: str, ylabel: str,
                               title: str, output_path: Path) -> Optional[Dict]:
    """Create scatter plot with trend line and statistics."""
    clean_df = pd.DataFrame({'x': x, 'y': y}).dropna()
    if len(clean_df) < 3:
        return None
    
    fig, ax = plt.subplots(figsize=(10, 6), facecolor=CONFIG['colors']['background'])
    ax.set_facecolor(CONFIG['colors']['background'])
    
    # Scatter
    ax.scatter(clean_df['x'], clean_df['y'], alpha=0.6, s=80, 
               color=CONFIG['colors']['primary'], edgecolors='white', linewidth=0.5)
    
    # Trend line
    stats = compute_regression_stats(x, y)
    if stats['r2'] > 0:
        x_line = np.linspace(clean_df['x'].min(), clean_df['x'].max(), 100)
        y_line = stats['slope'] * x_line + stats['intercept']
        ax.plot(x_line, y_line, '--', color=CONFIG['colors']['danger'], 
                linewidth=2, label=f"Trend: y={stats['slope']:.3f}x+{stats['intercept']:.1f}")
    
    # Stats annotation
    sig_marker = "***" if stats['p_value'] < 0.001 else "**" if stats['p_value'] < 0.01 else "*" if stats['p_value'] < 0.05 else "ns"
    stats_text = f"R² = {stats['r2']:.3f}\np = {stats['p_value']:.4f} {sig_marker}"
    ax.annotate(stats_text, xy=(0.05, 0.95), xycoords='axes fraction',
                fontsize=10, verticalalignment='top',
                bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
    
    ax.set_xlabel(xlabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_ylabel(ylabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_title(title, fontsize=CONFIG['fonts']['title'], fontweight='bold', pad=15)
    ax.grid(True, alpha=0.3, linestyle='--', color=CONFIG['colors']['grid'])
    ax.legend(loc='lower right', fontsize=9)
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG['chart_dpi'], bbox_inches='tight', 
                facecolor=CONFIG['colors']['background'])
    plt.close(fig)
    
    return stats


def create_correlation_heatmap(corr_df: pd.DataFrame, title: str, output_path: Path) -> bool:
    """Create correlation heatmap."""
    if corr_df.empty or corr_df.shape[0] == 0 or corr_df.shape[1] == 0:
        return False

    # Ensure square matrix for correlation heatmap
    if corr_df.shape[0] != corr_df.shape[1]:
        logger.warning(f"Correlation matrix is not square: {corr_df.shape}")
        return False

    fig, ax = plt.subplots(figsize=(12, 10), facecolor=CONFIG['colors']['background'])
    ax.set_facecolor(CONFIG['colors']['background'])

    # Create mask for upper triangle
    mask = np.triu(np.ones_like(corr_df, dtype=bool), k=1)

    # Heatmap
    im = ax.imshow(corr_df.values, cmap='RdYlBu_r', aspect='auto', vmin=-1, vmax=1)

    # Colorbar
    cbar = ax.figure.colorbar(im, ax=ax, shrink=0.8)
    cbar.set_label('Correlation Coefficient', fontsize=CONFIG['fonts']['label'])

    # Labels
    n = corr_df.shape[0]
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xticklabels(corr_df.columns, rotation=45, ha='right', fontsize=9)
    ax.set_yticklabels(corr_df.columns, fontsize=9)

    # Annotate values
    for i in range(n):
        for j in range(n):
            if not mask[i, j]:
                text = ax.text(j, i, f'{corr_df.iloc[i, j]:.2f}',
                             ha="center", va="center", color="black" if abs(corr_df.iloc[i, j]) < 0.5 else "white",
                             fontsize=8)

    ax.set_title(title, fontsize=CONFIG['fonts']['title'], fontweight='bold', pad=15)

    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG['chart_dpi'], bbox_inches='tight',
                facecolor=CONFIG['colors']['background'])
    plt.close(fig)
    return True


def create_rectangular_heatmap(df: pd.DataFrame, title: str,
                                ylabel: str, xlabel: str,
                                output_path: Path) -> bool:
    """Create rectangular heatmap for param-metric correlations."""
    if df.empty or df.shape[0] == 0 or df.shape[1] == 0:
        return False

    fig, ax = plt.subplots(figsize=(max(10, df.shape[1] * 1.2), max(8, df.shape[0] * 0.8)),
                           facecolor=CONFIG['colors']['background'])
    ax.set_facecolor(CONFIG['colors']['background'])

    # Heatmap
    im = ax.imshow(df.values, cmap='RdYlBu_r', aspect='auto', vmin=-1, vmax=1)

    # Colorbar
    cbar = ax.figure.colorbar(im, ax=ax, shrink=0.6)
    cbar.set_label('Correlation Coefficient', fontsize=CONFIG['fonts']['label'])

    # Labels
    ax.set_xticks(range(len(df.columns)))
    ax.set_yticks(range(len(df.index)))
    ax.set_xticklabels(df.columns, rotation=45, ha='right', fontsize=9)
    ax.set_yticklabels(df.index, fontsize=9)
    ax.set_xlabel(xlabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_ylabel(ylabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')

    # Annotate values
    for i in range(len(df.index)):
        for j in range(len(df.columns)):
            val = df.iloc[i, j]
            text_color = "black" if abs(val) < 0.5 else "white"
            ax.text(j, i, f'{val:.2f}', ha="center", va="center",
                   color=text_color, fontsize=8)

    ax.set_title(title, fontsize=CONFIG['fonts']['title'], fontweight='bold', pad=15)

    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG['chart_dpi'], bbox_inches='tight',
                facecolor=CONFIG['colors']['background'])
    plt.close(fig)
    return True


def create_box_plot_comparison(df: pd.DataFrame, group_col: str, value_col: str,
                               xlabel: str, ylabel: str, title: str, 
                               output_path: Path) -> bool:
    """Create box plot comparing distributions across groups."""
    if group_col not in df.columns or value_col not in df.columns:
        return False
    
    clean_df = df[[group_col, value_col]].dropna()
    clean_df = clean_df[clean_df[value_col] > 0]
    
    if len(clean_df) < 10:
        return False
    
    groups = clean_df[group_col].unique()
    if len(groups) < 2:
        return False
    
    fig, ax = plt.subplots(figsize=(max(10, len(groups) * 0.8), 6),
                           facecolor=CONFIG['colors']['background'])
    ax.set_facecolor(CONFIG['colors']['background'])
    
    # Prepare data
    data_to_plot = [clean_df[clean_df[group_col] == g][value_col].values for g in sorted(groups)]
    labels = [str(g) for g in sorted(groups)]
    
    bp = ax.boxplot(data_to_plot, labels=labels, patch_artist=True,
                    notch=True, showmeans=True, 
                    meanprops=dict(marker='D', markerfacecolor=CONFIG['colors']['warning']))
    
    # Color boxes
    colors = plt.cm.Set3(np.linspace(0, 1, len(groups)))
    for patch, color in zip(bp['boxes'], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    
    ax.set_xlabel(xlabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_ylabel(ylabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_title(title, fontsize=CONFIG['fonts']['title'], fontweight='bold', pad=15)
    ax.grid(True, alpha=0.3, linestyle='--', axis='y', color=CONFIG['colors']['grid'])
    
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG['chart_dpi'], bbox_inches='tight',
                facecolor=CONFIG['colors']['background'])
    plt.close(fig)
    return True


def create_cdf_plot(values: pd.Series, label: str, title: str, 
                    xlabel: str, output_path: Path) -> bool:
    """Create cumulative distribution function plot."""
    clean = values.dropna()
    clean = clean[clean > 0]
    
    if len(clean) < 5:
        return False
    
    fig, ax = plt.subplots(figsize=(10, 6), facecolor=CONFIG['colors']['background'])
    ax.set_facecolor(CONFIG['colors']['background'])
    
    sorted_vals = np.sort(clean)
    yvals = np.arange(1, len(sorted_vals) + 1) / len(sorted_vals) * 100
    
    ax.plot(sorted_vals, yvals, linewidth=2.5, color=CONFIG['colors']['primary'])
    ax.fill_between(sorted_vals, yvals, alpha=0.2, color=CONFIG['colors']['primary'])
    
    # Mark percentiles
    for p in [50, 90, 95, 99]:
        idx = int(len(sorted_vals) * p / 100) - 1
        if 0 <= idx < len(sorted_vals):
            ax.axvline(sorted_vals[idx], color=CONFIG['colors']['danger'], 
                      linestyle='--', alpha=0.7, linewidth=1)
            ax.text(sorted_vals[idx], p/100 * 100, f'  P{p}', 
                   fontsize=8, color=CONFIG['colors']['danger'])
    
    ax.set_xlabel(xlabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_ylabel('Cumulative Percentage', fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_title(title, fontsize=CONFIG['fonts']['title'], fontweight='bold', pad=15)
    ax.set_ylim(0, 100)
    ax.grid(True, alpha=0.3, linestyle='--', color=CONFIG['colors']['grid'])
    
    # Stats annotation
    stats_text = f"Mean: {clean.mean():.2f}\nMedian: {clean.median():.2f}\nP95: {clean.quantile(0.95):.2f}"
    ax.annotate(stats_text, xy=(0.95, 0.05), xycoords='axes fraction',
                fontsize=9, verticalalignment='bottom', horizontalalignment='right',
                bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG['chart_dpi'], bbox_inches='tight',
                facecolor=CONFIG['colors']['background'])
    plt.close(fig)
    return True


def create_multi_line_chart(df: pd.DataFrame, x_col: str, y_col: str, group_col: str,
                            title: str, xlabel: str, ylabel: str, output_path: Path) -> bool:
    """Create multi-line chart for time-series or grouped data."""
    if df.empty or x_col not in df.columns or y_col not in df.columns:
        return False
    
    fig, ax = plt.subplots(figsize=(12, 6), facecolor=CONFIG['colors']['background'])
    ax.set_facecolor(CONFIG['colors']['background'])
    
    colors = [CONFIG['colors']['primary'], CONFIG['colors']['success'], 
              CONFIG['colors']['danger'], CONFIG['colors']['warning'],
              CONFIG['colors']['accent1'], CONFIG['colors']['accent2']]
    
    if group_col in df.columns:
        groups = df[group_col].unique()
        for i, name in enumerate(sorted(groups)):
            group_data = df[df[group_col] == name].sort_values(x_col)
            if len(group_data) > 1:
                color = colors[i % len(colors)]
                ax.plot(group_data[x_col], group_data[y_col], 
                       label=f"Run {name}", linewidth=2, color=color, alpha=0.8,
                       marker='o', markersize=4, markevery=max(1, len(group_data)//10))
        ax.legend(bbox_to_anchor=(1.02, 1), loc='upper left', fontsize=9)
    else:
        sorted_df = df.sort_values(x_col)
        ax.plot(sorted_df[x_col], sorted_df[y_col], 
               linewidth=2.5, color=CONFIG['colors']['primary'])
    
    ax.set_xlabel(xlabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_ylabel(ylabel, fontsize=CONFIG['fonts']['label'], fontweight='bold')
    ax.set_title(title, fontsize=CONFIG['fonts']['title'], fontweight='bold', pad=15)
    ax.grid(True, alpha=0.3, linestyle='--', color=CONFIG['colors']['grid'])
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=CONFIG['chart_dpi'], bbox_inches='tight',
                facecolor=CONFIG['colors']['background'])
    plt.close(fig)
    return True


def generate_multi_run_report(
    run_ids: Optional[List[int]] = None,
    db_path: str = "",
    out_dir: str = "",
    filters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Main report generation function."""
    
    logger.info(f"Starting multi-run analysis")
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    charts_dir = out_path / "charts"
    charts_dir.mkdir(exist_ok=True)
    
    # Clean old charts
    for f in charts_dir.glob("*.png"):
        f.unlink()
    
    conn = None
    charts_created = []
    sections = []
    figure_counter = 0
    table_counter = 0
    
    try:
        # Connect to DB
        logger.info(f"Connecting to database: {db_path}")
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        
        # Query runs
        if run_ids:
            logger.info(f"Loading {len(run_ids)} specified runs")
            runs_df = pd.DataFrame({'run_id': run_ids})
            # Get internal IDs
            run_id_placeholders = ','.join('?' * len(run_ids))
            internal_ids_query = f"SELECT run_id, id as internal_id FROM runs WHERE run_id IN ({run_id_placeholders})"
            runs_df = pd.read_sql_query(internal_ids_query, conn, params=run_ids)
        else:
            logger.info("Querying runs by filters")
            runs_df = query_runs_by_filters(conn, **(filters or {}))
            runs_df = runs_df.rename(columns={'internal_id': 'internal_id'})
        
        if runs_df.empty:
            raise ValueError("No runs found matching criteria")
        
        logger.info(f"Found {len(runs_df)} runs to analyze")
        
        # Load all run data
        all_run_data = []
        for _, row in runs_df.iterrows():
            try:
                run_data = get_run_data(conn, row['internal_id'])
                all_run_data.append(run_data)
                logger.debug(f"Loaded run {run_data.run_id}")
            except Exception as e:
                logger.warning(f"Failed to load run {row.get('run_id', '?')}: {e}")
        
        if not all_run_data:
            raise ValueError("No valid run data could be loaded")
        
        logger.info(f"Successfully loaded {len(all_run_data)} runs")
        
        # Compute summaries
        logger.info("Computing run summaries...")
        summaries = [compute_run_summary(rd) for rd in all_run_data]
        summary_df = pd.DataFrame(summaries)
        
        # Save raw data
        data_path = out_path / "data.json"
        with open(data_path, 'w') as f:
            json.dump({
                'summaries': summaries,
                'generated_at': datetime.now().isoformat(),
                'run_count': len(all_run_data),
            }, f, indent=2, default=str)
        logger.debug(f"Saved raw data to {data_path}")
        
        # ============== BUILD REPORT ==============
        
        # 1. Header
        sections.append("# Multi-Run Tangle Simulation Analysis Report\n")
        sections.append(f"*Generated: {datetime.now().isoformat()}*  ")
        sections.append(f"*Script Version: {__version__}*  ")
        sections.append(f"*Runs Analyzed: {len(all_run_data)}*\n")
        sections.append("---\n")
        
        # 2. Abstract
        sections.append("## Abstract\n")
        sections.append(f"This report presents a comparative analysis of **{len(all_run_data)}** tangle simulation runs. ")
        sections.append("The analysis examines how key performance metrics—consistency, propagation delay, ")
        sections.append("and computational overhead—scale with network parameters. Statistical correlations ")
        sections.append("and regression analyses are provided to quantify relationships between simulation ")
        sections.append("parameters and outcomes.\n")
        
        # 3. Methodology
        sections.append("## 1. Methodology\n")
        sections.append("### 1.1 Dataset Description\n")
        sections.append(f"A total of {len(all_run_data)} simulation runs were analyzed. ")
        sections.append("Each run represents a complete execution of the Docknet tangle simulation ")
        sections.append("with varying parameters including node count, transaction load, and network topology.\n\n")
        
        sections.append("### 1.2 Metrics Computed\n")
        sections.append("- **Consistency Score**: Percentage of transactions fully replicated across all nodes\n")
        sections.append("- **Propagation Delay**: Time for transactions to reach all nodes\n")
        sections.append("- **Consensus Duration**: Time to reach consensus per transaction\n")
        sections.append("- **PoW Duration**: Proof-of-Work computation time\n")
        sections.append("- **Resource Utilization**: CPU and memory consumption\n\n")
        
        sections.append("### 1.3 Statistical Methods\n")
        sections.append("Pearson correlation coefficients and linear regression were used to quantify ")
        sections.append("relationships between parameters and outcomes. P-values indicate statistical ")
        sections.append("significance (*p<0.05, **p<0.01, ***p<0.001). R² values represent the proportion ")
        sections.append("of variance explained by the model.\n")
        
        # 4. Run Summary Table
        table_counter += 1
        sections.append(f"\n## 2. Run Summary\n")
        sections.append(f"**Table {table_counter}.** Summary of analyzed simulation runs.\n\n")
        
        display_cols = ['run_id', 'node_count', 'tx_count', 'tx_delay', 'max_peers', 'pow', 
                       'consistency_score', 'propagation_delay_mean', 'pow_duration_mean']
        display_df = summary_df[[c for c in display_cols if c in summary_df.columns]].copy()
        display_df.columns = [c.replace('_', ' ').title() for c in display_df.columns]
        sections.append(tabulate(display_df, headers='keys', tablefmt='pipe', showindex=False, floatfmt='.2f'))
        sections.append("\n")
        
        # 5. Descriptive Statistics
        table_counter += 1
        sections.append(f"\n## 3. Descriptive Statistics\n")
        sections.append(f"**Table {table_counter}.** Descriptive statistics for key metrics across all runs.\n\n")
        
        metric_cols = [c for c in summary_df.columns if any(x in c for x in ['consistency', 'duration', 'delay', 'cpu', 'ram'])]
        if metric_cols:
            desc_stats = summary_df[metric_cols].describe().round(3)
            sections.append(tabulate(desc_stats, headers='keys', tablefmt='pipe', floatfmt='.3f'))
        sections.append("\n")
        
        # 6. Trend Analysis - Node Count
        sections.append("\n## 4. Trend Analysis\n")
        
        if 'node_count' in summary_df.columns and 'consistency_score' in summary_df.columns:
            figure_counter += 1
            sections.append(f"\n### 4.1 Consistency vs Node Count\n")
            sections.append(f"**Figure {figure_counter}.** Relationship between network size and consistency score. ")
            
            chart_path = charts_dir / "consistency_vs_nodes.png"
            stats = create_scatter_with_trend(
                summary_df['node_count'], 
                summary_df['consistency_score'],
                'Node Count',
                'Consistency Score (%)',
                'Consistency vs Network Size',
                chart_path
            )
            
            if stats:
                sig = "significant" if stats['p_value'] < 0.05 else "not significant"
                direction = "increases" if stats['slope'] > 0 else "decreases"
                sections.append(f"The regression analysis shows a {sig} trend (R²={stats['r2']:.3f}, p={stats['p_value']:.4f}) ")
                sections.append(f"where consistency {direction} with node count (slope={stats['slope']:.3f}).\n\n")
                sections.append(f"![Figure {figure_counter}](charts/consistency_vs_nodes.png)\n\n")
                charts_created.append(chart_path)
        
        # 7. Trend Analysis - Transaction Load
        if 'tx_per_node' in summary_df.columns or 'tx_count' in summary_df.columns:
            tx_col = 'tx_per_node' if 'tx_per_node' in summary_df.columns else 'tx_count'
            
            for metric, ylabel, title_suffix in [
                ('propagation_delay_mean', 'Propagation Delay (ms)', 'Propagation Delay vs Transaction Load'),
                ('consensus_duration_mean', 'Consensus Duration (ms)', 'Consensus Duration vs Transaction Load'),
                ('pow_duration_mean', 'PoW Duration (ms)', 'PoW Duration vs Transaction Load')
            ]:
                if metric in summary_df.columns:
                    figure_counter += 1
                    sections.append(f"\n### 4.{figure_counter-3}. {title_suffix}\n")
                    
                    chart_path = charts_dir / f"{metric}_vs_tx.png"
                    stats = create_scatter_with_trend(
                        summary_df[tx_col],
                        summary_df[metric],
                        'Transactions per Node' if tx_col == 'tx_per_node' else 'Transaction Count',
                        ylabel,
                        title_suffix,
                        chart_path
                    )
                    
                    if stats:
                        sig = "significant" if stats['p_value'] < 0.05 else "not significant"
                        sections.append(f"Regression analysis: R²={stats['r2']:.3f}, p={stats['p_value']:.4f} ({sig}).\n\n")
                        sections.append(f"![Figure {figure_counter}](charts/{chart_path.name})\n\n")
                        charts_created.append(chart_path)
        
        # 8. Correlation Matrix
        sections.append("\n## 5. Correlation Analysis\n")
        
        param_cols = ['node_count', 'tx_count', 'tx_delay', 'max_peers', 'pow']
        metric_cols = ['consistency_score', 'propagation_delay_mean', 'consensus_duration_mean', 
                      'pow_duration_mean', 'verification_duration_mean', 'cpu_mean', 'ram_mean_mb']
        
        corr_df = compute_correlation_matrix(summary_df, param_cols, metric_cols)
        if not corr_df.empty:
            figure_counter += 1
            sections.append(f"**Figure {figure_counter}.** Pearson correlation matrix between simulation ")
            sections.append("parameters (rows) and performance metrics (columns). ")
            sections.append("Values range from -1 (strong negative) to +1 (strong positive).\n\n")
            
            # Filter to params vs metrics
            param_available = [c for c in param_cols if c in corr_df.columns]
            metric_available = [c for c in metric_cols if c in corr_df.columns]

            if param_available and metric_available:
                corr_subset = corr_df.loc[param_available, metric_available]

                chart_path = charts_dir / "correlation_matrix.png"
                if create_rectangular_heatmap(corr_subset, "Parameter-Metric Correlations",
                                              "Parameters", "Metrics", chart_path):
                    sections.append(f"![Figure {figure_counter}](charts/correlation_matrix.png)\n\n")
                    charts_created.append(chart_path)
            
            # Key correlations table
            table_counter += 1
            sections.append(f"**Table {table_counter}.** Key statistically significant correlations (p<0.05).\n\n")
            
            key_corrs = []
            for param in param_available:
                for metric in metric_available:
                    if param != metric:
                        clean_df = summary_df[[param, metric]].dropna()
                        if len(clean_df) >= 3:
                            r, p = pearsonr(clean_df[param], clean_df[metric])
                            if p < 0.05:
                                key_corrs.append([param.replace('_', ' ').title(), 
                                                metric.replace('_', ' ').title(), 
                                                f"{r:.3f}", f"{p:.4f}"])
            
            if key_corrs:
                sections.append(tabulate(key_corrs, 
                                       headers=['Parameter', 'Metric', 'R', 'p-value'], 
                                       tablefmt='pipe'))
            sections.append("\n")
        
        # 9. Distribution Analysis
        sections.append("\n## 6. Distribution Analysis\n")
        
        # Combine all transaction data for overall distributions
        all_tx_data = []
        for run_data in all_run_data:
            if not run_data.tx_df.empty:
                df = run_data.tx_df.copy()
                df['source_run'] = run_data.run_id
                all_tx_data.append(df)
        
        if all_tx_data:
            combined_tx = pd.concat(all_tx_data, ignore_index=True)
            
            for metric, label in [
                ('propagation_delay', 'Propagation Delay (ms)'),
                ('consensus_duration', 'Consensus Duration (ms)'),
                ('pow_duration', 'PoW Duration (ms)')
            ]:
                if metric in combined_tx.columns:
                    figure_counter += 1
                    sections.append(f"\n### 6.{figure_counter-6}. {label} Distribution\n")
                    
                    chart_path = charts_dir / f"{metric}_cdf.png"
                    if create_cdf_plot(combined_tx[metric], label, f"{label} CDF", label, chart_path):
                        sections.append(f"**Figure {figure_counter}.** Cumulative distribution function ")
                        sections.append(f"for {label.lower()} across all transactions.\n\n")
                        sections.append(f"![Figure {figure_counter}](charts/{chart_path.name})\n\n")
                        charts_created.append(chart_path)
        
        # 10. Per-Run Detailed Summaries
        sections.append("\n## 7. Individual Run Summaries\n")
        sections.append("Detailed analysis for each simulation run follows.\n")
        
        for i, (run_data, summary) in enumerate(zip(all_run_data, summaries), 1):
            sections.append(f"\n### 7.{i}. Run {run_data.run_id}\n")
            
            sections.append("**Parameters:**\n")
            params_table = [[k, v] for k, v in run_data.params.items() if k not in ['id', 'run_id', 'created_at']]
            sections.append(tabulate(params_table, headers=['Parameter', 'Value'], tablefmt='pipe'))
            sections.append("\n")
            
            sections.append("**Key Metrics:**\n")
            metrics_table = [
                ['Total Nodes', summary.get('node_count', 'N/A')],
                ['Total Transactions', summary.get('tx_total', 'N/A')],
                ['Unique Transactions', summary.get('tx_unique', 'N/A')],
                ['Consistency Score', f"{summary.get('consistency_score', 0):.2f}%"],
                ['Duration (hours)', f"{summary.get('duration_hours', 0):.2f}"],
            ]
            
            if 'cpu_mean' in summary:
                metrics_table.append(['Avg CPU %', f"{summary['cpu_mean']:.2f}"])
            if 'ram_mean_mb' in summary:
                metrics_table.append(['Avg RAM (MB)', f"{summary['ram_mean_mb']:.2f}"])
            
            sections.append(tabulate(metrics_table, headers=['Metric', 'Value'], tablefmt='pipe'))
            sections.append("\n")
        
        # 11. Conclusions
        sections.append("\n## 8. Conclusions\n")
        sections.append("This analysis examined ")
        sections.append(f"**{len(all_run_data)}** simulation runs with varying network parameters. ")
        sections.append("Key findings include:\n\n")
        
        # Auto-generate conclusions based on data
        conclusions = []
        
        if 'consistency_score' in summary_df.columns:
            avg_consistency = summary_df['consistency_score'].mean()
            conclusions.append(f"- Average consistency score across all runs: **{avg_consistency:.2f}%**")
        
        if 'node_count' in summary_df.columns and 'consistency_score' in summary_df.columns:
            stats = compute_regression_stats(summary_df['node_count'], summary_df['consistency_score'])
            if stats['p_value'] < 0.05:
                relationship = "positive" if stats['slope'] > 0 else "negative"
                conclusions.append(f"- A statistically significant {relationship} relationship exists ")
                conclusions.append(f"  between node count and consistency (R²={stats['r2']:.3f})")
        
        if not conclusions:
            conclusions.append("- No statistically significant trends were identified in the analyzed dataset.")
            conclusions.append("- Further simulations with broader parameter ranges may be needed.")
        
        sections.append("\n".join(conclusions))
        sections.append("\n")
        
        # 12. Appendix
        sections.append("\n## Appendix\n")
        sections.append("### A. Run IDs Used\n")
        sections.append("```\n")
        sections.append(", ".join([str(s['run_id']) for s in summaries]))
        sections.append("\n```\n")
        
        sections.append("\n### B. Technical Details\n")
        appendix_table = [
            ['Generated At', datetime.now().isoformat()],
            ['Script Version', __version__],
            ['Database Path', db_path],
            ['Runs Analyzed', len(all_run_data)],
            ['Charts Generated', len(charts_created)],
            ['Python Version', f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"],
        ]
        sections.append(tabulate(appendix_table, headers=['Field', 'Value'], tablefmt='pipe'))
        sections.append("\n")
        
        # Write report
        report_path = out_path / "report.md"
        report_content = "\n".join(sections)
        
        # Atomic write
        temp_fd, temp_path = tempfile.mkstemp(dir=out_path, suffix=".tmp")
        try:
            with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                f.write(report_content)
            os.replace(temp_path, report_path)
        except Exception:
            os.unlink(temp_path)
            raise
        
        logger.info(f"Report written to {report_path} ({len(report_content)} chars)")
        logger.info(f"Generated {len(charts_created)} charts")
        
        return {
            "report_path": str(report_path),
            "charts_dir": str(charts_dir),
            "charts_count": len(charts_created),
            "runs_analyzed": len(all_run_data),
            "run_ids": [s['run_id'] for s in summaries],
        }
        
    except Exception as e:
        logger.error(f"Error during report generation: {e}")
        raise
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass
        try:
            plt.close('all')
        except:
            pass


def parse_range(value: str) -> Tuple[int, int]:
    """Parse 'min,max' string to tuple."""
    try:
        parts = value.split(',')
        return (int(parts[0].strip()), int(parts[1].strip()))
    except:
        raise argparse.ArgumentTypeError(f"Invalid range format: {value}. Use 'min,max'")


def main():
    parser = argparse.ArgumentParser(
        description="Generate comparative analysis across multiple tangle simulation runs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # By specific run IDs
  python analyze_multi_run.py --run-ids 1,2,3,4,5 --db ../data/db.sqlite3 --out ./reports/multi_1

  # By filters
  python analyze_multi_run.py --db ../data/db.sqlite3 --out ./reports/multi_1 \\
      --node-range 5,50 --tx-range 100,2000 --status complete

  # All filters
  python analyze_multi_run.py --db ../data/db.sqlite3 --out ./reports/multi_1 \\
      --node-range 5,50 --tx-range 100,2000 --tx-delay 100 \\
      --max-peers 10 --pow 3 --status complete \\
      --date-from 2025-01-01 --date-to 2025-12-31
        """
    )
    
    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument('--run-ids', type=str, help='Comma-separated list of run IDs')
    input_group.add_argument('--use-filters', action='store_true', help='Use filter criteria to select runs')
    
    # Required args
    parser.add_argument('--db', type=str, required=True, help='Path to SQLite database')
    parser.add_argument('--out', type=str, required=True, help='Output directory for report')
    
    # Filter args
    parser.add_argument('--node-range', type=parse_range, help='Node count range: min,max')
    parser.add_argument('--tx-range', type=parse_range, help='Transaction count range: min,max')
    parser.add_argument('--tx-delay', type=int, help='Transaction delay (ms)')
    parser.add_argument('--max-peers', type=int, help='Maximum peers per node')
    parser.add_argument('--pow', type=int, help='PoW difficulty')
    parser.add_argument('--wait', type=int, help='Wait period (ms)')
    parser.add_argument('--status', type=str, choices=['running', 'complete', 'completed', 'incomplete', 'failed'],
                       help='Run status filter')
    parser.add_argument('--date-from', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--date-to', type=str, help='End date (YYYY-MM-DD)')
    
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging_internal(log_dir=Path(args.out), verbose=args.verbose)
    logger.info(f"analyze_multi_run v{__version__} starting")
    
    # Parse run IDs or prepare filters
    run_ids = None
    filters = None
    
    if args.run_ids:
        try:
            run_ids = [int(x.strip()) for x in args.run_ids.split(',')]
            logger.info(f"Analyzing {len(run_ids)} specified runs: {run_ids}")
        except ValueError:
            logger.error("Invalid run-ids format. Use comma-separated integers.")
            sys.exit(1)
    else:
        filters = {
            'node_range': args.node_range,
            'tx_range': args.tx_range,
            'tx_delay': args.tx_delay,
            'max_peers': args.max_peers,
            'pow_val': args.pow,
            'wait': args.wait,
            'status': args.status,
            'date_from': args.date_from,
            'date_to': args.date_to,
        }
        # Remove None values
        filters = {k: v for k, v in filters.items() if v is not None}
        logger.info(f"Using filters: {filters}")
    
    try:
        result = generate_multi_run_report(
            run_ids=run_ids,
            db_path=args.db,
            out_dir=args.out,
            filters=filters
        )
        logger.info("Report generation completed successfully")
        print(json.dumps({"success": True, "result": result}))
        sys.exit(0)
    except Exception as e:
        logger.exception("Report generation failed")
        error = {"error": str(e), "type": type(e).__name__}
        sys.stderr.write(json.dumps(error))
        sys.exit(1)


if __name__ == "__main__":
    main()
