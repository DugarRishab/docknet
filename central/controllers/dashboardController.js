// central/controllers/dashboardController.js
const catchAsync = require('../utils/catchAsync');
const { getGlobalCounters, getAllRunParamsWithStatus } = require('../utils/db');

/**
 * Get global summary across all runs
 * GET /api/dashboard/summary
 */
exports.getSummary = catchAsync(async (req, res) => {
	const counters = await getGlobalCounters();

	res.status(200).json({
		status: 'success',
		data: {
			totalRuns: counters.totalRuns || 0,
			completedRuns: counters.completedRuns || 0,
			runningRuns: counters.runningRuns || 0,
			failedRuns: counters.failedRuns || 0,
			totalNodes: counters.totalNodes || 0,
			totalTransactions: counters.totalTransactions || 0,
			totalDistinctTransactionIds: counters.totalDistinctTransactionIds || 0,
			totalPeerLinks: counters.totalPeerLinks || 0,
			lastRunAt: counters.lastRunAt
		}
	});
});

/**
 * Get heatmap of parameter space coverage
 * GET /api/dashboard/heatmap
 */
exports.getHeatmap = catchAsync(async (req, res) => {
	// Parse query params with defaults
	const txPerNodeRanges = req.query.txPerNodeRanges
		? req.query.txPerNodeRanges.split(',').map(Number)
		: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

	const nodeCountRanges = req.query.nodeCountRanges
		? req.query.nodeCountRanges.split(',').map(Number)
		: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

	const status = req.query.status || 'completed';

	// Validate ranges
	if (txPerNodeRanges.some(isNaN) || nodeCountRanges.some(isNaN)) {
		return res.status(400).json({
			status: 'error',
			message: 'Invalid ranges: must be comma-separated numbers'
		});
	}

	// Sort ranges ascending
	txPerNodeRanges.sort((a, b) => a - b);
	nodeCountRanges.sort((a, b) => a - b);

	// Get all run params
	const runParams = await getAllRunParamsWithStatus(status);

	// Initialize empty buckets grid
	const buckets = [];
	let totalRunsBucketed = 0;

	// Create bucket for every (txPerNode, nodeCount) combination
	for (const txPerNode of txPerNodeRanges) {
		for (const nodeCount of nodeCountRanges) {
			// Find runs that fall into this bucket
			// tx_count and node_count must be >= bucket value but < next bucket value
			const matchingRuns = runParams.filter(rp => {
				const txMatches = rp.tx_count >= txPerNode &&
					(txPerNodeRanges.indexOf(txPerNode) === txPerNodeRanges.length - 1 ||
					 rp.tx_count < txPerNodeRanges[txPerNodeRanges.indexOf(txPerNode) + 1]);
				const nodeMatches = rp.node_count >= nodeCount &&
					(nodeCountRanges.indexOf(nodeCount) === nodeCountRanges.length - 1 ||
					 rp.node_count < nodeCountRanges[nodeCountRanges.indexOf(nodeCount) + 1]);
				return txMatches && nodeMatches;
			});

			const runCount = matchingRuns.length;
			if (runCount > 0) totalRunsBucketed += runCount;

			buckets.push({
				txPerNode,
				nodeCount,
				runCount,
				exists: runCount > 0
			});
		}
	}

	res.status(200).json({
		status: 'success',
		data: {
			txPerNodeRanges,
			nodeCountRanges,
			buckets,
			totalRunsBucketed,
			statusFilter: status
		}
	});
});
