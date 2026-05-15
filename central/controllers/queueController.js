// central/controllers/queueController.js
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const {
	addQueueItem,
	addQueueItemsBulk,
	listQueue,
	getQueueItem,
	removeQueueItem,
	updateQueueItem,
	reorderQueue,
	markQueueStarted,
	markQueueCompleted,
	markQueueError
} = require('../utils/db');
const { launchNextPending, preemptStarted } = require('../utils/queueRunner');

/**
 * Add a new item to the simulation queue
 * POST /api/simulations/queue
 */
exports.addQueue = catchAsync(async (req, res, next) => {
	const { label, node_count, tx_count, tx_delay, max_peers, wait,
	        orphan_ttl, orphan_pool_max, rate_limit_base, rate_limit_burst, rate_limit_window,
	        monitor_period } = req.body;

	// Validate required params
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

	const item = await addQueueItem({
		label: label || null,
		node_count: nodeCount,
		tx_count: txCount,
		tx_delay: txDelay,
		max_peers: maxPeers,
		wait: waitVal,
		orphan_ttl: orphan_ttl || 600,
		orphan_pool_max: orphan_pool_max || 1000,
		rate_limit_base: rate_limit_base || 10.0,
		rate_limit_burst: rate_limit_burst || 20.0,
		rate_limit_window_sec: rate_limit_window || 60,
		monitor_period: monitor_period || 5
	});

	res.status(201).json({
		status: 'success',
		data: { item }
	});
});

/**
 * List queue items
 * GET /api/simulations/queue?status=&limit=&offset=
 */
exports.listQueue = catchAsync(async (req, res, next) => {
	const { status, limit, offset } = req.query;

	const options = {};
	if (status) options.status = status;

	const items = await listQueue(options);

	// Apply limit/offset if provided
	let result = items;
	if (limit !== undefined || offset !== undefined) {
		const start = parseInt(offset) || 0;
		const end = limit !== undefined ? start + parseInt(limit) : undefined;
		result = items.slice(start, end);
	}

	res.status(200).json({
		status: 'success',
		count: result.length,
		total: items.length,
		data: { items: result }
	});
});

/**
 * Remove a pending queue item
 * DELETE /api/simulations/queue/:id
 */
exports.removeQueue = catchAsync(async (req, res, next) => {
	const id = parseInt(req.params.id);
	if (isNaN(id)) {
		return next(new AppError('Invalid queue item ID', 400));
	}

	try {
		const result = await removeQueueItem(id);
		res.status(200).json({
			status: 'success',
			data: { id, deleted: result.changes > 0 }
		});
	} catch (err) {
		if (err.message.includes('Cannot delete')) {
			return next(new AppError(err.message, 409));
		}
		throw err;
	}
});

/**
 * Update a pending queue item
 * PATCH /api/simulations/queue/:id
 */
exports.updateQueue = catchAsync(async (req, res, next) => {
	const id = parseInt(req.params.id);
	if (isNaN(id)) {
		return next(new AppError('Invalid queue item ID', 400));
	}

	const { label, node_count, tx_count, tx_delay, max_peers, wait,
	        orphan_ttl, orphan_pool_max, rate_limit_base, rate_limit_burst, rate_limit_window,
	        monitor_period } = req.body;

	// Validate required params (same as addQueue)
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

	try {
		const item = await updateQueueItem(id, {
			label: label || null,
			node_count: nodeCount,
			tx_count: txCount,
			tx_delay: txDelay,
			max_peers: maxPeers,
			wait: waitVal,
			orphan_ttl: orphan_ttl || 600,
			orphan_pool_max: orphan_pool_max || 1000,
			rate_limit_base: rate_limit_base || 10.0,
			rate_limit_burst: rate_limit_burst || 20.0,
			rate_limit_window_sec: rate_limit_window || 60,
			monitor_period: monitor_period || 5
		});

		res.status(200).json({
			status: 'success',
			data: { item }
		});
	} catch (err) {
		if (err.message.includes('not found')) {
			return next(new AppError(err.message, 404));
		}
		if (err.message.includes('Cannot update')) {
			return next(new AppError(err.message, 409));
		}
		throw err;
	}
});

/**
 * Reorder pending queue items
 * PATCH /api/simulations/queue/reorder
 */
exports.reorderQueue = catchAsync(async (req, res, next) => {
	const { ids } = req.body;

	if (!Array.isArray(ids) || ids.length === 0) {
		return next(new AppError('ids must be a non-empty array of queue item IDs', 400));
	}

	if (!ids.every(id => Number.isInteger(id))) {
		return next(new AppError('All ids must be integers', 400));
	}

	try {
		const result = await reorderQueue(ids);
		res.status(200).json({
			status: 'success',
			data: { reordered: result.reordered }
		});
	} catch (err) {
		if (err.message.includes('Cannot reorder')) {
			return next(new AppError(err.message, 409));
		}
		throw err;
	}
});

/**
 * Manually trigger queue to start next pending item
 * POST /api/simulations/queue/start-now
 */
exports.startNow = catchAsync(async (req, res, next) => {
	// Fire-and-forget the queue runner
	launchNextPending().catch(err => {
		console.error('[queueController] startNow error:', err);
	});

	res.status(200).json({
		status: 'success',
		data: { message: 'Queue runner triggered' }
	});
});

/**
 * Bulk add items to the simulation queue
 * POST /api/simulations/queue/bulk
 */
exports.bulkAddQueue = catchAsync(async (req, res, next) => {
	const { items } = req.body;

	if (!Array.isArray(items) || items.length === 0) {
		return next(new AppError('items must be a non-empty array', 400));
	}

	const parsedItems = [];
	for (const item of items) {
		const nodeCount = parseInt(item.node_count);
		if (isNaN(nodeCount) || nodeCount < 1) {
			return next(new AppError(`Invalid node_count in batch item: ${item.node_count}`, 400));
		}
		const txCount = parseInt(item.tx_count);
		if (isNaN(txCount) || txCount < 1) {
			return next(new AppError(`Invalid tx_count in batch item: ${item.tx_count}`, 400));
		}
		const txDelay = parseInt(item.tx_delay);
		if (isNaN(txDelay) || txDelay < 0) {
			return next(new AppError(`Invalid tx_delay in batch item: ${item.tx_delay}`, 400));
		}
		const maxPeers = parseInt(item.max_peers);
		if (isNaN(maxPeers) || maxPeers < 1) {
			return next(new AppError(`Invalid max_peers in batch item: ${item.max_peers}`, 400));
		}
		let waitVal = parseInt(item.wait);
		if (isNaN(waitVal)) waitVal = 300;

		parsedItems.push({
			label: item.label || null,
			node_count: nodeCount,
			tx_count: txCount,
			tx_delay: txDelay,
			max_peers: maxPeers,
			wait: waitVal,
			orphan_ttl: item.orphan_ttl || 600,
			orphan_pool_max: item.orphan_pool_max || 1000,
			rate_limit_base: item.rate_limit_base || 10.0,
			rate_limit_burst: item.rate_limit_burst || 20.0,
			rate_limit_window_sec: item.rate_limit_window || 60,
			monitor_period: item.monitor_period || 5
		});
	}

	const result = await addQueueItemsBulk(parsedItems);

	res.status(201).json({
		status: 'success',
		count: result.length,
		data: { items: result }
	});
});

/**
 * Preempt any started queue items (manual intervention)
 * POST /api/simulations/queue/preempt
 */
exports.preempt = catchAsync(async (req, res, next) => {
	const result = await preemptStarted();

	res.status(200).json({
		status: 'success',
		data: { preempted: result.changes }
	});
});
