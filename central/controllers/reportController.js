// central/controllers/reportController.js
const path = require('path');
const fs = require('fs');
const {
    getRunWithParams,
    listNodes,
    getAllTransactionsByRun,
    getUniqueTransactionIds,
    getPeersByRun,
    getChartsData
} = require('../utils/db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { runPythonReport } = require('../utils/runPythonReport');

// Helper: Group array by key
function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
        const k = item[key];
        if (!acc[k]) acc[k] = [];
        acc[k].push(item);
        return acc;
    }, {});
}

// Helper: Compute average
function avg(arr) {
    if (!arr.length) return 0;
    const valid = arr.filter(x => x != null && !isNaN(x));
    if (!valid.length) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Helper: Compute histogram buckets
function computeHistogram(values, bucketCount = 10) {
    const valid = values.filter(x => x != null && !isNaN(x));
    if (!valid.length) return [];

    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const bucketSize = (max - min) / bucketCount || 1;

    const buckets = Array(bucketCount).fill(0);
    valid.forEach(v => {
        const idx = Math.min(Math.floor((v - min) / bucketSize), bucketCount - 1);
        buckets[idx]++;
    });

    return buckets.map((count, i) => ({
        min: min + i * bucketSize,
        max: min + (i + 1) * bucketSize,
        count
    }));
}

// Compute tangle consistency across nodes
function computeConsistency(txByTxId, nodes) {
    const nodeCount = nodes.length;
    const nodeIds = nodes.map(n => n.id);

    const fullyReplicated = [];
    const partiallyReplicated = [];
    const parentConflicts = [];
    const signatureConflicts = [];
    const dataConflicts = [];
    const weightDiffs = [];
    const consensusDiffs = [];

    for (const [txId, versions] of Object.entries(txByTxId)) {
        const presentNodeIds = versions.map(v => v.node_id);
        const missingNodeIds = nodeIds.filter(id => !presentNodeIds.includes(id));

        if (missingNodeIds.length === 0) {
            fullyReplicated.push(txId);
        } else {
            partiallyReplicated.push({
                txId,
                presentIn: presentNodeIds,
                missingFrom: missingNodeIds
            });
        }

        // Check for conflicts (only if multiple versions exist)
        if (versions.length > 1) {
            // Parent conflicts
            const parentSets = versions.map(v => JSON.stringify(v.parents.sort()));
            if (new Set(parentSets).size > 1) {
                parentConflicts.push({
                    txId,
                    versions: versions.map(v => ({
                        node_id: v.node_id,
                        node_index: v.node_index,
                        parents: v.parents
                    }))
                });
            }

            // Signature conflicts
            const sig1Set = versions.map(v => v.signature1);
            const sig2Set = versions.map(v => v.signature2);
            if (new Set(sig1Set).size > 1 || new Set(sig2Set).size > 1) {
                signatureConflicts.push({
                    txId,
                    versions: versions.map(v => ({
                        node_id: v.node_id,
                        signature1: v.signature1,
                        signature2: v.signature2
                    }))
                });
            }

            // Data conflicts (sender, receiver, amount)
            const dataSet = versions.map(v => `${v.sender}|${v.receiver}|${v.amount}`);
            if (new Set(dataSet).size > 1) {
                dataConflicts.push({
                    txId,
                    versions: versions.map(v => ({
                        node_id: v.node_id,
                        sender: v.sender,
                        receiver: v.receiver,
                        amount: v.amount
                    }))
                });
            }

            // Weight differences (metadata, not conflict)
            const weights = versions.map(v => v.cumulative_weight);
            if (new Set(weights).size > 1) {
                weightDiffs.push({
                    txId,
                    versions: versions.map(v => ({
                        node_id: v.node_id,
                        node_index: v.node_index,
                        cumulative_weight: v.cumulative_weight
                    }))
                });
            }

            // Consensus timestamp differences
            const consensusTimes = versions.map(v => v.consensus_timestamp);
            if (new Set(consensusTimes.filter(t => t != null)).size > 1) {
                consensusDiffs.push({
                    txId,
                    versions: versions.map(v => ({
                        node_id: v.node_id,
                        consensus_timestamp: v.consensus_timestamp
                    }))
                });
            }
        }
    }

    const totalUnique = Object.keys(txByTxId).length;
    const score = totalUnique > 0 ? (fullyReplicated.length / totalUnique) * 100 : 100;

    return {
        fullyReplicated,
        partiallyReplicated,
        parentConflicts,
        signatureConflicts,
        dataConflicts,
        weightDiffs,
        consensusDiffs,
        score: Math.round(score * 100) / 100
    };
}

// GET /api/report/:runId
exports.generateReport = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    const run = await getRunWithParams(runId);
    if (!run) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    const nodes = await listNodes(runId);
    const transactions = await getAllTransactionsByRun(runId);
    const peers = await getPeersByRun(runId);

    // Group transactions by tx_id
    const txByTxId = groupBy(transactions, 'transaction_id');
    const uniqueTxIds = Object.keys(txByTxId);

    // Compute consistency
    const consistency = computeConsistency(txByTxId, nodes);

    // Compute per-node stats
    const txByNode = groupBy(transactions, 'node_id');
    const perNodeStats = nodes.map(n => {
        const nodeTx = txByNode[n.id] || [];
        return {
            node_id: n.id,
            node_index: n.node_index,
            original_node_id: n.original_node_id,
            tx_count: nodeTx.length,
            avg_pow_duration: Math.round(avg(nodeTx.map(t => t.pow_duration))),
            avg_consensus_duration: Math.round(avg(nodeTx.map(t => t.consensus_duration))),
            avg_propagation_delay: Math.round(avg(nodeTx.map(t => t.propagation_delay)))
        };
    });

    // Compute peer stats
    const peersByNode = groupBy(peers, 'node_id');
    const peerStats = nodes.map(n => ({
        node_id: n.id,
        node_index: n.node_index,
        peer_count: (peersByNode[n.id] || []).length
    }));

    const report = {
        generated_at: new Date().toISOString(),
        run: {
            id: run.run_id,
            started_at: run.started_at,
            ended_at: run.ended_at,
            status: run.status,
            params: {
                node_count: run.param_node_count,
                tx_count: run.tx_count,
                tx_delay: run.tx_delay,
                max_peers: run.max_peers,
                pow: run.pow,
                wait: run.wait
            }
        },
        transactions: {
            total_unique: uniqueTxIds.length,
            total_records: transactions.length,
            avg_per_node: nodes.length > 0 ? Math.round(transactions.length / nodes.length) : 0,
            per_node: perNodeStats
        },
        consistency: {
            score: consistency.score,
            fully_replicated_count: consistency.fullyReplicated.length,
            partially_replicated_count: consistency.partiallyReplicated.length,
            partially_replicated: consistency.partiallyReplicated.slice(0, 100), // Limit for response size
            parent_conflicts: consistency.parentConflicts,
            signature_conflicts: consistency.signatureConflicts,
            data_conflicts: consistency.dataConflicts,
            weight_differences_count: consistency.weightDiffs.length,
            consensus_differences_count: consistency.consensusDiffs.length
        },
        consensus: {
            reached_count: transactions.filter(t => t.consensus_timestamp).length,
            reached_percent: transactions.length > 0
                ? Math.round((transactions.filter(t => t.consensus_timestamp).length / transactions.length) * 10000) / 100
                : 0,
            avg_duration_ms: Math.round(avg(transactions.map(t => t.consensus_duration))),
            distribution: computeHistogram(transactions.map(t => t.consensus_duration).filter(d => d != null))
        },
        propagation: {
            avg_delay_ms: Math.round(avg(transactions.map(t => t.propagation_delay))),
            avg_per_hop_ms: Math.round(avg(transactions.map(t => t.avg_propagation_delay))),
            distribution: computeHistogram(transactions.map(t => t.propagation_delay).filter(d => d != null))
        },
        pow: {
            avg_duration_ms: Math.round(avg(transactions.map(t => t.pow_duration))),
            distribution: computeHistogram(transactions.map(t => t.pow_duration).filter(d => d != null))
        },
        network: {
            total_nodes: nodes.length,
            total_peer_records: peers.length,
            avg_peers_per_node: nodes.length > 0 ? Math.round(peers.length / nodes.length) : 0,
            peer_stats: peerStats
        }
    };

    res.status(200).json({
        status: 'success',
        data: report
    });
});

