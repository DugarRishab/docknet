// central/sockets/workerSocket.js

const { insertTelemetry } = require("../utils/db");
const { broadcast } = require("../utils/broadcast");

const workerNodes = new Map(); // Map<WebSocket, { node_id, lastPong }>

/**
 * Handles a new WebSocket connection from a worker node
 * @param {WebSocket} ws - WebSocket connection
 */
function setupWorkerSocket(ws) {
	console.log("🛠️ Worker connected");

	let nodeId = null;

	ws.on("message", (message) => {
		try {
			const data = JSON.parse(message);

			// Handle telemetry
			if (
				data.node_id &&
				data.tx_id &&
				data.tx_time_ms != null &&
				data.pow_time_ms != null
			) {
				nodeId = data.node_id;

				// Update worker status
				workerNodes.set(ws, {
					node_id: nodeId,
					lastPong: Date.now(),
				});

				// Save telemetry to DB
				insertTelemetry({
					node_id: nodeId,
					tx_id: data.tx_id,
					tx_time_ms: data.tx_time_ms,
					pow_time_ms: data.pow_time_ms,
				});

				// Broadcast telemetry to dashboard(s)
				broadcast({
					type: "telemetry",
					data: {
						node_id: nodeId,
						tx_id: data.tx_id,
						tx_time_ms: data.tx_time_ms,
						pow_time_ms: data.pow_time_ms,
					},
				});
			}

			// Handle pong
			if (data.type === "pong" && nodeId) {
				const node = workerNodes.get(ws);
				if (node) node.lastPong = Date.now();
			}
		} catch (err) {
			console.error("❌ Invalid message from worker:", err.message);
		}
	});

	ws.on("close", () => {
		console.log("🔌 Worker disconnected");
	});

	ws.on("error", (err) => {
		console.error("Worker WS Error:", err.message);
	});
}

// ⏰ Periodically ping workers and broadcast node status
setInterval(() => {
	const now = Date.now();
	const online = [];
	const offline = [];

	for (const [ws, { node_id, lastPong }] of workerNodes.entries()) {
		if (now - lastPong > 10000) {
			console.warn(`⏱️ Worker timeout: ${node_id}`);
			offline.push(node_id);
			ws.terminate();
			workerNodes.delete(ws);
		} else {
			online.push(node_id);
			ws.send(JSON.stringify({ type: "ping" }));
		}
	}

	// Broadcast node status to dashboard
	broadcast({
		type: "node_status",
		payload: {
			online_nodes: online,
			offline_nodes: offline,
		},
	});
}, 5000);

module.exports = {
	setupWorkerSocket,
};
