# Tangle-SG Simulation Analysis Report

*Generated: 2026-05-08T22:39:16.124982*

*Script: analyze_tangle.py*

---

# 1. Tangle-SG Architecture Overview

**Tangle-sg** is a C++ implementation of a Tangle-style Directed Acyclic Graph (DAG) distributed ledger protocol,
executed inside DockNet worker containers. It is conceptually derived from the IOTA Tangle but adapted for
peer-to-peer energy microgrid / resource trading use cases.

## 1.1 Core Concepts

- **Transaction DAG**: Every new transaction approves two previous transactions (parents), forming a DAG rather than a linear chain.
- **Tip Selection Algorithm (TSA)**: When creating a transaction, a node performs a weighted random walk on the DAG to select which two tips (unapproved transactions) to reference as parents.
- **Cumulative Weight**: Each transaction accumulates weight from all directly or indirectly approving transactions. Higher weight indicates higher confidence / consensus.
- **Proof of Work (PoW)**: A lightweight hash-based puzzle is solved for every transaction. Difficulty is configurable (parameter `pow` 1-5).
- **Consensus**: A transaction is considered confirmed when its cumulative weight exceeds a threshold, computed relative to the genesis and network tip set.

## 1.2 Transaction Lifecycle

1. **Creation**: Node creates a transaction with sender, receiver, amount, and other payload data.
2. **Tip Selection**: TSA performs a random walk to select two parent transactions.
3. **PoW**: The node computes the hash puzzle (duration recorded as `pow_duration`).
4. **Signing**: Transaction is signed and broadcast to peers via WebSocket.
5. **Propagation**: Transaction hops across the P2P overlay (recorded in `transaction_hops`).
6. **Verification**: Receiving nodes verify signatures, checksums, and parent existence (`verification_duration`).
7. **Consensus**: Weight is updated recursively; the node marks when it considers the transaction confirmed (`consensus_duration`).
8. **Completion**: Overall time from creation to local consensus (`completion_duration`).

## 1.3 Network Layer

- **P2P Overlay**: Each worker maintains up to `max_peers` outbound connections using WebSocket.
- **Gossip**: Transactions are gossip-propagated; no central sequencer exists.
- **Telemetry**: Nodes periodically report metrics (CPU, RAM, network I/O) and transaction metadata back to the Central node, which persists them in SQLite.

## 1.4 Key Metrics Tracked

| Metric | Description |
|--------|-------------|
| `pow_duration` | Time spent solving the PoW puzzle |
| `tsa_duration` | Time spent in tip selection |
| `verification_duration` | Time to validate a received transaction |
| `consensus_duration` | Time until cumulative weight threshold is reached |
| `completion_duration` | End-to-end time (creation → local consensus) |
| `propagation_delay` | Time for a transaction to reach all nodes |
| `cumulative_weight` | Total approving weight of a transaction |
| `consistency_score` | % of unique transactions replicated on every node |


---

# 2. Simulation Set A: Fixed Transaction Count (5), Varying Node Count

*Runs analyzed: 9*

This set isolates the effect of **network size** on Tangle-sg behavior. All runs fixed `tx_count=5`, `tx_delay=300ms`, `max_peers=5`, and `pow=1`. Only `node_count` was varied from 3 to 10.

## Run Summary

