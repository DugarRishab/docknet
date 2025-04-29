// central/utils/broadcast.js

const dashboardClients = new Set();

/**
 * Add a new dashboard client WebSocket connection.
 * @param {WebSocket} ws - WebSocket client instance
 */
function addClient(ws) {
	dashboardClients.add(ws);

	ws.on("close", () => {
		dashboardClients.delete(ws);
	});

	ws.on("error", () => {
		dashboardClients.delete(ws);
	});
	ws.on("message", (data) => {
		try {
			const msg = JSON.parse(data);
			if (msg.type === "pong") {
				dashboardClients.get(ws).lastPong = Date.now();
			}
		} catch (_) {}
	});
}

/**
 * Broadcast a message to all connected dashboard clients.
 * @param {Object} message - JSON message to send
 */
function broadcast(message) {
	const data = JSON.stringify(message);

	for (const [client, meta] of dashboardClients) {
		if (client.readyState === 1) {
			client.send(data);
		}
	}
}

// Heartbeat interval
setInterval(() => {
	const now = Date.now();
	for (const [client, meta] of dashboardClients) {
		if (now - meta.lastPong > 10000) {
			console.log("Dashboard client timed out, closing...");
			client.terminate();
			dashboardClients.delete(client);
		} else {
			client.send(JSON.stringify({ type: "ping" }));
		}
	}
}, 5000);

module.exports = {
	addClient,
	broadcast,
};
