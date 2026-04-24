const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const {
    getTransactionsByRun,
    getTransactionWithHops,
    getTangleForNode,
    listRuns,
    listNodes,
    getRunSummary,
    deleteRunAtomic,
    checkRunExists
} = require('../utils/db');

/**
 * List all available runs
 */
exports.listRuns = catchAsync(async (req, res, next) => {
    const runs = await listRuns();
    res.status(200).json({
        status: 'success',
        data: { runs }
    });
});

/**
 * List all nodes for a specific run
 */
exports.listNodes = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    const runExists = await checkRunExists(runId);
    if (!runExists) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    const nodes = await listNodes(runId);
    res.status(200).json({
        status: 'success',
        data: { nodes, runId }
    });
});

/**
 * Get full tangle for a specific node
 * GET /api/tangle/runs/:runId/nodes/:nodeIndex
 */
exports.getNodeTangle = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    const nodeIndex = parseInt(req.params.nodeIndex);

    if (isNaN(runId) || isNaN(nodeIndex)) {
        return next(new AppError('Invalid runId or nodeIndex', 400));
    }

    const runExists = await checkRunExists(runId);
    if (!runExists) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    const transactions = await getTangleForNode(runId, nodeIndex);

    res.status(200).json({
        status: 'success',
        data: {
            runId,
            nodeIndex,
            transactions: transactions.map(tx => ({
                id: tx.transaction_id,
                data: {
                    transaction_id: tx.transaction_id,
                    sender: tx.sender,
                    receiver: tx.receiver,
                    amount: tx.amount,
                    unit: tx.unit,
                    price_per_unit: tx.price_per_unit,
                    currency: tx.currency,
                    timestamp: tx.timestamp,
                    parents: tx.parents
                },
                metadata: {
                    cumulative_weight: tx.cumulative_weight,
                    signature1: tx.signature1,
                    signature2: tx.signature2,
                    checksum: tx.checksum,
                    lastUpdated: tx.last_updated,
                    weightMap: tx.weight_map,
                    consensusTimestamp: tx.consensus_timestamp,
                    consensusDuration: tx.consensus_duration,
                    verificationTimestamp: tx.verification_timestamp,
                    verificationDuration: tx.verification_duration,
                    powDuration: tx.pow_duration,
                    tsaDuration: tx.tsa_duration,
                    completionDuration: tx.completion_duration,
                    propagationDelay: tx.propagation_delay,
                    avgPropagationDelay: tx.avg_propagation_delay,
                    hops: tx.hops || []
                }
            })),
            total: transactions.length
        }
    });
});

/**
 * Aggregate tangle data from all nodes in a run
 */
exports.getAllTangle = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.query.runId);
    const limit = parseInt(req.query.limit) || 500;
    const offset = parseInt(req.query.offset) || 0;

    if (isNaN(runId)) {
        return next(new AppError('Missing or invalid runId query parameter', 400));
    }

    const transactions = await getTransactionsByRun(runId, parseInt(limit), parseInt(offset));

    // Get total count and node count
    const nodes = await listNodes(runId);

    res.status(200).json({
        status: 'success',
        data: {
            transactions: transactions.map(tx => ({
                id: tx.transaction_id,
                data: {
                    transaction_id: tx.transaction_id,
                    sender: tx.sender,
                    receiver: tx.receiver,
                    amount: tx.amount,
                    unit: tx.unit,
                    price_per_unit: tx.price_per_unit,
                    currency: tx.currency,
                    timestamp: tx.timestamp,
                    parents: tx.parents
                },
                metadata: {
                    cumulative_weight: tx.cumulative_weight,
                    signature1: tx.signature1,
                    signature2: tx.signature2,
                    checksum: tx.checksum,
                    lastUpdated: tx.last_updated,
                    weightMap: tx.weight_map,
                    consensusTimestamp: tx.consensus_timestamp,
                    consensusDuration: tx.consensus_duration,
                    verificationTimestamp: tx.verification_timestamp,
                    verificationDuration: tx.verification_duration,
                    powDuration: tx.pow_duration,
                    tsaDuration: tx.tsa_duration,
                    completionDuration: tx.completion_duration,
                    propagationDelay: tx.propagation_delay,
                    avgPropagationDelay: tx.avg_propagation_delay,
                    hops: tx.hops || []
                },
                _originNode: `node_${tx.node_index}`
            })),
            total: transactions.length,
            nodes: nodes.length,
            runId: parseInt(runId),
            limit: parseInt(limit),
            offset: parseInt(offset)
        }
    });
});

/**
 * Get single transaction by ID
 */
exports.getTransactionById = catchAsync(async (req, res, next) => {
    const { txId } = req.params;
    const runId = parseInt(req.query.runId);
    if (isNaN(runId)) {
        return next(new AppError('Missing or invalid runId query parameter', 400));
    }

    const tx = await getTransactionWithHops(txId, runId);

    if (!tx) {
        return next(new AppError(`Transaction ${txId} not found`, 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            transaction: {
                id: tx.transaction_id,
                data: {
                    transaction_id: tx.transaction_id,
                    sender: tx.sender,
                    receiver: tx.receiver,
                    amount: tx.amount,
                    unit: tx.unit,
                    price_per_unit: tx.price_per_unit,
                    currency: tx.currency,
                    timestamp: tx.timestamp,
                    parents: tx.parents
                },
                metadata: {
                    cumulative_weight: tx.cumulative_weight,
                    signature1: tx.signature1,
                    signature2: tx.signature2,
                    checksum: tx.checksum,
                    lastUpdated: tx.last_updated,
                    weightMap: tx.weight_map,
                    consensusTimestamp: tx.consensus_timestamp,
                    consensusDuration: tx.consensus_duration,
                    verificationTimestamp: tx.verification_timestamp,
                    verificationDuration: tx.verification_duration,
                    powDuration: tx.pow_duration,
                    tsaDuration: tx.tsa_duration,
                    completionDuration: tx.completion_duration,
                    propagationDelay: tx.propagation_delay,
                    avgPropagationDelay: tx.avg_propagation_delay,
                    hops: tx.hops
                },
                _originNode: `node_${tx.node_index}`
            },
            nodeId: `node_${tx.node_index}`
        }
    });
});

