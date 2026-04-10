// central/sockets/dashboardSocket.js
const { addClient } = require("../utils/broadcast");

/**
 * Handles a new WebSocket connection from the dashboard
 * @param {WebSocket} ws - WebSocket connection
 */
function setupDashboardSocket(ws) {
	console.log("📊 Dashboard connected");
	addClient(ws);

	ws.on("error", (err) => {
		console.error("Dashboard WS Error:", err.message);
	});
}

module.exports = {
	setupDashboardSocket,
};