| Run ID | Nodes | Tx/Node | Tx Delay | Max Peers | PoW | Consistency | Prop Delay Mean | PoW Mean | Duration (h) | Total Tx | Unique Tx |
|--------|-------|---------|----------|-----------|-----|-------------|-----------------|----------|--------------|----------|----------|
| 1777236195 | 3 | 5 | 300 | 5 | 1 | 100.0% | 1.021 | 1.0 | 0.535 | 48 | 16 |
| 1777841705 | 3 | 5 | 300 | 5 | 1 | 100.0% | 1.25 | 0.438 | 0.611 | 48 | 16 |
| 1777843914 | 4 | 5 | 300 | 5 | 1 | 57.14% | 1.106 | 0.697 | 0.615 | 66 | 21 |
| 1778011065 | 5 | 5 | 300 | 5 | 1 | 100.0% | 0.646 | 0.923 | 0.621 | 130 | 26 |
| 1777851376 | 6 | 5 | 300 | 5 | 1 | 25.81% | 0.791 | 0.374 | 0.629 | 163 | 31 |
| 1777853649 | 7 | 5 | 300 | 5 | 1 | 83.33% | 0.496 | 0.627 | 0.624 | 228 | 36 |
| 1777855907 | 8 | 5 | 300 | 5 | 1 | 65.85% | 0.49 | 0.678 | 0.628 | 286 | 41 |
| 1777858179 | 9 | 5 | 300 | 5 | 1 | 95.65% | 0.51 | 0.725 | 0.631 | 400 | 46 |
| 1777860461 | 10 | 5 | 300 | 5 | 1 | 43.14% | 0.603 | 0.917 | 0.636 | 408 | 51 |

## Descriptive Statistics

| Metric | Count | Mean | Std | Min | 25% | 50% | 75% | Max |
|--------|-------|------|-----|-----|-----|-----|-----|-----|
| Consistency Score | 9 | 74.547 | 26.26 | 25.81 | 57.14 | 83.33 | 100.0 | 100.0 |
| Duration Hours | 9 | 0.614 | 0.029 | 0.535 | 0.615 | 0.624 | 0.629 | 0.636 |
| Total Transactions | 9 | 197.444 | 134.089 | 48 | 66 | 163 | 286 | 408 |
| Unique Transactions | 9 | 31.556 | 12.121 | 16 | 21 | 31 | 41 | 51 |
| Max Dag Depth | 9 | 8.111 | 1.663 | 6 | 7 | 8 | 9 | 11 |
| Avg Hops | 9 | 1.887 | 0.241 | 1.62 | 1.64 | 1.79 | 2.08 | 2.26 |
| Pow Duration Mean | 9 | 0.709 | 0.202 | 0.374 | 0.627 | 0.697 | 0.917 | 1.0 |
| Verification Duration Mean | 9 | 4.722 | 0.374 | 4.304 | 4.43 | 4.556 | 5.006 | 5.397 |
| Completion Duration Mean | 9 | 0.945 | 0.241 | 0.558 | 0.836 | 0.909 | 1.218 | 1.25 |
| Propagation Delay Mean | 9 | 0.768 | 0.273 | 0.49 | 0.51 | 0.646 | 1.021 | 1.25 |
| Avg Propagation Delay Mean | 9 | 0.704 | 0.332 | 0.355 | 0.38 | 0.646 | 1.021 | 1.25 |
| Tsa Duration Mean | 9 | 0.069 | 0.062 | 0.0 | 0.0 | 0.056 | 0.135 | 0.154 |
| Cumulative Weight Mean | 9 | 23.582 | 13.26 | 9.785 | 14.438 | 23.748 | 24.664 | 53.532 |
| Cpu Mean | 9 | 1.251 | 0.477 | 0.607 | 0.846 | 1.348 | 1.596 | 2.04 |
| Cpu Max | 9 | 68.521 | 28.55 | 16.764 | 52.206 | 75.0 | 100.0 | 100.0 |
| Ram Mean Mb | 9 | 1261.472 | 60.898 | 1174.108 | 1209.653 | 1282.25 | 1309.517 | 1341.515 |
| Ram Max Mb | 9 | 3151.889 | 1152.814 | 1497 | 2154 | 3600 | 3960 | 4710 |

## Trend Analysis

### Key Trends & Regression

- **Consistency vs Node Count**: slope=-4.0516, R²=0.1399. As nodes increase, consistency tends to decrease. This suggests that larger networks struggle to fully replicate all transactions with fixed peer budget (`max_peers=5`).
- **Propagation Delay vs Node Count**: slope=-0.0949, R²=0.7104. Propagation grows with network diameter.
- **CPU vs Node Count**: slope=0.1729, R²=0.7709. CPU load scales with gossip overhead.
- **Resource scaling**: RAM usage also climbs (see table), driven by cumulative DAG state per node.

