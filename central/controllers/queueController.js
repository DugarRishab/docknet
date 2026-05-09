// central/controllers/queueController.js
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const {
	addQueueItem,
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
	const { label, node_count, tx_count, tx_delay, max_peers, pow, wait } = req.body;

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

	// Handle pow: default 3, range 1-5
	let powVal = parseInt(pow);
	if (isNaN(powVal)) powVal = 3;
	if (powVal < 1 || powVal > 5) {
		return next(new AppError('Invalid pow: must be between 1 and 5', 400));
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
		pow: powVal,
		wait: waitVal
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

	const { label, node_count, tx_count, tx_delay, max_peers, pow, wait } = req.body;

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

	// Handle pow: default 3, range 1-5
	let powVal = parseInt(pow);
	if (isNaN(powVal)) powVal = 3;
	if (powVal < 1 || powVal > 5) {
		return next(new AppError('Invalid pow: must be between 1 and 5', 400));
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
			pow: powVal,
			wait: waitVal
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
