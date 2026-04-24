# WebSocket Events

## Overview

The Central Backend provides real-time updates via Socket.io for live monitoring dashboards.

**Connection URL:**
```
ws://localhost:8000
```

## Connection

### Client Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8000');

socket.on('connect', () => {
    console.log('Connected to Central Backend');
});

socket.on('disconnect', () => {
    console.log('Disconnected from Central Backend');
});
```

## Events

### Server to Client

#### simulation:started

Broadcast when workers are started.

**Payload:**

```json
{
    "runId": 0,
    "nodeCount": 5,
    "timestamp": "2024-01-01T00:00:00Z"
}
```

**Usage:**

```javascript
socket.on('simulation:started', (data) => {
    console.log(`Simulation ${data.runId} started with ${data.nodeCount} nodes`);
});
```

#### simulation:stopped

Broadcast when a simulation ends.

**Payload:**

```json
{
    "runId": 0,
    "timestamp": "2024-01-01T00:00:00Z"
}
```

#### telemetry:received

Broadcast when telemetry data is received from a node.

**Payload:**

```json
{
    "runId": 0,
    "nodeIndex": 1,
    "nodeId": "worker1",
    "txCount": 10,
    "peerCount": 3,
    "metricsCount": 1,
    "timestamp": "2024-01-01T00:00:00Z"
}
```

**Usage:**

```javascript
socket.on('telemetry:received', (data) => {
    console.log(`Node ${data.nodeId} sent ${data.txCount} transactions`);
});
```

#### tangle:updated

Broadcast when tangle data is updated for a run.

**Payload:**

```json
{
    "runId": 0,
    "nodeIndex": 1,
    "transactionCount": 100,
    "timestamp": "2024-01-01T00:00:00Z"
}
```

#### peers:updated

Broadcast when peer data is updated.

**Payload:**

```json
{
    "runId": 0,
    "nodeIndex": 1,
    "peerCount": 3,
    "timestamp": "2024-01-01T00:00:00Z"
}
```

#### metrics:updated

Broadcast when metrics data is received.

**Payload:**

```json
{
    "runId": 0,
    "nodeIndex": 1,
    "metrics": {
        "cpu_percent": 45.2,
        "ram_used_mb": 4096,
        "net_bytes_sent": 1024000
    },
    "timestamp": "2024-01-01T00:00:00Z"
}
```

#### node:connected

Broadcast when a new node connects.

**Payload:**

```json
{
    "runId": 0,
    "nodeIndex": 1,
    "nodeId": "worker1",
    "nodeIp": "172.25.0.11",
    "timestamp": "2024-01-01T00:00:00Z"
}
```

### Client to Server

#### subscribe:run

Subscribe to updates for a specific run.

**Payload:**

```json
{
    "runId": 0
}
```

**Usage:**

```javascript
socket.emit('subscribe:run', { runId: 0 });
```

#### unsubscribe:run

Unsubscribe from run updates.

**Payload:**

```json
{
    "runId": 0
}
```

#### get:status

Request current status of all runs.

**Payload:** None

**Response Event:** `status:update`

**Response Payload:**

```json
{
    "runs": [
        {
            "runId": 0,
            "status": "running",
            "nodeCount": 5,
            "totalTransactions": 500
        }
    ]
}
```

## Implementation

### Socket Handler Setup

**File:** `central/sockets/index.js`

```javascript
const socketIO = require('socket.io');

function setupSockets(server) {
    const io = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Subscribe to run updates
        socket.on('subscribe:run', ({ runId }) => {
            socket.join(`run:${runId}`);
            console.log(`Socket ${socket.id} subscribed to run ${runId}`);
        });

        // Unsubscribe from run
        socket.on('unsubscribe:run', ({ runId }) => {
            socket.leave(`run:${runId}`);
            console.log(`Socket ${socket.id} unsubscribed from run ${runId}`);
        });

        // Request status
        socket.on('get:status', async () => {
            const runs = await listRuns();
            socket.emit('status:update', { runs });
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
}

module.exports = { setupSockets };
```

### Broadcasting from Controllers

**Worker Controller:**

```javascript
// After starting workers
io.emit('simulation:started', {
    runId: parseInt(run) || 0,
    nodeCount: parseInt(node_count),
    timestamp: new Date().toISOString()
});
```

**Telemetry Upload:**

```javascript
// After saving telemetry
io.to(`run:${runId}`).emit('telemetry:received', {
    runId,
    nodeIndex: result.node.node_index,
    nodeId: nodeId,
    txCount: data.tangle?.length || 0,
    peerCount: data.peers?.length || 0,
    metricsCount: data.metrics?.length || 0,
    timestamp: new Date().toISOString()
});
```

## Room Architecture

Rooms are organized by run ID for targeted updates:

```
Room: "run:0"
  - Client A (subscribed)
  - Client B (subscribed)

Room: "run:1"
  - Client C (subscribed)
```

### Broadcasting Patterns

**Global Broadcast:**
```javascript
io.emit('event', data);  // All clients
```

**Room Broadcast:**
```javascript
io.to(`run:${runId}`).emit('event', data);  // Subscribed clients only
```

**Socket Broadcast:**
```javascript
socket.broadcast.emit('event', data);  // All except sender
```

## Error Handling

### Connection Errors

```javascript
socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
});
```

### Reconnection

```javascript
const socket = io('http://localhost:8000', {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_failed', () => {
    console.log('Failed to reconnect');
});
```

## React Hook Example

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSimulationUpdates(runId) {
    const [status, setStatus] = useState(null);
    const [telemetry, setTelemetry] = useState(null);

    useEffect(() => {
        const socket = io('http://localhost:8000');

        socket.on('connect', () => {
            socket.emit('subscribe:run', { runId });
        });

        socket.on('telemetry:received', (data) => {
            if (data.runId === runId) {
                setTelemetry(data);
            }
        });

        socket.on('tangle:updated', (data) => {
            if (data.runId === runId) {
                setStatus(data);
            }
        });

        return () => {
            socket.emit('unsubscribe:run', { runId });
            socket.disconnect();
        };
    }, [runId]);

    return { status, telemetry };
}
```

## Best Practices

1. **Always unsubscribe** when component unmounts
2. **Use rooms** to limit broadcast scope
3. **Handle reconnections** gracefully
4. **Validate runId** before subscribing
5. **Throttle frequent updates** on the client side
