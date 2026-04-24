# Database Schema

## Overview

The Central Backend uses SQLite3 for data storage. The database is file-based and located at:

```
${DATA_ROOT}/db.sqlite3  # Docker
# or
central/data/db.sqlite3  # Local development
```

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     runs     │◄──────│    nodes     │◄──────│ transactions │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │   1:M │ id (PK)      │   1:M │ id (PK)      │
│ run_id (UQ)  │◄──────│ run_id (FK)  │◄──────│ node_id (FK) │
│ started_at   │       │ node_index   │       │ tx_id        │
│ ended_at     │       │ original_id  │       │ ...          │
│ status       │       │ node_ip      │       └──────────────┘
└──────────────┘       └──────────────┘              │
        ▲                                          │
        │                                          │
┌───────┴──────┐                          ┌───────┴──────┐
│  run_params  │                          │transaction_hops│
├──────────────┤                          ├──────────────┤
│ id (PK)      │                          │ id (PK)      │
│ run_id (FK)  │                          │ tx_id (FK)   │
│ node_count   │                          │ hop_index    │
│ tx_count     │                          │ timestamp    │
│ tx_delay     │                          │ node_id      │
│ max_peers    │                          └──────────────┘
│ pow          │
│ wait         │
└──────────────┘

┌───────────────┐      ┌───────────────┐
│  tangle_cons  │      │    peers      │
├───────────────┤      ├───────────────┤
│ id (PK)       │      │ id (PK)       │
│ run_id (FK)   │      │ node_id (FK)  │
│ total_unique  │      │ peer_node_id  │
│ fully_repl    │      │ peer_address  │
│ partial_repl  │      │ peer_port     │
│ missing_pairs │      │ peer_uri      │
│ metadata_diff │      │ state         │
│ conflict_cnt  │      └───────────────┘
│ score         │
└───────────────┘

