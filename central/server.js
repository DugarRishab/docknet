// central/server.js
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

const { WebSocketServer } = require("ws");
const url = require("url");
const app = require("./app"); // Express app
const { setupDashboardSocket } = require("./sockets/dashboardSocket");

// Catching uncaught exception ->>
process.on('uncaughtException', (err) => {
	console.log(`UNCAUGHT EXCEPTION -> ${err.name} - ${err.message}`);
	console.log('App SHUTTING DOWN...');
	process.exit(1); // <- Then will shut down the server.
});

// Starting Server ->>
const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
	console.log(`App running at port`, (`${port}`), '...');

	// Recover queue state after server startup
	try {
		const { recover } = require('./utils/queueRunner');
		recover().catch(err => console.error('[server] Queue recovery failed:', err));
	} catch (err) {
		console.error('[server] Failed to load queueRunner for recovery:', err);
	}
});

// WebSocket server — attached to the same HTTP server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
	const pathname = url.parse(req.url).pathname;

	if (pathname === "/dashboard") {
		setupDashboardSocket(ws);
	} else {
		console.log(`Unknown WS path: ${pathname}, closing.`);
		ws.close(4000, "Unknown path");
	}
});

// Catching unHandleled Rejections ->
process.on('unhandledRejection', (err) => {
	console.log(`UNHANDELLED REJECTION -> ${err.name} - ${err.message}`);
	console.log(err);
	console.log('App SHUTTING DOWN...');
	server.close(() => {	// <- This will first terminate all requests
		
		process.exit(1); // <- Then will shut down the server.
	});
});