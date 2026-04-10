const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const path = require('path');
const fs = require('fs').promises;
const glob = require('glob');
const { promisify } = require('util');

const globPromise = promisify(glob);

/**
 * Get peer network topology
 * Aggregates peer connections from all nodes and builds a graph
 */
exports.getPeerTopology = catchAsync(async (req, res, next) => {
    const { runId = 0 } = req.query;
    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data');
    const runDir = path.join(DATA_ROOT, `run${runId}`);

    try {
        await fs.access(runDir);
    } catch {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    // Find all peers.json files
    const pattern = path.join(runDir, '*/peers.json');
    const peersFiles = await globPromise(pattern);

    if (peersFiles.length === 0) {
        return res.status(200).json({
            status: 'success',
            data: {
                nodes: [],
                edges: [],
                stats: {
                    totalNodes: 0,
                    totalConnections: 0,
                    avgConnections: 0
                }
            }
        });
    }

    // Build topology graph
    const nodes = new Map(); // nodeId -> { id, label, peers, stats }
    const edges = new Map(); // "source->target" -> { source, target, metrics }

    for (const file of peersFiles) {
        const nodeId = path.basename(path.dirname(file));

        try {
            const content = await fs.readFile(file, 'utf-8');
            const peers = JSON.parse(content);

            if (!nodes.has(nodeId)) {
                nodes.set(nodeId, {
                    id: nodeId,
                    label: nodeId,
                    peerCount: 0,
                    connectedPeers: [],
                    state: 'unknown'
                });
            }

            const node = nodes.get(nodeId);

            if (Array.isArray(peers)) {
                node.peerCount = peers.length;
                
                for (const peer of peers) {
                    const peerId = peer.id;
                    const peerState = peer.state;
                    
                    node.connectedPeers.push({
                        id: peerId,
                        state: peerState,
                        address: peer.address,
                        port: peer.port
                    });

                    // Create edge (undirected for now)
                    const edgeKey = [nodeId, peerId].sort().join('->');
                    if (!edges.has(edgeKey)) {
                        edges.set(edgeKey, {
                            source: nodeId,
                            target: peerId,
                            state: peerState,
                            connectionTime: peer.connectionTime || Date.now()
                        });
                    }

                    // Ensure peer node exists (even if we haven't seen its file)
                    if (!nodes.has(peerId)) {
                        nodes.set(peerId, {
                            id: peerId,
                            label: peerId,
                            peerCount: 0,
                            connectedPeers: [],
                            state: 'unknown'
                        });
                    }
                }
            }

            // Update node state based on peers
            const connectedCount = peers.filter(p => p.state === 1 || p.state === 'connected').length;
            node.state = connectedCount > 0 ? 'connected' : 'disconnected';

        } catch (err) {
            console.error(`Error reading ${file}:`, err.message);
        }
    }

    // Calculate statistics
    const nodeArray = Array.from(nodes.values());
    const edgeArray = Array.from(edges.values());

    const totalNodes = nodeArray.length;
    const totalConnections = edgeArray.length;
    const avgConnections = totalNodes > 0 ? totalConnections / totalNodes : 0;

    // Find nodes with highest connectivity
    const sortedByPeers = [...nodeArray].sort((a, b) => b.peerCount - a.peerCount);
    const mostConnected = sortedByPeers.slice(0, 5);

    res.status(200).json({
        status: 'success',
        data: {
            nodes: nodeArray,
            edges: edgeArray,
            stats: {
                totalNodes,
                totalConnections,
                avgConnections: Math.round(avgConnections * 100) / 100,
                mostConnectedNodes: mostConnected.map(n => ({ id: n.id, peerCount: n.peerCount }))
            }
        }
    });
});

/**
 * Get live node status with health metrics
 */
exports.getNodeStatus = catchAsync(async (req, res, next) => {
    const { runId = 0 } = req.query;
    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data');
    const runDir = path.join(DATA_ROOT, `run${runId}`);

    const nodeStatuses = [];

    try {
        const entries = await fs.readdir(runDir, { withFileTypes: true });
        const nodeDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

        for (const nodeId of nodeDirs) {
            const nodeDir = path.join(runDir, nodeId);
            const status = {
                nodeId,
                hasTangle: false,
                hasPeers: false,
                hasMetrics: false,
                lastUpdated: null,
                transactionCount: 0,
                peerCount: 0,
                health: 'unknown'
            };

            try {
                // Check tangle.json
                const tanglePath = path.join(nodeDir, 'tangle.json');
                const tangleStat = await fs.stat(tanglePath).catch(() => null);
                if (tangleStat) {
                    status.hasTangle = true;
                    status.lastUpdated = tangleStat.mtime;
                    const tangle = JSON.parse(await fs.readFile(tanglePath, 'utf-8'));
                    status.transactionCount = Array.isArray(tangle) ? tangle.length : 0;
                }

                // Check peers.json
                const peersPath = path.join(nodeDir, 'peers.json');
                const peersStat = await fs.stat(peersPath).catch(() => null);
                if (peersStat) {
                    status.hasPeers = true;
                    const peers = JSON.parse(await fs.readFile(peersPath, 'utf-8'));
                    status.peerCount = Array.isArray(peers) ? peers.length : 0;
                }

                // Check metrics.json
                const metricsPath = path.join(nodeDir, 'metrics.json');
                status.hasMetrics = !!(await fs.stat(metricsPath).catch(() => null));

                // Determine health
                if (status.hasTangle && status.hasPeers) {
                    status.health = status.transactionCount > 0 ? 'healthy' : 'idle';
                } else if (status.hasTangle || status.hasPeers) {
                    status.health = 'partial';
                } else {
                    status.health = 'unhealthy';
                }

                nodeStatuses.push(status);
            } catch (err) {
                console.error(`Error checking status for ${nodeId}:`, err.message);
            }
        }
    } catch (err) {
        // Run directory doesn't exist yet
    }

    res.status(200).json({
        status: 'success',
        data: {
            runId,
            nodes: nodeStatuses,
            totalNodes: nodeStatuses.length,
            healthyNodes: nodeStatuses.filter(n => n.health === 'healthy').length,
            unhealthyNodes: nodeStatuses.filter(n => n.health === 'unhealthy').length
        }
    });
});

/**
 * Get peer connection history over time
 */
exports.getPeerHistory = catchAsync(async (req, res, next) => {
    const { runId = 0, nodeId } = req.query;
    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data');
    const runDir = path.join(DATA_ROOT, `run${runId}`);

    if (!nodeId) {
        return next(new AppError('Please provide a nodeId', 400));
    }

    const nodeDir = path.join(runDir, nodeId);
    const peersPath = path.join(nodeDir, 'peers.json');
    const metricsPath = path.join(nodeDir, 'metrics.json');

    try {
        // Read peers data
        const peersContent = await fs.readFile(peersPath, 'utf-8');
        const peers = JSON.parse(peersContent);

        // Try to read metrics for historical data
        let metrics = [];
        try {
            const metricsContent = await fs.readFile(metricsPath, 'utf-8');
            metrics = JSON.parse(metricsContent);
        } catch {}

        res.status(200).json({
            status: 'success',
            data: {
                nodeId,
                peers: peers || [],
                metrics: metrics.slice(-50), // Last 50 samples
                timestamp: Date.now()
            }
        });
    } catch (err) {
        return next(new AppError(`No peer data found for node ${nodeId}`, 404));
    }
});