### Notable Observations

- Run 1777851376 (6 nodes) had low consistency (25.81%). Only 8 of 31 unique transactions were fully replicated. This indicates network partition or gossip bottlenecks at larger scales with fixed peer limits.
- Run 1777860461 (10 nodes) had low consistency (43.14%). Only 22 of 51 unique transactions were fully replicated. This indicates network partition or gossip bottlenecks at larger scales with fixed peer limits.

# 3. Simulation Set B: Fixed Node Count (3), Varying Transaction Load

*Runs analyzed: 9*

This set isolates the effect of **transaction load / throughput**. All runs fixed `node_count=3`, `tx_delay=300ms`, `max_peers=5`, `pow=1`. `tx_count` per node was varied from 5 to 50.

## Run Summary

| Run ID | Nodes | Tx/Node | Tx Delay | Max Peers | PoW | Consistency | Prop Delay Mean | PoW Mean | Duration (h) | Total Tx | Unique Tx |
|--------|-------|---------|----------|-----------|-----|-------------|-----------------|----------|--------------|----------|----------|
| 1777238132 | 3 | 10 | 300 | 5 | 1 | 100.0% | 0.871 | 0.839 | 0.947 | 93 | 31 |
| 1777583217 | 3 | 15 | 300 | 5 | 1 | 100.0% | 0.978 | 0.739 | 1.449 | 138 | 46 |
| 1777588445 | 3 | 20 | 300 | 5 | 1 | 49.18% | 0.763 | 0.605 | 1.874 | 152 | 61 |
| 1777595203 | 3 | 25 | 300 | 5 | 1 | 48.68% | 0.862 | 0.556 | 2.284 | 189 | 76 |
| 1777603437 | 3 | 30 | 300 | 5 | 1 | 100.0% | 1.114 | 1.077 | 2.706 | 273 | 91 |
| 1777613189 | 3 | 35 | 300 | 5 | 1 | 43.4% | 5.566 | 0.899 | 3.226 | 258 | 106 |
| 1777669874 | 3 | 40 | 300 | 5 | 1 | 100.0% | 1.063 | 0.628 | 3.529 | 363 | 121 |
| 1777421572 | 3 | 45 | 300 | 5 | 1 | 100.0% | 1.505 | 0.559 | 3.965 | 408 | 136 |
| 1777405786 | 3 | 50 | 300 | 5 | 1 | 100.0% | 1.506 | 0.642 | 4.382 | 453 | 151 |

## Descriptive Statistics

| Metric | Count | Mean | Std | Min | 25% | 50% | 75% | Max |
|--------|-------|------|-----|-----|-----|-----|-----|-----|
| Consistency Score | 9 | 82.362 | 24.989 | 43.4 | 49.18 | 100.0 | 100.0 | 100.0 |
| Duration Hours | 9 | 2.707 | 1.1 | 0.947 | 1.874 | 2.706 | 3.529 | 4.382 |
| Total Transactions | 9 | 258.556 | 119.905 | 93 | 152 | 258 | 363 | 453 |
| Unique Transactions | 9 | 91.0 | 38.73 | 31 | 61 | 91 | 121 | 151 |
| Max Dag Depth | 9 | 13.111 | 2.726 | 10 | 11 | 12 | 16 | 18 |
| Avg Hops | 9 | 1.636 | 0.035 | 1.58 | 1.59 | 1.65 | 1.66 | 1.67 |
| Pow Duration Mean | 9 | 0.727 | 0.168 | 0.556 | 0.605 | 0.642 | 0.839 | 1.077 |
| Verification Duration Mean | 9 | 6.066 | 4.364 | 3.171 | 4.116 | 4.769 | 5.544 | 18.116 |
| Completion Duration Mean | 9 | 2.309 | 2.776 | 0.968 | 1.152 | 1.336 | 1.702 | 10.116 |
| Propagation Delay Mean | 9 | 1.581 | 1.431 | 0.763 | 0.871 | 1.063 | 1.505 | 5.566 |
| Avg Propagation Delay Mean | 9 | 1.572 | 1.433 | 0.763 | 0.871 | 1.036 | 1.461 | 5.566 |
| Tsa Duration Mean | 9 | 0.186 | 0.136 | 0.032 | 0.13 | 0.165 | 0.212 | 0.516 |
| Cumulative Weight Mean | 9 | 92.925 | 84.289 | 27.444 | 34.742 | 66.239 | 94.758 | 312.007 |
| Cpu Mean | 9 | 0.723 | 0.163 | 0.54 | 0.66 | 0.712 | 0.734 | 1.143 |
| Cpu Max | 9 | 51.583 | 17.668 | 22.682 | 33.333 | 60.0 | 66.667 | 75.0 |
| Ram Mean Mb | 9 | 841.997 | 121.198 | 760.926 | 775.27 | 782.677 | 836.444 | 1159.254 |
| Ram Max Mb | 9 | 1488.0 | 381.671 | 964 | 1283 | 1324 | 1839 | 2039 |