┌───────────────┐
│    metrics    │
├───────────────┤
│ id (PK)       │
│ node_id (FK)  │
│ ts            │
│ cpu_percent   │
│ ram_total_mb  │
│ ram_used_mb   │
│ net_bytes_sent│
│ net_bytes_recv│
└───────────────┘
```

## Table Definitions

### runs

Stores simulation runs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| run_id | INTEGER | UNIQUE NOT NULL | External run identifier |
| started_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Start time |
| ended_at | DATETIME | NULL | End time |
| node_count | INTEGER | NULL | Number of nodes (legacy) |
| status | TEXT | CHECK('running','completed','failed') | Run status |

### run_params

Stores simulation parameters for each run.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| run_id | INTEGER | NOT NULL UNIQUE | FK to runs.id |
| node_count | INTEGER | NULL | Number of nodes |
| tx_count | INTEGER | NULL | Transactions per node |
| tx_delay | INTEGER | NULL | Delay between TX (ms) |
| max_peers | INTEGER | NULL | Max peer connections |
| pow | INTEGER | NULL | PoW difficulty |
| wait | INTEGER | NULL | Wait period (seconds) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation time |

### nodes

Maps sanitized node identifiers to original node IDs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| run_id | INTEGER | NOT NULL | FK to runs.id |
| node_index | INTEGER | NOT NULL | Sequential index (1, 2, 3...) |
| original_node_id | TEXT | NOT NULL | Original node identifier |
| node_ip | TEXT | NULL | Node IP address |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation time |

**Unique Constraint:** (run_id, node_index)

### transactions

Stores tangle transaction data from each node.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| node_id | INTEGER | NOT NULL | FK to nodes.id |
| transaction_id | TEXT | NOT NULL | Transaction hash/ID |
| sender | TEXT | NULL | Sender identifier |
| receiver | TEXT | NULL | Receiver identifier |
| amount | REAL | NULL | Transaction amount |
| unit | TEXT | NULL | Unit of measurement |
| price_per_unit | REAL | NULL | Price |
| currency | TEXT | NULL | Currency code |
| timestamp | INTEGER | NULL | Transaction timestamp |
| parents | TEXT | NULL | JSON array of parent TX IDs |
| cumulative_weight | INTEGER | NULL | Cumulative weight |
| signature1 | TEXT | NULL | Signature 1 |
| signature2 | TEXT | NULL | Signature 2 |
| checksum | TEXT | NULL | Checksum |
| last_updated | INTEGER | NULL | Last update timestamp |
| weight_map | TEXT | NULL | JSON array of weight map |
| consensus_timestamp | INTEGER | NULL | Consensus timestamp |
| consensus_duration | INTEGER | NULL | Time to consensus (ms) |
| verification_timestamp | INTEGER | NULL | Verification timestamp |
| verification_duration | INTEGER | NULL | Verification time (ms) |
| pow_duration | INTEGER | NULL | PoW time (ms) |
| tsa_duration | INTEGER | NULL | TSA time (ms) |
| completion_duration | INTEGER | NULL | Total completion time (ms) |
| propagation_delay | INTEGER | NULL | Propagation delay (ms) |
| avg_propagation_delay | INTEGER | NULL | Avg propagation per hop (ms) |

### transaction_hops

Stores transaction propagation path.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| transaction_id | INTEGER | NOT NULL | FK to transactions.id |
| hop_index | INTEGER | NOT NULL | Hop sequence number |
| timestamp | INTEGER | NULL | Hop timestamp |
| node_id | TEXT | NULL | Node at this hop |

**Unique Constraint:** (transaction_id, hop_index)

### peers

Stores peer connection information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| node_id | INTEGER | NOT NULL | FK to nodes.id |
| peer_node_id | TEXT | NOT NULL | Connected peer ID |
| peer_address | TEXT | NULL | Peer IP address |
| peer_port | INTEGER | NULL | Peer port |
| peer_uri | TEXT | NULL | Peer URI |
| state | INTEGER | NULL | Connection state |
| connected_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Connection time |

### metrics

Stores system metrics from nodes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| node_id | INTEGER | NOT NULL | FK to nodes.id |
| ts | TEXT | NULL | Metric timestamp |
| cpu_percent | REAL | NULL | CPU usage % |
| ram_total_mb | INTEGER | NULL | Total RAM (MB) |
| ram_used_mb | INTEGER | NULL | Used RAM (MB) |
| net_bytes_sent | INTEGER | NULL | Network bytes sent |
| net_bytes_recv | INTEGER | NULL | Network bytes received |

### unique_transactions

Tracks unique transactions across all nodes in a run.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| run_id | INTEGER | NOT NULL | FK to runs.id |
| transaction_id | TEXT | NOT NULL | Transaction ID |
| first_seen_node_id | INTEGER | NULL | FK to nodes.id |
| node_count | INTEGER | DEFAULT 1 | Nodes having this TX |
| is_consistent | INTEGER | DEFAULT 1 | Consistency flag |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation time |

**Unique Constraint:** (run_id, transaction_id)

### tangle_consistency

Stores consistency analysis results.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| run_id | INTEGER | NOT NULL UNIQUE | FK to runs.id |
| total_unique_transactions | INTEGER | NULL | Total unique TXs |
| fully_replicated_count | INTEGER | NULL | Fully replicated count |
| partially_replicated_count | INTEGER | NULL | Partially replicated count |
| missing_tx_pairs | TEXT | NULL | JSON array of missing pairs |
| metadata_diff_count | INTEGER | NULL | Metadata differences |
| conflict_count | INTEGER | NULL | Total conflicts |
| consistency_score | REAL | NULL | Score (0-100) |
| computed_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Computation time |

### telemetry (Legacy)

Original telemetry table for backward compatibility.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| node_id | TEXT | NULL | Node identifier |
| tx_id | TEXT | NULL | Transaction ID |
| tx_time_ms | INTEGER | NULL | Transaction time |
| pow_time_ms | INTEGER | NULL | PoW time |
| timestamp | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record time |

## Indexes

### Performance Indexes

```sql
-- Fast transaction lookups
CREATE INDEX idx_transactions_tx_id ON transactions(transaction_id);

-- Node-based transaction queries
CREATE INDEX idx_transactions_node_id ON transactions(node_id);

-- Run-based unique transaction queries
CREATE INDEX idx_unique_tx_run ON unique_transactions(run_id);
```

## Common Queries

### Get Run with Parameters

```sql
SELECT r.*, rp.node_count as param_node_count, rp.tx_count, rp.tx_delay,
       rp.max_peers, rp.pow, rp.wait
