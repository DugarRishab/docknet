// central/controllers/simulationController.js
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { getOrCreateRun, insertRunParams, saveTelemetryBatch } = require('../utils/db');
const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const SHARED_VOLUME = 'program-files';

// TELEMETRY_ENDPOINT from env, with fallback
const TELEMETRY_ENDPOINT = process.env.TELEMETRY_ENDPOINT || 'http://172.25.0.10:8000/api/ingest/telemetry';

/**
 * Start a new simulation with specified parameters
 * POST /api/simulations/start
 */
exports.startSimulation = catchAsync(async (req, res, next) => {
	const { node_count, tx_count, tx_delay, max_peers, pow, run, wait } = req.query;

	// Strict validation
	const nodeCount = parseInt(node_count);
	if (isNaN(nodeCount) || nodeCount < 1) {
		return next(new AppError('Invalid node_count: must be a positive integer', 400));
	}

	const txCount = parseInt(tx_count);
	if (isNaN(txCount) || txCount < 1) {
		return next(new AppError('Invalid tx_count: must be a positive integer', 400));
	}

	const txDelay = parseInt(tx_delay);
	if (isNaN(txDelay) || txDelay < 0) {
		return next(new AppError('Invalid tx_delay: must be a non-negative integer', 400));
	}

	const maxPeers = parseInt(max_peers);
	if (isNaN(maxPeers) || maxPeers < 1) {
		return next(new AppError('Invalid max_peers: must be a positive integer', 400));
	}

	// Handle pow: default 3, range 1-5
	let powVal = parseInt(pow);
	if (isNaN(powVal)) powVal = 3;
	if (powVal < 1 || powVal > 5) {
		return next(new AppError('Invalid pow: must be between 1 and 5', 400));
	}

	// Handle wait period: default 300
	let waitVal = parseInt(wait);
	if (isNaN(waitVal)) waitVal = 300;

	// Handle run ID: reject 0
	const runId = parseInt(run) || 0;
	if (runId === 0) {
		return next(new AppError('Invalid run: must provide a non-zero run ID', 400));
	}

	// Save run params BEFORE starting containers (single source of truth)
	let runRecord;
	try {
		runRecord = await getOrCreateRun(runId);
		await insertRunParams(runId, {
			node_count: nodeCount,
			tx_count: txCount,
			tx_delay: txDelay,
			max_peers: maxPeers,
			pow: powVal,
			wait: waitVal
		});
		console.log(`[startSimulation] Saved run params for run ${runId}`);
	} catch (err) {
		return next(new AppError(`Failed to save run params: ${err.message}`, 500));
	}

	// Remove all existing worker containers
	try {
		const existing = await docker.listContainers({
			all: true,
			filters: { name: ['^docknet-worker'] },
		});
		await Promise.all(
			existing.map((c) => docker.getContainer(c.Id).remove({ force: true }))
		);
	} catch (err) {
		console.warn('[startSimulation] Warning: failed to clean up existing containers:', err.message);
	}

	// Launch new workers
	const promises = [];
	for (let i = 1; i <= nodeCount; i++) {
		const name = `docknet-worker-${i}`;
		promises.push(
			docker
				.createContainer({
					name,
					Image: 'docknet/worker:latest',
					Env: [
						`NODE_ID=worker${i}`,
						`TELEMETRY_ENDPOINT=${TELEMETRY_ENDPOINT}`,
						`REPO_URL=https://github.com/DugarRishab/tangle-sg`,
						`REPO_BRANCH=monitor`,
						`TX_COUNT=${txCount}`,
						`TX_DELAY=${txDelay}`,
						`MAX_PEERS=${maxPeers}`,
						`POW=${powVal}`,
						`RUN_ID=${runId}`,
						`WAIT_PERIOD=${waitVal}`,
					],
					HostConfig: {
						NetworkMode: 'docknet_docknet',
						Binds: [`${SHARED_VOLUME}:/app/program:ro`],
					},
				})
				.then((container) => container.start())
		);
	}

	try {
		await Promise.all(promises);
	} catch (err) {
		return next(new AppError(`Failed to start workers: ${err.message}`, 500));
	}

	res.status(200).json({
		status: 'success',
		data: {
			message: `${nodeCount} workers started`,
			runId: runId,
			params: {
				nodeCount,
				txCount,
				txDelay,
				maxPeers,
				pow: powVal,
				wait: waitVal
			}
		}
	});
});

/**
 * Upload telemetry from worker nodes
 * POST /api/ingest/telemetry
 */
exports.uploadTelemetry = catchAsync(async (req, res, next) => {
	const { nodeId, nodeIP, tangle, peers, metrics, runId } = req.body;

	// Strict validation - all required fields must be present and non-empty
	if (!nodeId || typeof nodeId !== 'string') {
		return next(new AppError('Missing required field: nodeId (string)', 400));
	}

	if (runId === undefined || runId === null) {
		return next(new AppError('Missing required field: runId', 400));
	}

	const parsedRunId = parseInt(runId);
	if (isNaN(parsedRunId) || parsedRunId === 0) {
		return next(new AppError('Invalid runId: must be a non-zero integer', 400));
	}

	if (!tangle || !Array.isArray(tangle) || tangle.length === 0) {
		return next(new AppError('Missing or empty required field: tangle (array)', 400));
	}

	if (!peers || !Array.isArray(peers)) {
		return next(new AppError('Missing required field: peers (array)', 400));
	}

	if (!metrics || !Array.isArray(metrics)) {
		return next(new AppError('Missing required field: metrics (array)', 400));
	}

	console.log(`[telemetry] Received from node: ${nodeId}, run: ${parsedRunId}, tx: ${tangle.length}, peers: ${peers.length}, metrics: ${metrics.length}`);

	try {
		// Save to SQLite database atomically
		const result = await saveTelemetryBatch(
			parsedRunId,
			nodeId,
			nodeIP || null,
			{ tangle, peers, metrics }
		);

		console.log(`[telemetry] Saved to DB: run_id=${result.run.run_id}, node_index=${result.node.node_index}, counts=${JSON.stringify(result.counts)}`);

		return res.status(200).json({
			status: 'success',
			data: {
				runId: result.run.run_id,
				nodeIndex: result.node.node_index,
				originalNodeId: result.node.original_node_id,
				counts: result.counts
			}
		});
	} catch (error) {
		console.error('[telemetry] Error saving to DB:', error);
		return next(new AppError(`Failed to save telemetry: ${error.message}`, 500));
	}
});
