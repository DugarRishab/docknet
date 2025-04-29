// central/server.js

const http = require("http");
const app = require("./app"); // Express app
const { setupWorkerSocket } = require("./sockets/workerSocket");
const { setupDashboardSocket } = require("./sockets/dashboardSocket");
const WebSocket = require("ws");

const PORT = process.env.PORT || 4000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Setup WebSocket Server
const wss = new WebSocket.Server({ server });

// WebSocket client type routing
wss.on("connection", (ws, req) => {
    const url = req.url;
    
    if (url === "/worker") {
        setupWorkerSocket(ws);
    } else if (url === "/dashboard") {
        setupDashboardSocket(ws);
    } else {
        console.log("Unknown WebSocket client tried to connect.");
        ws.close();
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`Central Node server listening on http://localhost:${PORT}`);
});
