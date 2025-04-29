// central/sockets/dashboardSocket.js
const { addClient, broadcast } = require("../utils/broadcast");
const dashboardClients = new Set();

/**
 * Handles a new WebSocket connection from the dashboard
 * @param {WebSocket} ws - WebSocket connection
 */
function setupDashboardSocket(ws) {
	console.log("📊 Dashboard connected");
	dashboardClients.add(ws);
	addClient(ws);
	
	ws.on("close", () => {
		console.log("📉 Dashboard disconnected");
		dashboardClients.delete(ws);
	});

	ws.on("error", (err) => {
		console.error("Dashboard WS Error:", err.message);
	});
}

module.exports = {
	setupDashboardSocket,
	dashboardClients,
};