FROM runs r
LEFT JOIN run_params rp ON r.id = rp.run_id
WHERE r.run_id = ?;
```

### Get All Transactions for a Run

```sql
SELECT t.*, n.original_node_id, n.node_index
FROM transactions t
JOIN nodes n ON t.node_id = n.id
JOIN runs r ON n.run_id = r.id
WHERE r.run_id = ?
ORDER BY t.transaction_id, n.node_index
LIMIT ?;
```

### Get Unique Transaction Counts

```sql
SELECT DISTINCT t.transaction_id, COUNT(DISTINCT n.id) as node_count
FROM transactions t
JOIN nodes n ON t.node_id = n.id
JOIN runs r ON n.run_id = r.id
WHERE r.run_id = ?
GROUP BY t.transaction_id;
```

### Get Run Summary

```sql
SELECT 
    r.*,
    COUNT(DISTINCT n.id) as total_nodes,
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT p.id) as total_peer_records,
    COUNT(DISTINCT m.id) as total_metrics_records
FROM runs r
LEFT JOIN nodes n ON r.id = n.run_id
LEFT JOIN transactions t ON n.id = t.node_id
LEFT JOIN peers p ON n.id = p.node_id
LEFT JOIN metrics m ON n.id = m.node_id
WHERE r.run_id = ?
GROUP BY r.id;
```

### Delete Run (Cascading)

```sql
-- Delete in order to respect foreign keys
DELETE FROM transaction_hops WHERE transaction_id IN (
    SELECT t.id FROM transactions t
    JOIN nodes n ON t.node_id = n.id
    JOIN runs r ON n.run_id = r.id
    WHERE r.run_id = ?
);

DELETE FROM transactions WHERE node_id IN (
    SELECT n.id FROM nodes n
    JOIN runs r ON n.run_id = r.id
    WHERE r.run_id = ?
);

DELETE FROM peers WHERE node_id IN (...);
DELETE FROM metrics WHERE node_id IN (...);
DELETE FROM nodes WHERE run_id IN (...);
DELETE FROM run_params WHERE run_id IN (...);
DELETE FROM tangle_consistency WHERE run_id IN (...);
DELETE FROM runs WHERE run_id = ?;
```

## Data Types

### JSON Fields

Several columns store JSON data as TEXT:

- `transactions.parents` - Array of parent transaction IDs
- `transactions.weight_map` - Array of weight mappings
- `tangle_consistency.missing_tx_pairs` - Array of missing transaction records

### Timestamps

Timestamps are stored as Unix milliseconds (INTEGER) for transaction data:
- `timestamp`
- `consensus_timestamp`
- `verification_timestamp`
- `last_updated`

Other timestamps use ISO 8601 format (DATETIME):
- `started_at`
- `ended_at`
- `created_at`
- `connected_at`

## Database Functions

### Run Management

- `getOrCreateRun(runId)` - Get or create a run
- `completeRun(runId)` - Mark run as completed
- `listRuns()` - List all runs with node counts
- `getRunWithParams(runId)` - Get run with parameters

### Node Management

- `getOrCreateNode(runId, originalNodeId, nodeIp)` - Get or create a node
- `listNodes(runId)` - List all nodes for a run

### Transaction Management

- `insertTransaction(nodeId, tx)` - Insert a transaction
- `insertTransactionHop(txId, hopIndex, hop)` - Insert a hop
- `getTransactionsByRun(runId, limit, offset)` - Paginated query
- `getAllTransactionsByRun(runId, limit)` - All transactions for analysis
- `getTransactionWithHops(txId, runId)` - Get TX with propagation path
- `getUniqueTransactionIds(runId)` - Get unique TX counts

### Peer & Metric Management

- `insertPeer(nodeId, peer)` - Insert peer record
- `getPeersByRun(runId)` - Get all peers for a run
- `insertMetric(nodeId, metric)` - Insert metric record
- `getMetricsByRun(runId)` - Get all metrics for a run

### Consistency & Reports

- `insertRunParams(runId, params)` - Save simulation parameters
- `saveConsistencyReport(runId, report)` - Save consistency analysis
- `saveTelemetryBatch(runId, nodeId, nodeIp, data)` - Batch save all data