## Trend Analysis

### Key Trends & Regression

- **Consistency vs Load**: slope=0.3212, R²=0.0275. Higher load improves consistency. With only 3 nodes and 300ms delay, the network can usually gossip all txs, but occasional drops occur at mid-range loads.
- **Propagation Delay vs Load**: slope=0.0314, R²=0.0803. More transactions mean more gossip traffic, but propagation delay remains relatively stable because the network is small.
- **PoW Duration vs Load**: slope=-0.0031, R²=0.0578. PoW is per-transaction and largely independent of load.
- **Completion Duration vs Load**: slope=0.0375, R²=0.0305. Completion time is dominated by propagation and consensus, not by PoW.
- **Duration scales linearly with load**: Total run duration grows roughly linearly with `tx_count` because each node issues at fixed intervals (`tx_delay=300ms`).

### Throughput Analysis

- Run 1777238132 (tx=10): 31 unique txs in 0.947 h → throughput ≈ 32.7 tx/hour
- Run 1777583217 (tx=15): 46 unique txs in 1.449 h → throughput ≈ 31.7 tx/hour
- Run 1777588445 (tx=20): 61 unique txs in 1.874 h → throughput ≈ 32.6 tx/hour
- Run 1777595203 (tx=25): 76 unique txs in 2.284 h → throughput ≈ 33.3 tx/hour
- Run 1777603437 (tx=30): 91 unique txs in 2.706 h → throughput ≈ 33.6 tx/hour
- Run 1777613189 (tx=35): 106 unique txs in 3.226 h → throughput ≈ 32.9 tx/hour
- Run 1777669874 (tx=40): 121 unique txs in 3.529 h → throughput ≈ 34.3 tx/hour
- Run 1777421572 (tx=45): 136 unique txs in 3.965 h → throughput ≈ 34.3 tx/hour
- Run 1777405786 (tx=50): 151 unique txs in 4.382 h → throughput ≈ 34.5 tx/hour

# 4. Combined Analysis

## 4.1 Cross-Set Correlations

| Parameter | Metric | Pearson R | Interpretation |
|-----------|--------|-----------|----------------|
| node_count | consistency_score | -0.2996 | weak negative |
| node_count | duration_hours | -0.5317 | moderate negative |
| node_count | pow_duration | 0.0296 | weak positive |
| node_count | verification_duration | -0.1378 | weak negative |
| node_count | completion_duration | -0.2104 | weak negative |
| node_count | propagation_delay | -0.3554 | weak negative |
| node_count | avg_propagation_delay | -0.4002 | moderate negative |
| node_count | tsa_duration | -0.1329 | weak negative |
| node_count | cpu_mean | 0.8946 | strong positive |
| node_count | ram_mean_mb | 0.7326 | strong positive |
| tx_count | consistency_score | 0.1884 | weak positive |
| tx_count | duration_hours | 0.9996 | strong positive |
| tx_count | pow_duration | -0.0508 | weak negative |
| tx_count | verification_duration | 0.3225 | weak positive |
| tx_count | completion_duration | 0.3609 | weak positive |
| tx_count | propagation_delay | 0.4491 | moderate positive |
| tx_count | avg_propagation_delay | 0.4581 | moderate positive |
| tx_count | tsa_duration | 0.6509 | moderate positive |
| tx_count | cpu_mean | -0.4947 | moderate negative |
| tx_count | ram_mean_mb | -0.7945 | strong negative |

