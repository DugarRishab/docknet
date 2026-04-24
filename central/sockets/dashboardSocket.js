// central/sockets/dashboardSocket.js
// WebSocket clients for dashboard (currently simple logging only)
const clients = new Set();

/**
 * Handles a new WebSocket connection from the dashboard
 * @param {WebSocket} ws - WebSocket connection
 */
function setupDashboardSocket(ws) {
	console.log("📊 Dashboard connected");
	clients.add(ws);

	ws.on("error", (err) => {
		console.error("Dashboard WS Error:", err.message);
	});

	ws.on("close", () => {
		clients.delete(ws);
		console.log("📊 Dashboard disconnected");
	});
}

/**
 * Broadcast a message to all connected dashboard clients
 * @param {Object} data - Data to broadcast
 */
function broadcastToDashboard(data) {
	const message = JSON.stringify(data);
	clients.forEach(ws => {
		if (ws.readyState === 1) { // WebSocket.OPEN
			ws.send(message);
		}
	});
}

module.exports = {
	setupDashboardSocket,
	broadcastToDashboard
};
