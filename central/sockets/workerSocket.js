// central/sockets/workerSocket.js
// REMOVED: Workers (tangle-sg) do not connect to central via WebSocket.
// Tangle-sg only communicates with central via HTTP POST to /api/telemetry
// after the simulation completes. This file is kept as a placeholder.
//
// If real-time worker telemetry via WebSocket is needed in the future,
// a WebSocket client must first be implemented in tangle-sg (C++).

module.exports = {};
