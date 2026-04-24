# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker (for worker management)
- SQLite3 (optional, for CLI access)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/tangle-sg.git
cd tangle-sg/docknet/central

# Install dependencies
npm install

# Create data directory
mkdir -p data

# Set up environment
cp config.env.example config.env

# Start development server
npm run dev
```

## Project Structure

```
central/
├── app.js                 # Express application setup
├── server.js              # Server entry point
├── package.json           # Dependencies
├── config.env             # Environment variables (create this)
├── controllers/           # Route handlers
│   ├── workerController.js   # Worker management
│   ├── tangleController.js   # Tangle queries
│   ├── reportController.js   # Report generation
│   ├── peerController.js     # Peer management
│   └── errorController.js    # Error handling
├── routes/                # Route definitions
│   ├── apiRoutes.js
│   ├── tangleRoutes.js
│   ├── peerRoutes.js
│   └── reportRoutes.js
├── utils/                 # Utilities
│   ├── db.js              # Database functions
│   ├── catchAsync.js      # Async wrapper
│   └── appError.js        # Custom error class
├── sockets/               # WebSocket setup
│   └── index.js
└── data/                  # SQLite database
    └── db.sqlite3
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |

## Code Patterns

### Async Handler Wrapper

Always wrap async route handlers with `catchAsync`:

```javascript
const catchAsync = require('../utils/catchAsync');

exports.getData = catchAsync(async (req, res, next) => {
    const data = await fetchData();
    res.status(200).json({ status: 'success', data });
});
```

### Error Handling

Use `AppError` for operational errors:

```javascript
const AppError = require('../utils/appError');

if (!run) {
    return next(new AppError('Run not found', 404));
}
```

### Database Operations

Database functions return Promises:

```javascript
const { getOrCreateRun, listNodes } = require('../utils/db');

// Single record
const run = await getOrCreateRun(0);

// Multiple records
const nodes = await listNodes(0);
```

## Adding New Endpoints

### 1. Create Controller Function

**File:** `controllers/myController.js`

```javascript
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { someDbFunction } = require('../utils/db');

exports.myNewEndpoint = catchAsync(async (req, res, next) => {
    const { runId } = req.params;
    const { someParam } = req.query;
    
    const data = await someDbFunction(runId, someParam);
    
    if (!data) {
        return next(new AppError('Data not found', 404));
    }
    
    res.status(200).json({
        status: 'success',
        data
    });
});
```

### 2. Create Route

**File:** `routes/myRoutes.js`

```javascript
const express = require('express');
const { myNewEndpoint } = require('../controllers/myController');

const router = express.Router();

router.get('/:runId/my-endpoint', myNewEndpoint);

module.exports = router;
```

### 3. Mount Route

**File:** `app.js`

```javascript
const myRoutes = require('./routes/myRoutes');

// ... other routes ...
app.use('/api/my', myRoutes);
```

## Adding Database Functions

### 1. Add to db.js

```javascript
function myNewQuery(runId, filters) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM some_table
            WHERE run_id = ? AND filter = ?
        `, [runId, filters], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}
```

### 2. Export in module.exports

```javascript
module.exports = {
    // ... existing exports ...
    myNewQuery
};
```

## Testing

### Manual Testing with curl

```bash
# Start workers
curl "http://localhost:8000/api/workers/start?node_count=3&tx_count=10&tx_delay=100&max_peers=2"

# List runs
curl http://localhost:8000/api/tangle/runs

# Get report
curl http://localhost:8000/api/report/0

# Delete run
curl -X DELETE http://localhost:8000/api/tangle/runs/0
```

### Database Inspection

```bash
# Connect to SQLite
sqlite3 central/data/db.sqlite3

# List tables
.tables

# Describe schema
.schema runs

# Query data
SELECT * FROM runs;
SELECT * FROM nodes WHERE run_id = 1;

# Exit
.quit
```

## Debugging

### Enable Debug Logging

Add to `config.env`:

```env
DEBUG=*
```

Or specific modules:

```env
DEBUG=express:*
```

### VS Code Configuration

**.vscode/launch.json:**

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Debug Central",
            "skipFiles": ["<node_internals>/**"],
            "program": "${workspaceFolder}/docknet/central/server.js",
            "envFile": "${workspaceFolder}/docknet/central/config.env"
        }
    ]
}
```

## Common Issues

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
PORT=8001 npm run dev
```

### Database Locked

SQLite may lock during concurrent writes. Solutions:

1. Use WAL mode (enabled by default in SQLite3)
2. Implement connection pooling
3. Add retry logic for busy errors

### Docker Socket Permission Denied

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in
# Or use newgrp
newgrp docker
```

## Code Style

### ESLint Configuration

**.eslintrc.json:**

```json
{
    "extends": ["eslint:recommended"],
    "env": {
        "node": true,
        "es2021": true
    },
    "parserOptions": {
        "ecmaVersion": 12
    },
    "rules": {
        "no-unused-vars": "warn",
        "no-console": "off"
    }
}
```

### Prettier Configuration

**.prettierrc:**

```json
{
    "semi": true,
    "singleQuote": true,
    "tabWidth": 4,
    "trailingComma": "es5"
}
```

## Contributing

### Git Workflow

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

### Commit Messages

```
feat: add new report endpoint
fix: correct node comparison logic
docs: update API documentation
refactor: simplify database queries
test: add unit tests for controllers
```

## API Versioning

Current API is unversioned. For future versions:

```javascript
// Version in URL
app.use('/api/v1/tangle', tangleRoutes);

// Version in header
const version = req.headers['api-version'];
```

## Performance Optimization

### Database Optimization

1. **Indexes**: Ensure indexes exist for frequently queried columns
2. **Batch Inserts**: Use transactions for bulk inserts
3. **Query Limits**: Always use LIMIT for large tables

### Caching

Consider adding Redis for:
- Report caching
- Session storage
- Pub/sub for multi-instance deployments

### Compression

Already enabled via `compression` middleware:

```javascript
app.use(compression());
```

## Security Checklist

- [ ] Input validation on all endpoints
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers (Helmet)
- [ ] No sensitive data in logs
- [ ] Environment variables for secrets
- [ ] Docker socket mounted read-only

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Health check endpoint responding
- [ ] Logs streaming to monitoring
- [ ] Backup strategy for data volume
- [ ] SSL/TLS configured (production)
