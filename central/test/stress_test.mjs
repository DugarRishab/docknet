// stress_test.js
// Usage: node stress_test.js <endpoint> <txPerClient> <clients> <time>
// Example: node stress_test.js http://server:3000/api/telemetry 10 10 7200


import axios from "axios";
import pLimit from "p-limit";

if (process.argv.length < 5) {
	console.log(
		"Usage: node stress_test.js <endpoint> <txPerClient> <clients> <time>"
	);
	process.exit(1);
}

const endpoint = process.argv[2];
// const concurrency = parseInt(process.argv[3], 10); // concurrent HTTP requests allowed at once
const requestsPerClient = 1; // how many POSTs each simulated client will send
const txPerClient = parseInt(process.argv[3], 10);
const numClients = parseInt(process.argv[4], 10); // number of simultaneous clients
const txPerRequest = txPerClient * numClients; // size of payload (number of transactions per POST)
const concurrency = numClients;
const time = parseInt(process.argv[5], 10);

const API_KEY = process.env.UPLOAD_API_KEY || "";

function makeTx(i) {
	return {
		tx_id: `tx-${i}-${Math.random().toString(36).slice(2)}`,
		parents: [],
		weight: 1,
		sender: "worker-test",
		receiver: "node",
		amount: Math.floor(Math.random() * 100),
		unit: "kWh",
		price_per_unit: 0,
		currency: "INR",
		timestamp: Date.now(),
	};
}

function buildPayload(nodeId, runId, txCount) {
	const tangle = [];
	for (let i = 0; i < txCount; ++i) tangle.push(makeTx(i));
	const peers = [
		{
			id: nodeId,
			address: "127.0.0.1",
			port: 9000,
			uri: "ws://127.0.0.1:9000",
		},
	];
	const cpu = [{ ts: new Date().toISOString(), value: Math.random() * 100 }];
	const ram = [
		{
			ts: new Date().toISOString(),
			value_mb: Math.floor(Math.random() * 1024),
		},
	];
	const net = [
		{
			ts: new Date().toISOString(),
			bytes_sent: Math.floor(Math.random() * 10000),
			bytes_recv: Math.floor(Math.random() * 10000),
		},
	];
	let i = 0;
	while (i < time) {
		i++;

		cpu.push({
			ts: new Date().toISOString(),
			value: Math.random() * 100,
		});

		ram.push({
			ts: new Date().toISOString(),
			value_mb: Math.floor(Math.random() * 1024),
		});

		net.push({
			ts: new Date().toISOString(),
			bytes_sent: Math.floor(Math.random() * 10000),
			bytes_recv: Math.floor(Math.random() * 10000),
		});
	}

	const metrics = {
		cpu, ram, net
	}
	return {
		nodeId,
		runId,
		tangle,
		peers,
		metrics,
		metadata: { test: true, tx_count: txCount },
	};
}

async function doPost(nodeId, runId, txCount) {
	const payload = buildPayload(nodeId, runId, txCount);
	const headers = {
		"Content-Type": "application/json",
	};
	if (API_KEY) headers["x-api-key"] = API_KEY;

	const start = Date.now();
	try {
		const r = await axios.post(endpoint, payload, {
			headers,
			timeout: 5 * 60 * 1000,
		}); // 5min client timeout
		return { ok: true, status: r.status, time: Date.now() - start };
	} catch (err) {
		let msg = err.message;
		if (err.response) msg = `HTTP ${err.response.status}`;
		return { ok: false, err: msg, time: Date.now() - start };
	}
}

async function runClient(clientIndex) {
	const results = [];
	for (let i = 0; i < requestsPerClient; ++i) {
		const runId = `run_client${clientIndex}_iter${i}_${Date.now()}`;
		results.push(
			await doPost(`worker-${clientIndex}`, runId, txPerRequest)
		);
	}
	return results;
}

(async () => {
	console.log("Stress test start:", {
		endpoint,
		concurrency,
		requestsPerClient,
		txPerRequest,
		numClients,
	});

	const limiter = pLimit(concurrency);
	const allPromises = [];
	for (let c = 0; c < numClients; ++c) {
		// each client will itself run requests sequentially (requestsPerClient)
		allPromises.push(limiter(() => runClient(c)));
	}

	const start = Date.now();
	const clientsResults = await Promise.all(allPromises);
	const totalTime = Date.now() - start;

	// flatten and summarize
	const flat = clientsResults.flat();
	const succeeded = flat.filter((r) => r.ok);
	const failed = flat.filter((r) => !r.ok);
	const times = flat.map((r) => r.time);
	const avg = times.reduce((a, b) => a + b, 0) / times.length;

	console.log("=== summary ===");
	console.log("total requests:", flat.length);
	console.log("succeeded:", succeeded.length);
	console.log("failed:", failed.length);
	console.log("avg latency ms:", Math.round(avg));
	console.log("total wallclock ms:", totalTime);
	if (failed.length) {
		console.log("some failures (first 10):", failed.slice(0, 10));
	}
})();
