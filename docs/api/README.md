# API Reference

## Base URL

```
http://localhost:8000/api
```

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workers/start` | Start simulation workers |
| POST | `/telemetry` | Submit telemetry data |
| GET | `/tangle/runs` | List all runs |
| GET | `/tangle/runs/:runId/nodes` | List nodes for a run |
| GET | `/tangle/runs/:runId/summary` | Get run summary |
| GET | `/tangle/all` | Get all transactions |
| GET | `/tangle/:txId` | Get transaction by ID |
| GET | `/tangle/:txId/hops` | Get transaction hops |
| GET | `/tangle/compare/transactions` | Compare transactions |
| DELETE | `/tangle/runs/:runId` | Delete a run |
| GET | `/report/:runId` | Generate full report |
| GET | `/report/:runId/consistency` | Get consistency check |
| GET | `/report/:runId/compare-nodes` | Compare two nodes |

---

## Worker Management

### Start Workers

Start Docker containers for simulation nodes.

**Endpoint:** `POST /workers/start`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| node_count | integer | Yes | - | Number of worker containers |
| tx_count | integer | Yes | - | Transactions per node |
| tx_delay | integer | Yes | - | Delay between transactions (ms) |
| max_peers | integer | Yes | - | Maximum peer connections |
| pow | integer | No | 3 | Proof-of-work difficulty (1-5) |
| wait | integer | No | 300 | Wait period in seconds |
| run | integer | No | 0 | Run ID |

**Response:**

```json
{
    "message": "5 workers started",
    "runId": 0
}
```

**Example:**

```bash
curl "http://localhost:8000/api/workers/start?node_count=5&tx_count=100&tx_delay=100&max_peers=3&pow=3&run=0&wait=300"
```

---

## Telemetry

### Upload Telemetry

Submit telemetry data from a worker node.

**Endpoint:** `POST /telemetry`

**Request Body:**

```json
{
    "nodeId": "worker1",
    "nodeIP": "172.25.0.11",
    "runId": 0,
    "tangle": [
        {
            "data": {
                "transaction_id": "tx_001",
                "sender": "node_A",
                "receiver": "node_B",
                "amount": 100,
                "unit": "kWh",
                "timestamp": 1234567890,
                "parents": ["tx_parent1", "tx_parent2"]
            },
            "metadata": {
                "cumulative_weight": 10,
                "signature1": "sig1...",
                "signature2": "sig2...",
                "consensusTimestamp": 1234567900,
                "consensusDuration": 100,
                "powDuration": 50,
                "propagationDelay": 200,
                "hops": [
                    {"timestamp": 1234567890, "uid": "node_1"},
                    {"timestamp": 1234567895, "uid": "node_2"}
                ]
            }
        }
    ],
    "peers": [
        {
            "id": "peer_1",
            "address": "172.25.0.12",
            "port": 8080,
            "uri": "http://172.25.0.12:8080",
            "state": 1
        }
    ],
    "metrics": [
        {
            "ts": "2024-01-01T00:00:00Z",
            "cpu_percent": 45.2,
            "ram_total_mb": 8192,
            "ram_used_mb": 4096,
            "net_bytes_sent": 1024000,
            "net_bytes_recv": 2048000
        }
    ]
}
```

**Response:**

```json
{
    "message": "success",
    "runId": 0,
    "nodeIndex": 1,
    "originalNodeId": "worker1"
}
```

---

## Tangle Data

### List Runs

Get all simulation runs.

**Endpoint:** `GET /tangle/runs`

**Response:**

```json
{
    "status": "success",
    "data": {
        "runs": [
            {
                "id": 1,
                "run_id": 0,
                "started_at": "2024-01-01T00:00:00Z",
                "ended_at": null,
                "status": "running",
                "node_count": 5
            }
        ]
    }
}
```

### List Nodes

Get all nodes for a specific run.

**Endpoint:** `GET /tangle/runs/:runId/nodes`

**Response:**

```json
{
    "status": "success",
    "data": {
        "nodes": [
            {
                "id": 1,
                "run_id": 1,
                "node_index": 1,
                "original_node_id": "worker1",
                "node_ip": "172.25.0.11",
                "created_at": "2024-01-01T00:00:00Z"
            }
        ],
        "runId": "0"
    }
}
```

### Get Run Summary

Get aggregated summary for a run.

**Endpoint:** `GET /tangle/runs/:runId/summary`

**Response:**

```json
{
    "status": "success",
    "data": {
        "runId": 0,
        "status": "running",
        "startedAt": "2024-01-01T00:00:00Z",
        "endedAt": null,
        "nodes": 5,
        "totalTransactions": 500,
        "totalPeers": 15,
        "nodeStats": [...],
        "recentTelemetry": [...]
    }
}
```

### Get All Transactions

Get transactions from all nodes in a run.

**Endpoint:** `GET /tangle/all`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| runId | integer | No | 0 | Run ID |
| limit | integer | No | 500 | Max records |
| offset | integer | No | 0 | Pagination offset |

**Response:**

```json
{
    "status": "success",
    "data": {
        "transactions": [...],
        "total": 500,
        "nodes": 5,
        "runId": 0,
        "limit": 500,
        "offset": 0
    }
}
```

### Get Transaction by ID

Get a specific transaction with details.

**Endpoint:** `GET /tangle/:txId`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| runId | integer | No | 0 | Run ID |

**Response:**

```json
{
    "status": "success",
    "data": {
        "transaction": {
            "id": "tx_001",
            "data": {...},
            "metadata": {...},
            "_originNode": "node_1"
        },
        "nodeId": "node_1"
    }
}
```

### Get Transaction Hops

Get the propagation path of a transaction.

**Endpoint:** `GET /tangle/:txId/hops`

**Response:**

```json
{
    "status": "success",
    "data": {
        "transactionId": "tx_001",
        "hops": [
            {"timestamp": 1234567890, "nodeId": "node_1", "relativeDelay": 0},
            {"timestamp": 1234567895, "nodeId": "node_2", "relativeDelay": 5}
        ],
        "totalHops": 2,
        "propagationDelay": 200,
        "firstHop": 1234567890,
        "lastHop": 1234567895
    }
}
```

### Compare Transactions

Compare multiple transactions' propagation paths.

**Endpoint:** `GET /tangle/compare/transactions`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| ids | string | Yes | Comma-separated transaction IDs |
| runId | integer | No | Run ID (default: 0) |

**Response:**

```json
{
    "status": "success",
    "data": {
        "transactions": [...],
        "comparison": {
            "commonNodes": ["node_1", "node_2"],
            "pathLengths": [...],
            "fastestTransaction": "tx_001",
            "slowestTransaction": "tx_002",
            "averageHops": 3.5,
            "averagePropagationDelay": 150.5
        },
        "count": 2
    }
}
```

### Delete Run

Delete a run and all associated data.

**Endpoint:** `DELETE /tangle/runs/:runId`

**Response:**

```json
{
    "success": true,
    "message": "Run 0 deleted"
}
```

---

## Reports

### Generate Full Report

Generate a comprehensive analysis report for a run.

**Endpoint:** `GET /report/:runId`

**Response:**

```json
{
    "success": true,
    "data": {
        "generated_at": "2024-01-01T00:00:00Z",
        "run": {
            "id": 0,
            "started_at": "2024-01-01T00:00:00Z",
            "ended_at": null,
            "status": "running",
            "params": {
                "node_count": 5,
                "tx_count": 100,
                "tx_delay": 100,
                "max_peers": 3,
                "pow": 3,
                "wait": 300
            }
        },
        "transactions": {
            "total_unique": 500,
            "total_records": 2500,
            "avg_per_node": 100,
            "per_node": [...]
        },
        "consistency": {
            "score": 95.5,
            "fully_replicated_count": 480,
            "partially_replicated_count": 20,
            "partially_replicated": [...],
            "parent_conflicts": [],
            "signature_conflicts": [],
            "data_conflicts": [],
            "weight_differences_count": 15,
            "consensus_differences_count": 10
        },
        "consensus": {
            "reached_count": 490,
            "reached_percent": 98.0,
            "avg_duration_ms": 120,
            "distribution": [...]
        },
        "propagation": {
            "avg_delay_ms": 150,
            "avg_per_hop_ms": 50,
            "distribution": [...]
        },
        "pow": {
            "avg_duration_ms": 45,
            "distribution": [...]
        },
        "network": {
            "total_nodes": 5,
            "total_peer_records": 15,
            "avg_peers_per_node": 3,
            "peer_stats": [...]
        }
    }
}
```

### Get Consistency Check

Lightweight consistency check endpoint.

**Endpoint:** `GET /report/:runId/consistency`

**Response:**

```json
{
    "success": true,
    "data": {
        "run_id": 0,
        "total_nodes": 5,
        "total_unique_transactions": 500,
        "consistency_score": 95.5,
        "fully_replicated_count": 480,
        "partially_replicated_count": 20,
        "conflict_counts": {
            "parent": 0,
            "signature": 0,
            "data": 0
        },
        "metadata_diff_counts": {
            "weight": 15,
            "consensus": 10
        }
    }
}
```

### Compare Nodes

Compare transactions between two specific nodes.

**Endpoint:** `GET /report/:runId/compare-nodes`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| nodeA | integer | Yes | First node index |
| nodeB | integer | Yes | Second node index |

**Response:**

```json
{
    "success": true,
    "data": {
        "run_id": 0,
        "node_a": {
            "index": 1,
            "tx_count": 100
        },
        "node_b": {
            "index": 2,
            "tx_count": 98
        },
        "comparison": {
            "only_in_a": 2,
            "only_in_b": 0,
            "in_both": 98,
            "only_in_a_ids": ["tx_099", "tx_100"],
            "only_in_b_ids": []
        }
    }
}
```

---

## Error Responses

### 400 Bad Request

```json
{
    "status": "fail",
    "message": "Invalid runId"
}
```

### 404 Not Found

```json
{
    "status": "fail",
    "message": "Run 123 not found"
}
```

### 500 Internal Server Error

```json
{
    "status": "error",
    "message": "Internal server error"
}
```
