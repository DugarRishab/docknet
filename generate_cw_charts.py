import sqlite3
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

DB_PATH = 'd:/coding/dev/tangleProj/docknet/central/data/db.sqlite3'
OUTPUT_DIR = 'd:/coding/dev/tangleProj/docknet/central/data/reports/combined_analysis_2026-05-08T22-39-16.124982/charts'

def get_run_cw_data():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Get all complete runs with params
    c.execute("""
        SELECT r.run_id, rp.node_count, rp.tx_count, rp.tx_delay, rp.max_peers, rp.pow
        FROM runs r
        JOIN run_params rp ON rp.run_id = r.id
        WHERE r.status = 'complete'
        ORDER BY r.run_id
    """)
    runs = [dict(row) for row in c.fetchall()]

    results = []
    for run in runs:
        rid = run['run_id']
        # Get node count for consistency computation
        c.execute("SELECT COUNT(*) as cnt FROM nodes JOIN runs r ON nodes.run_id = r.id WHERE r.run_id = ?", (rid,))
        node_count = c.fetchone()['cnt'] or run['node_count']

        # Get all cumulative weights for this run
        c.execute("""
            SELECT t.cumulative_weight
            FROM transactions t
            JOIN nodes n ON t.node_id = n.id
            JOIN runs r ON n.run_id = r.id
            WHERE r.run_id = ? AND t.cumulative_weight IS NOT NULL
        """, (rid,))
        weights = [row['cumulative_weight'] for row in c.fetchall()]

        if weights:
            mean_cw = sum(weights) / len(weights)
            results.append({
                'run_id': rid,
                'node_count': run['node_count'],
                'tx_count': run['tx_count'],
                'mean_cw': mean_cw,
                'count': len(weights)
            })

    conn.close()
    return results

def plot_cw_series(data, x_key, xlabel, title, filename):
    fig, ax = plt.subplots(figsize=(8, 5))
    xs = [d[x_key] for d in data]
    ys = [d['mean_cw'] for d in data]

    ax.scatter(xs, ys, s=100, alpha=0.7, edgecolors='black', color='darkgreen')

    # Trend line
    if len(xs) > 1:
        z = np.polyfit(xs, ys, 1)
        p = np.poly1d(z)
        x_line = np.linspace(min(xs), max(xs), 100)
        ax.plot(x_line, p(x_line), 'r--', alpha=0.7, label=f'Trend: y={z[0]:.2f}x+{z[1]:.2f}')
        ax.legend()

    ax.set_xlabel(xlabel)
    ax.set_ylabel('Mean Cumulative Weight')
    ax.set_title(title)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, filename), dpi=150)
    plt.close(fig)
    print(f"Saved {filename}")

if __name__ == '__main__':
    data = get_run_cw_data()

    # Classify into series
    series_a = [d for d in data if d['tx_count'] == 5 and d['node_count'] >= 3]
    series_b = [d for d in data if d['node_count'] == 3 and d['tx_count'] >= 5]

    series_a.sort(key=lambda x: x['node_count'])
    series_b.sort(key=lambda x: x['tx_count'])

    if series_a:
        plot_cw_series(series_a, 'node_count', 'Node Count',
                       'Cumulative Weight vs Network Size (Series A)',
                       'vn_cumulative_weight_vs_nodes.png')
    if series_b:
        plot_cw_series(series_b, 'tx_count', 'Tx Count per Node',
                       'Cumulative Weight vs Transaction Load (Series B)',
                       'vl_cumulative_weight_vs_tx.png')