/**
 * GET /api/report/:runId/telemetry
 * Dashboard KPIs + charts endpoint (matches dashboard images)
 */
exports.getTelemetry = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    const run = await getRunWithParams(runId);
    if (!run) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    const nodes = await listNodes(runId);
    const transactions = await getAllTransactionsByRun(runId);
    const peers = await getPeersByRun(runId);

    // Group transactions by tx_id for consistency calculations
    const txByTxId = groupBy(transactions, 'transaction_id');
    const consistency = computeConsistency(txByTxId, nodes);

    // Calculate KPIs
    const distinctTxIds = Object.keys(txByTxId).length;

    // Calculate timing averages
    const avgVerificationMs = Math.round(avg(transactions.map(t => t.verification_duration)));
    const avgPowMs = Math.round(avg(transactions.map(t => t.pow_duration)));
    const avgTsaMs = Math.round(avg(transactions.map(t => t.tsa_duration)));
    const avgCompletionMs = Math.round(avg(transactions.map(t => t.completion_duration)));
    const avgPropagationDelayMs = Math.round(avg(transactions.map(t => t.propagation_delay)));
    const avgPropagationPerHopMs = Math.round(avg(transactions.map(t => t.avg_propagation_delay)));

    // Get chart data
    const charts = await getChartsData(runId);

    res.status(200).json({
        status: 'success',
        data: {
            run: {
                runId: run.run_id,
                status: run.status,
                startedAt: run.started_at,
                endedAt: run.ended_at,
                params: {
                    nodeCount: run.param_node_count,
                    txCount: run.tx_count,
                    txDelay: run.tx_delay,
                    maxPeers: run.max_peers,
                    pow: run.pow,
                    wait: run.wait
                }
            },
            kpis: {
                totalNodes: nodes.length,
                totalTransactionRecords: transactions.length,
                distinctTransactionIds: distinctTxIds,
                fullyReplicatedCount: consistency.fullyReplicated.length,
                partiallyReplicatedCount: consistency.partiallyReplicated.length,
                consistencyScore: consistency.score,
                maxDagDepth: 0, // Calculated below
                genesisWeight: 0, // Calculated below
                avgVerificationMs,
                avgPowMs,
                avgTsaMs,
                avgCompletionMs,
                avgPropagationDelayMs,
                avgPropagationPerHopMs,
                totalPeerRecords: peers.length,
                avgPeersPerNode: nodes.length > 0 ? Math.round(peers.length / nodes.length) : 0
            },
            charts
        }
    });
});

