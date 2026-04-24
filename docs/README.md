# DockNet Central Backend Documentation

## Table of Contents

1. [Overview](./overview.md) - Architecture and design principles
2. [API Reference](./api/README.md) - REST API endpoints
3. [Database Schema](./database.md) - SQLite schema and tables
4. [WebSocket Events](./websocket.md) - Real-time events
5. [Configuration](./configuration.md) - Environment variables and setup
6. [Docker Setup](./docker.md) - Containerization guide

## Quick Start

The Central Backend is the orchestration and data collection hub for Tangle-SG simulations. It provides:

- **Worker Management**: Start/stop Docker containers for simulation nodes
- **Data Collection**: Store tangle transactions, peers, and metrics
- **Analysis**: Generate consistency reports and compare node states
- **Real-time Updates**: WebSocket broadcasts for live monitoring

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Worker 1  │     │   Worker 2  │     │   Worker N  │
│  (Docker)   │     │  (Docker)   │     │  (Docker)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Central   │
                    │   Backend   │
                    │  (REST +    │
                    │  WebSocket) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   SQLite    │
                    │   Database  │
                    └─────────────┘
```

## Key Features

| Feature | Description |
|---------|-------------|
| Simulation Control | Start/stop worker containers with configurable parameters |
| Telemetry Ingestion | Receive and store tangle data, peer lists, and system metrics |
| Consistency Analysis | Detect transaction replication differences across nodes |
| Report Generation | Generate comprehensive simulation reports with statistics |
| Real-time Monitoring | WebSocket events for live dashboard updates |

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite3
- **Real-time**: Socket.io
- **Containerization**: Dockerode
