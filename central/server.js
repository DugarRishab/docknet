// central/server.js

const http = require("http");
const app = require("./app"); // Express app
const { setupWorkerSocket } = require("./sockets/workerSocket");
const { setupDashboardSocket } = require("./sockets/dashboardSocket");
const WebSocket = require("ws");
const {db} = require("./utils/db");

app.locals.db = db;

const PORT = process.env.PORT || 4000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Setup WebSocket Server
const wss = new WebSocket.Server({
	server,
	path: "/ws",
});

// WebSocket client type routing
wss.on("connection", (ws, req) => {
    const url = req.url;
    
    if (url.startsWith("/worker")) {
        setupWorkerSocket(ws);
    } else if (url.startsWith("/dashboard")) {
        setupDashboardSocket(ws);
    } else {
        console.log("Unknown WebSocket client tried to connect.");
        ws.close();
    }
});

wss.on("error", (err) => {
	console.error("WebSocket Server error:", err);
});

// Start server
server.listen(PORT, () => {
    console.log(`Central Node server listening on http://localhost:${PORT}`);
});
