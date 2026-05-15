// central/controllers/simulationController.js
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { getOrCreateRun, insertRunParams, saveTelemetryBatch, preemptStartedQueueItems } = require('../utils/db');
const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const SHARED_VOLUME = 'program-files';

// TELEMETRY_ENDPOINT from env, with fallback
const TELEMETRY_ENDPOINT = process.env.TELEMETRY_ENDPOINT || 'http://172.25.0.10:8000/api/ingest/telemetry';

/**
 * Internal: Launch simulation with validated params
 * Returns { runId } on success
 */
async function launchSimulation({ nodeCount, txCount, txDelay, maxPeers, wait, runId: providedRunId, orphanTtl, orphanPoolMax, rateLimitBase, rateLimitBurst, rateLimitWindow, monitorPeriod, label }) {
	// Validate inputs (defensive, should already be validated by caller)
	if (isNaN(nodeCount) || nodeCount < 1) throw new Error('Invalid node_count');
	if (isNaN(txCount) || txCount < 1) throw new Error('Invalid tx_count');
	if (isNaN(txDelay) || txDelay < 0) throw new Error('Invalid tx_delay');
	if (isNaN(maxPeers) || maxPeers < 1) throw new Error('Invalid max_peers');

	let waitVal = parseInt(wait);
	if (isNaN(waitVal)) waitVal = 300;

	let runId = providedRunId ? parseInt(providedRunId) : 0;
	if (!runId || isNaN(runId) || runId <= 0) {
		runId = Math.floor(Date.now() / 1000);
	}

	// Save run params BEFORE starting containers (single source of truth)
	await getOrCreateRun(runId, label || null);
	await insertRunParams(runId, {
		node_count: nodeCount,
		tx_count: txCount,
		tx_delay: txDelay,
		max_peers: maxPeers,
		wait: waitVal,
		orphan_ttl: orphanTtl || 600,
		orphan_pool_max: orphanPoolMax || 1000,
		rate_limit_base: rateLimitBase || 10.0,
		rate_limit_burst: rateLimitBurst || 20.0,
		rate_limit_window_sec: rateLimitWindow || 60,
		monitor_period: monitorPeriod || 5
	});
	console.log(`[launchSimulation] Saved run params for run ${runId}`);

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
		console.warn('[launchSimulation] Warning: failed to clean up existing containers:', err.message);
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
						`TOTAL_NODES=${nodeCount}`,
						`RUN_ID=${runId}`,
						`WAIT_PERIOD=${waitVal}`,
						`MONITOR_PERIOD=${monitorPeriod || 5}`,
						`ORPHAN_TTL_SEC=${orphanTtl || 600}`,
						`ORPHAN_POOL_MAX=${orphanPoolMax || 1000}`,
						`RATE_LIMIT_BASE=${rateLimitBase || 10.0}`,
						`RATE_LIMIT_BURST=${rateLimitBurst || 20.0}`,
						`RATE_LIMIT_WINDOW_SEC=${rateLimitWindow || 60}`,
					],
					HostConfig: {
						NetworkMode: 'docknet_docknet',
						Binds: [`${SHARED_VOLUME}:/app/program:ro`],
					},
				})
				.then((container) => container.start())
		);
	}

	await Promise.all(promises);

	return { runId };
}

// Export for use by queue runner
exports.launchSimulation = launchSimulation;

/**
 * Start a new simulation with specified parameters
 * POST /api/simulations/start
 */
exports.startSimulation = catchAsync(async (req, res, next) => {
	const { node_count, tx_count, tx_delay, max_peers, run, wait, label,
	        orphan_ttl, orphan_pool_max, rate_limit_base, rate_limit_burst, rate_limit_window,
	        monitor_period } = req.body;

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

	// Handle wait period: default 300
	let waitVal = parseInt(wait);
	if (isNaN(waitVal)) waitVal = 300;

	// Handle run ID: generate if not provided
	let runId = run ? parseInt(run) : 0;
	if (!runId || isNaN(runId) || runId <= 0) {
		runId = Math.floor(Date.now() / 1000);
	}

	// Preempt any started queue items (manual start takes precedence)
	try {
		await preemptStartedQueueItems();
		console.log('[startSimulation] Preempted any started queue items');
	} catch (err) {
		console.warn('[startSimulation] Failed to preempt queue items:', err.message);
	}

	// Launch the simulation
	const result = await launchSimulation({
		nodeCount,
		txCount,
		txDelay,
		maxPeers,
		wait: waitVal,
		runId,
		label: label || null,
		orphanTtl: orphan_ttl,
		orphanPoolMax: orphan_pool_max,
		rateLimitBase: rate_limit_base,
		rateLimitBurst: rate_limit_burst,
		rateLimitWindow: rate_limit_window,
		monitorPeriod: monitor_period
	});

	res.status(200).json({
		status: 'success',
		data: {
			message: `${nodeCount} workers started`,
			runId: result.runId,
			params: {
				nodeCount,
				txCount,
				txDelay,
				maxPeers,
				wait: waitVal,
				orphanTtl: orphan_ttl || 600,
				orphanPoolMax: orphan_pool_max || 1000,
				rateLimitBase: rate_limit_base || 10.0,
				rateLimitBurst: rate_limit_burst || 20.0,
				rateLimitWindow: rate_limit_window || 60,
				monitorPeriod: monitor_period || 5
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
