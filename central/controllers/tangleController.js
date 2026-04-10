const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const path = require('path');
const fs = require('fs').promises;
const glob = require('glob');
const { promisify } = require('util');
const { getTransactionById, getRecentTelemetry, getRunSummary } = require('../utils/db');

const globPromise = promisify(glob);

/**
 * Aggregate tangle data from all nodes in a run
 * Merges transactions, deduplicates by ID, resolves cross-node references
 */
exports.getAllTangle = catchAsync(async (req, res, next) => {
    const { runId = 0, limit = 500, offset = 0 } = req.query;
    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data');
    const runDir = path.join(DATA_ROOT, `run${runId}`);

    // Check if run directory exists
    try {
        await fs.access(runDir);
    } catch {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    // Find all tangle.json files
    const pattern = path.join(runDir, '*/tangle.json');
    const tangleFiles = await globPromise(pattern);

    if (tangleFiles.length === 0) {
        return res.status(200).json({
            status: 'success',
            data: {
                transactions: [],
                total: 0,
                nodes: 0,
                runId
            }
        });
    }

    // Aggregate all transactions
    const transactionMap = new Map();
    const nodeSet = new Set();

    for (const file of tangleFiles) {
        const nodeId = path.basename(path.dirname(file));
        nodeSet.add(nodeId);

        try {
            const content = await fs.readFile(file, 'utf-8');
            const tangle = JSON.parse(content);

            if (Array.isArray(tangle)) {
                for (const tx of tangle) {
                    // Use transaction_id from data or top-level
                    const txId = tx.data?.transaction_id || tx.transaction_id;
                    if (txId && !transactionMap.has(txId)) {
                        transactionMap.set(txId, {
                            ...tx,
                            _originNode: nodeId
                        });
                    }
                }
            }
        } catch (err) {
            console.error(`Error reading ${file}:`, err.message);
        }
    }

    // Convert to array and apply pagination
    const allTransactions = Array.from(transactionMap.values());
    const total = allTransactions.length;
    const transactions = allTransactions.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.status(200).json({
        status: 'success',
        data: {
            transactions,
            total,
            nodes: nodeSet.size,
            runId,
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
    const { runId = 0 } = req.query;

    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data');
    const runDir = path.join(DATA_ROOT, `run${runId}`);

    // Search across all node directories
    const pattern = path.join(runDir, '*/tangle.json');
    const tangleFiles = await globPromise(pattern);

    for (const file of tangleFiles) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            const tangle = JSON.parse(content);

            if (Array.isArray(tangle)) {
                const tx = tangle.find(t => 
                    t.data?.transaction_id === txId || t.transaction_id === txId
                );
                if (tx) {
                    return res.status(200).json({
                        status: 'success',
                        data: {
                            transaction: tx,
                            nodeId: path.basename(path.dirname(file))
                        }
                    });
                }
            }
        } catch (err) {
            console.error(`Error reading ${file}:`, err.message);
        }
    }

    return next(new AppError(`Transaction ${txId} not found`, 404));
});

/**
 * Get hop history for a transaction
 */
exports.getTransactionHops = catchAsync(async (req, res, next) => {
    const { txId } = req.params;
    const { runId = 0 } = req.query;

    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data');
    const runDir = path.join(DATA_ROOT, `run${runId}`);

    // Search across all node directories
    const pattern = path.join(runDir, '*/tangle.json');
    const tangleFiles = await globPromise(pattern);

    for (const file of tangleFiles) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            const tangle = JSON.parse(content);

            if (Array.isArray(tangle)) {
                const tx = tangle.find(t => 
                    t.data?.transaction_id === txId || t.transaction_id === txId
                );
                if (tx && tx.metadata?.hops) {
                    const hops = tx.metadata.hops.map(h => ({
                        timestamp: h.timestamp,
                        nodeId: h.uid,
                        relativeDelay: 0 // Will calculate below
                    }));

                    // Calculate relative delays between hops
                    for (let i = 1; i < hops.length; i++) {
                        hops[i].relativeDelay = hops[i].timestamp - hops[i-1].timestamp;
                    }

                    return res.status(200).json({
                        status: 'success',
                        data: {
                            transactionId: txId,
                            hops,
                            totalHops: hops.length,
                            propagationDelay: tx.metadata.propagationDelay,
                            avgPropagationDelay: tx.metadata.avgPropagationDelay,
                            firstHop: hops[0]?.timestamp,
                            lastHop: hops[hops.length - 1]?.timestamp
                        }
                    });
                }
            }
        } catch (err) {
            console.error(`Error reading ${file}:`, err.message);
        }
    }

    return next(new AppError(`Transaction ${txId} or hops not found`, 404));
});