// GET /api/report/:runId/consistency (lightweight version)
exports.getConsistency = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    const run = await getRunWithParams(runId);
    if (!run) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    const nodes = await listNodes(runId);
    const transactions = await getAllTransactionsByRun(runId);

    const txByTxId = groupBy(transactions, 'transaction_id');
    const consistency = computeConsistency(txByTxId, nodes);

    res.status(200).json({
        status: 'success',
        data: {
            run_id: runId,
            total_nodes: nodes.length,
            total_unique_transactions: Object.keys(txByTxId).length,
            consistency_score: consistency.score,
            fully_replicated_count: consistency.fullyReplicated.length,
            partially_replicated_count: consistency.partiallyReplicated.length,
            conflict_counts: {
                parent: consistency.parentConflicts.length,
                signature: consistency.signatureConflicts.length,
                data: consistency.dataConflicts.length
            },
            metadata_diff_counts: {
                weight: consistency.weightDiffs.length,
                consensus: consistency.consensusDiffs.length
            }
        }
    });
});

// GET /api/report/:runId/compare-nodes?nodeA=1&nodeB=2
exports.compareNodes = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    const nodeA = parseInt(req.query.nodeA);
    const nodeB = parseInt(req.query.nodeB);

    if (isNaN(runId) || isNaN(nodeA) || isNaN(nodeB)) {
        return next(new AppError('Invalid runId, nodeA, or nodeB', 400));
    }

    const transactions = await getAllTransactionsByRun(runId);

    // Filter by node index
    const txNodeA = transactions.filter(t => t.node_index === nodeA);
    const txNodeB = transactions.filter(t => t.node_index === nodeB);

    const txIdsA = new Set(txNodeA.map(t => t.transaction_id));
    const txIdsB = new Set(txNodeB.map(t => t.transaction_id));

    const onlyInA = [...txIdsA].filter(id => !txIdsB.has(id));
    const onlyInB = [...txIdsB].filter(id => !txIdsA.has(id));
    const inBoth = [...txIdsA].filter(id => txIdsB.has(id));

    res.status(200).json({
        status: 'success',
        data: {
            run_id: runId,
            node_a: { index: nodeA, tx_count: txNodeA.length },
            node_b: { index: nodeB, tx_count: txNodeB.length },
            comparison: {
                only_in_a: onlyInA.length,
                only_in_b: onlyInB.length,
                in_both: inBoth.length,
                only_in_a_ids: onlyInA.slice(0, 50), // Limit response size
                only_in_b_ids: onlyInB.slice(0, 50)
            }
        }
    });
});

// ========== PYTHON REPORT GENERATION ==========

const dataDir = process.env.DATA_ROOT || path.join(__dirname, '../data');

/**
 * POST /api/report/:runId/generate
 * Spawns Python script to generate Markdown report + charts
 */
exports.generatePythonReport = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    // Confirm run exists
    const run = await getRunWithParams(runId);
    if (!run) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    const outDir = path.join(dataDir, 'reports', `run_${runId}`);

    try {
        await runPythonReport({ runId, outDir });
    } catch (err) {
        return next(new AppError(err.message, 500));
    }

    res.status(200).json({
        status: 'success',
        runId,
        reportUrl: `/api/report/${runId}/generated`,
        generatedAt: new Date().toISOString()
    });
});

/**
 * GET /api/report/:runId/generated
 * Returns the generated Markdown report content
 */
exports.getGeneratedMarkdown = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    const reportPath = path.join(dataDir, 'reports', `run_${runId}`, 'report.md');

    try {
        const content = fs.readFileSync(reportPath, 'utf-8');
        res.type('text/markdown').send(content);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return next(new AppError(`Report not generated yet for run ${runId}`, 404));
        }
        return next(new AppError(`Failed to read report: ${err.message}`, 500));
    }
});
