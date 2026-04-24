# Configuration

## Environment Variables

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_ROOT` | `central/data` | Root directory for data files |
| `SQLITE_FILE` | `${DATA_ROOT}/db.sqlite3` | SQLite database file path |

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `8000` | HTTP server port |

### Docker Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_NETWORK` | `docknet_docknet` | Docker network for workers |
| `SHARED_VOLUME` | `program-files` | Shared volume name |

## Configuration File

Create a `config.env` file in the `central/` directory:

```env
# Environment
NODE_ENV=development
PORT=8000

# Database
DATA_ROOT=./data
SQLITE_FILE=./data/db.sqlite3

# Docker
DOCKER_NETWORK=docknet_docknet
SHARED_VOLUME=program-files
```

## Environment Modes

### Development

```env
NODE_ENV=development
```

- Detailed logging enabled
- Error stack traces exposed
- CORS allows all origins
- Morgan logging in 'dev' format

### Production

```env
NODE_ENV=production
PORT=8000
```

- Minimal logging
- Generic error messages
- Strict CORS policy
- Morgan logging in 'combined' format

## Middleware Configuration

### CORS

Default configuration allows all origins in development:

```javascript
app.use(cors());
```

For production, restrict origins:

```javascript
app.use(cors({
    origin: ['https://yourdomain.com'],
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));
```

### Rate Limiting

Default configuration (100 requests per hour):

```javascript
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP'
});
```

### Body Parsing

```javascript
// JSON payloads up to 1GB (for large telemetry uploads)
app.use(express.json({ limit: "1gb" }));

// URL-encoded payloads up to 100MB
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
```

### Security Headers

Helmet.js provides default security headers:

```javascript
app.use(helmet());
```

## Database Setup

### Local Development

1. Ensure `central/data/` directory exists
2. Database file is created automatically on first run
3. Tables are initialized via `db.serialize()`

### Docker Deployment

1. Set `DATA_ROOT` environment variable
2. Mount volume for persistent storage:

```yaml
volumes:
  - ./data:/data
```

## Docker Network

Workers communicate with Central via Docker network:

```
Network: docknet_docknet
Central IP: 172.25.0.10:8000
Worker IPs: 172.25.0.11, 172.25.0.12, ...
```

Ensure the network exists:

```bash
docker network create docknet_docknet
```

## Worker Environment Variables

When starting workers, the following are passed to containers:

| Variable | Description |
|----------|-------------|
| `NODE_ID` | Worker identifier (e.g., worker1) |
| `TELEMETRY_ENDPOINT` | Central API endpoint |
| `REPO_URL` | Git repository URL |
| `REPO_BRANCH` | Git branch |
| `TX_COUNT` | Number of transactions |
| `TX_DELAY` | Transaction delay (ms) |
| `MAX_PEERS` | Maximum peers |
| `POW` | PoW difficulty |
| `RUN_ID` | Simulation run ID |
| `WAIT_PERIOD` | Wait period (seconds) |

## Logging

### Log Levels

| Level | Usage |
|-------|-------|
| `console.log` | Info messages |
| `console.error` | Errors and failures |

### Log Prefixes

| Prefix | Description |
|--------|-------------|
| `[startWorkers]` | Worker management |
| `[telemetry]` | Telemetry processing |
| `[generateReport]` | Report generation |

### Morgan Configuration

```javascript
// Development
app.use(morgan('dev'));

// Production
app.use(morgan('combined'));
```

## Health Checks

Basic health endpoint:

```
GET /
```

Response:
```
Central Node is running 🚀
```

## Troubleshooting

### Database Permission Errors

```bash
# Ensure data directory is writable
chmod 755 central/data
```

### Docker Socket Access

```bash
# Add user to docker group
sudo usermod -aG docker $USER
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### SQLite Busy Errors

The database uses default SQLite busy timeout. For high concurrency, consider:

1. Using WAL mode (enabled by default in SQLite3)
2. Implementing connection pooling
3. Using a more robust database (PostgreSQL)