/**
 * Compare multiple transactions' hop histories
 */
exports.compareTransactions = catchAsync(async (req, res, next) => {
    const { ids } = req.query;
    const { runId = 0 } = req.query;

    if (!ids) {
        return next(new AppError('Please provide transaction IDs to compare (comma-separated)', 400));
    }

    const txIds = ids.split(',').map(id => id.trim());
    if (txIds.length < 2) {
        return next(new AppError('Please provide at least 2 transaction IDs to compare', 400));
    }

    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data');
    const runDir = path.join(DATA_ROOT, `run${runId}`);
    const pattern = path.join(runDir, '*/tangle.json');
    const tangleFiles = await globPromise(pattern);

    const transactions = [];

    for (const txId of txIds) {
        let found = false;
        for (const file of tangleFiles) {
            if (found) break;
            try {
                const content = await fs.readFile(file, 'utf-8');
                const tangle = JSON.parse(content);

                if (Array.isArray(tangle)) {
                    const tx = tangle.find(t => 
                        t.data?.transaction_id === txId || t.transaction_id === txId
                    );
                    if (tx) {
                        transactions.push({
                            id: txId,
                            sender: tx.data?.sender,
                            receiver: tx.data?.receiver,
                            timestamp: tx.data?.timestamp,
                            hops: tx.metadata?.hops || [],
                            propagationDelay: tx.metadata?.propagationDelay,
                            avgPropagationDelay: tx.metadata?.avgPropagationDelay,
                            cumulativeWeight: tx.metadata?.cumulative_weight
                        });
                        found = true;
                    }
                }
            } catch (err) {
                console.error(`Error reading ${file}:`, err.message);
            }
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
        tx.hops.map(h => h.uid || h.nodeId)
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
    const { runId = 0 } = req.params;
    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data');
    const runDir = path.join(DATA_ROOT, `run${runId}`);

    try {
        await fs.access(runDir);
    } catch {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    // Get all node directories
    const entries = await fs.readdir(runDir, { withFileTypes: true });
    const nodeDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    let totalTransactions = 0;
    let totalPeers = 0;
    let totalMetrics = 0;
    const nodeStats = [];

    for (const nodeId of nodeDirs) {
        const nodeDir = path.join(runDir, nodeId);
        
        try {
            // Read tangle
            const tanglePath = path.join(nodeDir, 'tangle.json');
            let txCount = 0;
            try {
                const tangleContent = await fs.readFile(tanglePath, 'utf-8');
                const tangle = JSON.parse(tangleContent);
                txCount = Array.isArray(tangle) ? tangle.length : 0;
                totalTransactions += txCount;
            } catch {}

            // Read peers
            const peersPath = path.join(nodeDir, 'peers.json');
            let peerCount = 0;
            try {
                const peersContent = await fs.readFile(peersPath, 'utf-8');
                const peers = JSON.parse(peersContent);
                peerCount = Array.isArray(peers) ? peers.length : 0;
                totalPeers += peerCount;
            } catch {}

            // Read metrics
            const metricsPath = path.join(nodeDir, 'metrics.json');
            let metrics = null;
            try {
                const metricsContent = await fs.readFile(metricsPath, 'utf-8');
                metrics = JSON.parse(metricsContent);
                totalMetrics++;
            } catch {}

            nodeStats.push({
                nodeId,
                transactionCount: txCount,
                peerCount,
                metrics: metrics?.length || 0
            });
        } catch (err) {
            console.error(`Error processing ${nodeId}:`, err.message);
        }
    }

    // Get recent telemetry from DB
    const recentTelemetry = await getRecentTelemetry(100);

    res.status(200).json({
        status: 'success',
        data: {
            runId,
            nodes: nodeDirs.length,
            totalTransactions,
            totalPeers,
            nodesWithMetrics: totalMetrics,
            nodeStats,
            recentTelemetry: recentTelemetry.slice(0, 10)
        }
    });
});