/**
 * Get hop history for a transaction
 */
exports.getTransactionHops = catchAsync(async (req, res, next) => {
    const { txId } = req.params;
    const runId = parseInt(req.query.runId);
    if (isNaN(runId)) {
        return next(new AppError('Missing or invalid runId query parameter', 400));
    }

    const tx = await getTransactionWithHops(txId, runId);

    if (!tx || !tx.hops || tx.hops.length === 0) {
        return next(new AppError(`Transaction ${txId} or hops not found`, 404));
    }

    const hops = tx.hops.map(h => ({
        timestamp: h.timestamp,
        nodeId: h.nodeId,
        relativeDelay: 0
    }));

    // Calculate relative delays between hops
    for (let i = 1; i < hops.length; i++) {
        hops[i].relativeDelay = hops[i].timestamp - hops[i-1].timestamp;
    }

    res.status(200).json({
        status: 'success',
        data: {
            transactionId: txId,
            hops,
            totalHops: hops.length,
            propagationDelay: tx.propagation_delay,
            avgPropagationDelay: tx.avg_propagation_delay,
            firstHop: hops[0]?.timestamp,
            lastHop: hops[hops.length - 1]?.timestamp
        }
    });
});

/**
 * Compare multiple transactions' hop histories
 */
exports.compareTransactions = catchAsync(async (req, res, next) => {
    const { ids } = req.query;
    const runId = parseInt(req.query.runId);
    if (isNaN(runId)) {
        return next(new AppError('Missing or invalid runId query parameter', 400));
    }

    if (!ids) {
        return next(new AppError('Please provide transaction IDs to compare (comma-separated)', 400));
    }

    const txIds = ids.split(',').map(id => id.trim());
    if (txIds.length < 2) {
        return next(new AppError('Please provide at least 2 transaction IDs to compare', 400));
    }

    const transactions = [];

    for (const txId of txIds) {
        const tx = await getTransactionWithHops(txId, runId);
        if (tx) {
            transactions.push({
                id: txId,
                sender: tx.sender,
                receiver: tx.receiver,
                timestamp: tx.timestamp,
                hops: tx.hops || [],
                propagationDelay: tx.propagation_delay,
                avgPropagationDelay: tx.avg_propagation_delay,
                cumulativeWeight: tx.cumulative_weight
            });
        }
    }

    // Calculate path divergence
    const analysis = analyzePathDivergence(transactions);

    res.status(200).json({
        status: 'success',
        data: {
            transactions,
            comparison: analysis,
            count: transactions.length
        }
    });
});

/**
 * Analyze path divergence between transactions
 */
function analyzePathDivergence(transactions) {
    if (transactions.length < 2) return null;

    // Find common nodes in paths
    const allPaths = transactions.map(tx =>
        tx.hops.map(h => h.node_id)
    );

    const commonNodes = allPaths.reduce((acc, path) => {
        if (acc === null) return new Set(path);
        return new Set([...acc].filter(x => path.includes(x)));
    }, null);

    // Find path lengths
    const pathLengths = transactions.map(tx => ({
        id: tx.id,
        hops: tx.hops.length,
        propagationDelay: tx.propagationDelay
    }));

    // Find fastest/slowest
    const sortedByDelay = [...pathLengths].sort((a, b) =>
        (a.propagationDelay || Infinity) - (b.propagationDelay || Infinity)
    );

    return {
        commonNodes: Array.from(commonNodes || []),
        pathLengths,
        fastestTransaction: sortedByDelay[0]?.id,
        slowestTransaction: sortedByDelay[sortedByDelay.length - 1]?.id,
        averageHops: pathLengths.reduce((sum, p) => sum + p.hops, 0) / pathLengths.length,
        averagePropagationDelay: transactions.reduce((sum, t) => sum + (t.propagationDelay || 0), 0) / transactions.length
    };
}

/**
 * Get run summary with aggregated metrics
 */
exports.getRunSummary = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    const summary = await getRunSummary(runId);

    if (!summary) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    // Get nodes for this run
    const nodes = await listNodes(runId);

    res.status(200).json({
        status: 'success',
        data: {
            runId: summary.run_id,
            status: summary.status,
            startedAt: summary.started_at,
            endedAt: summary.ended_at,
            nodes: summary.total_nodes,
            totalTransactions: summary.total_transactions,
            distinctTransactionIds: summary.unique_transactions || 0,
            totalPeers: summary.total_peer_records,
            nodesWithMetrics: summary.total_metrics_records > 0 ? summary.total_nodes : 0,
            maxDagDepth: summary.max_dag_depth || 0,
            genesisWeight: summary.genesis_weight || 0,
            avgVerificationTime: summary.avg_verification_time || 0,
            avgCompletionTime: summary.avg_completion_time || 0,
            avgPropagationDelay: summary.avg_propagation_delay || 0,
            nodeStats: nodes.map(n => ({
                nodeId: n.original_node_id,
                nodeIndex: n.node_index,
                nodeIp: n.node_ip
            }))
        }
    });
});

/**
 * Delete a run and all associated data (atomic)
 */
exports.deleteRun = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    const result = await deleteRunAtomic(runId);

    if (result.changes === 0) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    res.status(200).json({
        status: 'success',
        data: { message: `Run ${runId} deleted` }
    });
});
