// central/utils/queueRunner.js
const path = require('path');
const {
	getNextPending,
	markQueueStarted,
	markQueueCompleted,
	markQueueError,
	findQueueItemByRunId,
	findStuckStartedItems,
	preemptStartedQueueItems,
	getRunWithParams
} = require('./db');
const { runPythonReport } = require('./runPythonReport');

const dataDir = process.env.DATA_ROOT || path.join(__dirname, '../data');
const COOLDOWN_MS = parseInt(process.env.QUEUE_COOLDOWN_MS) || 10000;

let busy = false;
let pendingTimer = null;

// Internal: require the simulationController to call launchSimulation
// Using lazy require to avoid circular dependency issues
function getLaunchSimulation() {
	const { launchSimulation } = require('../controllers/simulationController');
	return launchSimulation;
}

/**
 * Called when a run completes (status becomes 'complete')
 * Triggers report generation and schedules next pending item after cooldown
 */
async function onRunComplete(runId) {
	if (busy) {
		console.log(`[queueRunner] Already busy, skipping onRunComplete for run ${runId}`);
		return;
	}
	busy = true;
	try {
		// 1. Mark current queue item completed (if this run came from queue)
		const item = await findQueueItemByRunId(runId);
		if (item && item.status === 'started') {
			await markQueueCompleted(item.id);
			console.log(`[queueRunner] Marked queue item ${item.id} as completed for run ${runId}`);
		}

		// 2. Fire-and-forget Python report generation
		const outDir = path.join(dataDir, 'reports', `run_${runId}`);
		runPythonReport({ runId, outDir })
			.then(() => console.log(`[queueRunner] Auto-report generated for run ${runId}`))
			.catch(err => console.warn(`[queueRunner] Auto-report failed for run ${runId}: ${err.message}`));

		// 3. Schedule next pending after cooldown
		console.log(`[queueRunner] Scheduling next pending in ${COOLDOWN_MS}ms`);
		pendingTimer = setTimeout(() => {
			launchNextPending();
		}, COOLDOWN_MS);
	} catch (err) {
		console.error('[queueRunner] onRunComplete error:', err);
		busy = false;
	}
}

/**
 * Launch the next pending item from the queue
 */
async function launchNextPending() {
	try {
		const next = await getNextPending();
		if (!next) {
			console.log('[queueRunner] No pending items in queue');
			busy = false;
			return;
		}

		console.log(`[queueRunner] Launching queue item ${next.id} (run params: ${next.node_count} nodes, ${next.tx_count} tx)`);

		try {
			const launchSimulation = getLaunchSimulation();
			const result = await launchSimulation({
				nodeCount: next.node_count,
				txCount: next.tx_count,
				txDelay: next.tx_delay,
				maxPeers: next.max_peers,
				pow: next.pow,
				wait: next.wait,
				runId: undefined // let it generate
			});

			await markQueueStarted(next.id, result.runId);
			console.log(`[queueRunner] Started queue item ${next.id} as run ${result.runId}`);
		} catch (err) {
			console.error(`[queueRunner] Failed to launch queue item ${next.id}:`, err.message);
			await markQueueError(next.id, err.message || String(err));

			// Attempt the next one immediately (no cooldown after a failed launch)
			busy = false;
			return launchNextPending();
		}
	} catch (err) {
		console.error('[queueRunner] launchNextPending error:', err);
	} finally {
		busy = false;
	}
}

/**
 * Called on server startup to recover from crashes
 * Reconciles 'started' items against actual run state
 */
async function recover() {
	console.log('[queueRunner] Starting recovery...');
	try {
		const stuck = await findStuckStartedItems();
		console.log(`[queueRunner] Found ${stuck.length} stuck 'started' items`);

		for (const item of stuck) {
			if (!item.run_id) {
				await markQueueError(item.id, 'started but no run_id assigned (server restart)');
				console.log(`[queueRunner] Marked item ${item.id} as error (no run_id)`);
				continue;
			}

			try {
				const run = await getRunWithParams(item.run_id);
				if (run && run.status === 'complete') {
					await markQueueCompleted(item.id);
					console.log(`[queueRunner] Recovered item ${item.id} - run ${item.run_id} was complete`);
					// Trigger report+next to resume the chain
					onRunComplete(item.run_id);
				} else if (run && run.status === 'incomplete') {
					// Run never finished - mark as error
					await markQueueError(item.id, 'run did not complete before central restarted');
					console.log(`[queueRunner] Marked item ${item.id} as error (incomplete run ${item.run_id})`);
				} else if (!run) {
					await markQueueError(item.id, 'run record missing on restart');
					console.log(`[queueRunner] Marked item ${item.id} as error (missing run ${item.run_id})`);
				} else {
					// status === 'running' on fresh boot is unlikely (no workers running)
					await markQueueError(item.id, 'run status uncertain after restart');
					console.log(`[queueRunner] Marked item ${item.id} as error (uncertain status ${run.status})`);
				}
			} catch (err) {
				console.error(`[queueRunner] Error recovering item ${item.id}:`, err);
				await markQueueError(item.id, `recovery error: ${err.message}`);
			}
		}
		console.log('[queueRunner] Recovery complete');
		// Resume queue processing after recovery
		launchNextPending();
	} catch (err) {
		console.error('[queueRunner] Recovery failed:', err);
	}
}

/**
 * Manually preempt any started queue items (when manual start is triggered)
 */
async function preemptStarted() {
	try {
		const result = await preemptStartedQueueItems();
		console.log(`[queueRunner] Preempted ${result.changes} started queue items`);
		return result;
	} catch (err) {
		console.error('[queueRunner] Failed to preempt started items:', err);
		throw err;
	}
}

module.exports = {
	onRunComplete,
	launchNextPending,
	recover,
	preemptStarted
};
