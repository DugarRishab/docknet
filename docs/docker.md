# Docker Setup

## Overview

The Central Backend is designed to run in a Docker container with access to the Docker socket for worker orchestration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Host                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Central Container                                   │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  Node.js App                                  │  │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │  │   │
│  │  │  │Express  │  │Socket.io│  │ Dockerode    │  │  │   │
│  │  │  │ (Port   │  │ (WS)    │  │ (Socket      │  │  │   │
│  │  │  │  8000)  │  │         │  │  access)     │  │  │   │
│  │  │  └─────────┘  └─────────┘  └──────────────┘  │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │  Volumes:                                           │   │
│  │  - /var/run/docker.sock (read)                      │   │
│  │  - data/ (read/write)                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Worker 1    │  │ Worker 2    │  │ Worker N    │          │
│  │ Container   │  │ Container   │  │ Container   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Dockerfile

**File:** `central/Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /data

# Environment
ENV NODE_ENV=production
ENV PORT=8000
ENV DATA_ROOT=/data

# Expose port
EXPOSE 8000

# Start application
CMD ["node", "server.js"]
```

## Docker Compose

**File:** `docknet/docker-compose.yaml`

```yaml
version: '3.8'

services:
  central:
    build:
      context: ./central
      dockerfile: Dockerfile
    container_name: docknet-central
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - DATA_ROOT=/data
      - SQLITE_FILE=/data/db.sqlite3
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - program-files:/app/program:ro
    networks:
      docknet:
        ipv4_address: 172.25.0.10
    restart: unless-stopped

  worker-template:
    # Workers are created dynamically by Central
    # This is a reference configuration
    image: docknet/worker:latest
    environment:
      - TELEMETRY_ENDPOINT=http://172.25.0.10:8000/api/telemetry
    networks:
      - docknet

volumes:
  program-files:
    driver: local

networks:
  docknet:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

## Building the Image

### Development Build

```bash
cd docknet/central
docker build -t docknet/central:dev .
```

### Production Build

```bash
cd docknet/central
docker build -t docknet/central:latest .
```

## Running the Container

### Using Docker Compose (Recommended)

```bash
cd docknet
docker-compose up -d
```

### Using Docker Run

```bash
docker run -d \
  --name docknet-central \
  -p 8000:8000 \
  -v $(pwd)/data:/data \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e NODE_ENV=production \
  docknet/central:latest
```

## Volume Mounts

### Required Mounts

| Host Path | Container Path | Mode | Purpose |
|-----------|----------------|------|---------|
| `./data` | `/data` | rw | Database storage |
| `/var/run/docker.sock` | `/var/run/docker.sock` | ro | Docker API access |
| `program-files` | `/app/program` | ro | Shared program files |

### Data Persistence

The SQLite database is stored in the mounted data volume:

```
Host: ./data/db.sqlite3
Container: /data/db.sqlite3
```

## Network Configuration

### Docker Network

Create the network before starting:

```bash
docker network create \
  --driver bridge \
  --subnet 172.25.0.0/16 \
  docknet_docknet
```

### IP Address Allocation

| Container | IP Address | Purpose |
|-----------|------------|---------|
| Central | 172.25.0.10 | API endpoint |
| Worker 1 | 172.25.0.11 | Node 1 |
| Worker 2 | 172.25.0.12 | Node 2 |
| Worker N | 172.25.0.N | Node N |

## Security Considerations

### Docker Socket Access

Granting access to the Docker socket allows the container to:
- Create containers
- Remove containers
- List containers
- Access container logs

**Security Best Practices:**

1. Mount socket as read-only (`:ro`)
2. Use dedicated service account
3. Limit container capabilities
4. Monitor container activity

### Read-Only Mounts

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
  - program-files:/app/program:ro
```

### Resource Limits

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 256M
```

## Environment-Specific Configurations

### Development

```yaml
services:
  central:
    build:
      context: ./central
      dockerfile: Dockerfile
    volumes:
      - ./central:/app          # Live code reload
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - NODE_ENV=development
    command: npm run dev       # Use nodemon
```

### Production

```yaml
services:
  central:
    image: docknet/central:latest
    volumes:
      - /opt/docknet/data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - NODE_ENV=production
    restart: always
    deploy:
      replicas: 1
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

## Health Checks

Add health check to Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1
```

Or in docker-compose:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 5s
```

## Logging

### View Logs

```bash
# Follow logs
docker logs -f docknet-central

# Last 100 lines
docker logs --tail 100 docknet-central

# With timestamps
docker logs -t docknet-central
```

### Log Driver

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs docknet-central

# Verify environment variables
docker inspect docknet-central | grep -A 20 Env

# Check port binding
docker port docknet-central
```

### Database Permission Errors

```bash
# Fix data directory permissions
sudo chown -R 1000:1000 ./data

# Or use named volume
docker volume create docknet-data
docker run -v docknet-data:/data ...
```

### Docker Socket Not Accessible

```bash
# Check socket permissions
ls -la /var/run/docker.sock

# Add user to docker group
sudo usermod -aG docker $USER
```

### Workers Not Connecting

```bash
# Verify network
docker network inspect docknet_docknet

# Check Central is accessible
docker exec docknet-central wget -qO- http://localhost:8000/
```

## Multi-Stage Build

Optimized Dockerfile for smaller production image:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/src ./src
EXPOSE 8000
CMD ["node", "server.js"]
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build image
        run: |
          docker build -t docknet/central:${{ github.sha }} ./central
          docker tag docknet/central:${{ github.sha }} docknet/central:latest
      
      - name: Push to registry
        run: |
          docker push docknet/central:${{ github.sha }}
          docker push docknet/central:latest
```

## Scaling Considerations

The Central Backend is designed for single-instance deployment due to SQLite limitations. For horizontal scaling, consider:

1. **PostgreSQL**: Replace SQLite with PostgreSQL
2. **Redis**: Use Redis for pub/sub instead of Socket.io rooms
3. **Load Balancer**: Add load balancer with sticky sessions
4. **Shared Storage**: Use network file system for data volume
