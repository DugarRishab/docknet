# Central Backend Overview

## Architecture

The Central Backend is built on a layered architecture:

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│    (REST API + WebSocket endpoints)     │
├─────────────────────────────────────────┤
│           Business Logic Layer          │
│  (Controllers: Worker, Tangle, Report)  │
├─────────────────────────────────────────┤
│           Data Access Layer             │
│       (Database utilities: db.js)       │
├─────────────────────────────────────────┤
│           Storage Layer                 │
│         (SQLite Database)               │
└─────────────────────────────────────────┘
```

## Directory Structure

```
central/
├── app.js                 # Express app configuration
├── server.js              # Server entry point
├── controllers/           # Route handlers
│   ├── workerController.js   # Worker management
│   ├── tangleController.js   # Tangle data queries
│   ├── reportController.js   # Report generation
│   ├── peerController.js     # Peer management
│   └── errorController.js    # Error handling
├── routes/                # Route definitions
│   ├── apiRoutes.js       # Legacy telemetry routes
│   ├── tangleRoutes.js    # Tangle data routes
│   ├── peerRoutes.js      # Peer routes
│   └── reportRoutes.js    # Report routes
├── utils/                 # Utilities
│   ├── db.js              # Database functions
│   ├── catchAsync.js      # Async error wrapper
│   └── appError.js        # Custom error class
├── sockets/               # WebSocket handlers
│   └── index.js           # Socket.io setup
├── data/                  # SQLite database (created at runtime)
└── uploads/               # File uploads (if any)
```

## Design Principles

### 1. Async/Await Pattern
All database operations return Promises for clean async handling:

```javascript
const run = await getOrCreateRun(runId);
const nodes = await listNodes(runId);
```

### 2. Error Handling
Centralized error handling with `catchAsync` and `AppError`:

```javascript
exports.getRunSummary = catchAsync(async (req, res, next) => {
    const summary = await getRunSummary(runId);
    if (!summary) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }
    // ...
});
```

### 3. Data Normalization
Database schema uses normalized structure with foreign keys:
- `runs` → `nodes` → `transactions`, `peers`, `metrics`
- Prevents data duplication
- Enables efficient queries

### 4. Backward Compatibility
Legacy telemetry endpoints maintained alongside new SQL schema:
- Old endpoints continue to work
- New features use relational schema

## Key Components

### Worker Controller
Manages Docker containers for simulation nodes:
- `POST /api/workers/start` - Launch workers
- `POST /api/telemetry` - Receive telemetry data
- Saves run parameters to `run_params` table

### Tangle Controller
Queries tangle data and provides analysis:
- `GET /api/tangle/runs` - List all runs
- `GET /api/tangle/runs/:runId/nodes` - List nodes
- `GET /api/tangle/all` - Get all transactions
- `DELETE /api/tangle/runs/:runId` - Delete run

### Report Controller
Generates comprehensive analysis reports:
- `GET /api/report/:runId` - Full report
- `GET /api/report/:runId/consistency` - Consistency check
- `GET /api/report/:runId/compare-nodes` - Node comparison

## Data Flow

### Simulation Start Flow

```
1. Client → POST /api/workers/start?node_count=5&tx_count=100...
2. Controller → Create Docker containers
3. Controller → Save run_params to database
4. Workers start → Connect to telemetry endpoint
5. Workers → POST /api/telemetry (periodic)
6. Controller → Save to transactions, peers, metrics tables
```

### Report Generation Flow

```
1. Client → GET /api/report/0
2. Controller → Query run with params
3. Controller → Query all transactions
4. Controller → Query nodes and peers
5. Controller → Compute consistency metrics
6. Controller → Save consistency report
7. Controller → Return comprehensive report
```

## Performance Considerations

### Database Indexes
- `idx_transactions_tx_id` - Fast transaction lookups
- `idx_transactions_node_id` - Node-based queries
- `idx_unique_tx_run` - Run-based unique transaction queries

### Batch Operations
Telemetry data is saved in batches to minimize database writes:
- Transactions with hops
- Peers
- Metrics

### Query Limits
- `getAllTransactionsByRun` defaults to 10,000 records
- Report responses limit partially replicated list to 100 items
- Node comparison limits difference lists to 50 IDs

## Security

### Input Validation
- All numeric IDs parsed with `parseInt()`
- NaN checks for invalid parameters
- Missing parameter validation

### Data Sanitization
- `express-mongo-sanitize` - NoSQL injection protection
- `xss-clean` - XSS protection
- `helmet` - Security headers

### Rate Limiting
Configurable rate limiting via `express-rate-limit`:
```javascript
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests'
});
```

## Error Responses

Standard error format:

```json
{
    "status": "fail",
    "message": "Run 123 not found"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error