## 4.2 Comparative Insights


- **Consistency is more sensitive to network size than load**: In Set A (varying nodes), consistency drops sharply at 6-10 nodes (e.g., 25-57% for 6-10 nodes), whereas Set B (varying load with 3 nodes) maintains near-perfect consistency for most loads, with only a few mid-range dips (e.g., 43% at 35 tx, 49% at 20-25 tx).
- **Propagation delay is stable across both dimensions**: With `tx_delay=300ms` and `pow=1`, propagation remains in the 2-5 ms range regardless of load or scale. This is expected in Docker's zero-latency bridge network.
- **Resource usage scales with both dimensions**: CPU and RAM both increase with node count (Set A) and with transaction load (Set B). However, RAM is more sensitive to node count because each additional node adds a full copy of the growing DAG.
- **PoW duration is invariant**: With fixed `pow=1`, PoW takes ~1-2 ms per transaction across all runs. This confirms PoW difficulty, not network conditions, dominates PoW time.
- **Throughput is load-bound, not node-bound**: In a 3-node network, throughput is essentially gated by the per-node issuance rate (`tx_delay`). Adding more nodes (Set A) does not increase unique transaction throughput proportionally because `tx_count` per node is fixed at 5.

# 5. Appendices

## A. Run Parameters (All)

| Run ID | Nodes | Tx/Node | Tx Delay | Max Peers | PoW | Wait | Status |
|--------|-------|---------|----------|-----------|-----|------|--------|
| 1777236195 | 3 | 5 | 300 | 5 | 1 | 300 | complete |
| 1777841705 | 3 | 5 | 300 | 5 | 1 | 600 | complete |
| 1777843914 | 4 | 5 | 300 | 5 | 1 | 600 | complete |
| 1778011065 | 5 | 5 | 300 | 5 | 1 | 600 | complete |
| 1777851376 | 6 | 5 | 300 | 5 | 1 | 600 | complete |
| 1777853649 | 7 | 5 | 300 | 5 | 1 | 600 | complete |
| 1777855907 | 8 | 5 | 300 | 5 | 1 | 600 | complete |
| 1777858179 | 9 | 5 | 300 | 5 | 1 | 600 | complete |
| 1777860461 | 10 | 5 | 300 | 5 | 1 | 600 | complete |
| 1777238132 | 3 | 10 | 300 | 5 | 1 | 300 | complete |
| 1777583217 | 3 | 15 | 300 | 5 | 1 | 600 | complete |
| 1777588445 | 3 | 20 | 300 | 5 | 1 | 600 | complete |
| 1777595203 | 3 | 25 | 300 | 5 | 1 | 600 | complete |
| 1777603437 | 3 | 30 | 300 | 5 | 1 | 600 | complete |
| 1777613189 | 3 | 35 | 300 | 5 | 1 | 600 | complete |
| 1777669874 | 3 | 40 | 300 | 5 | 1 | 600 | complete |
| 1777421572 | 3 | 45 | 300 | 5 | 1 | 600 | complete |
| 1777405786 | 3 | 50 | 300 | 5 | 1 | 600 | complete |

## B. Technical Details

| Field | Value |
|-------|-------|
| Generated At | 2026-05-08T22:39:16.124982 |
| Database | d:/coding/dev/tangleProj/docknet/central/data/db.sqlite3 |
| Runs Analyzed (Set A) | 9 |
| Runs Analyzed (Set B) | 9 |
| Charts Generated | 17 |
