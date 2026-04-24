const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const {
    checkRunExists,
    listNodes,
    getPeersByRun,
    getPeersByNodeId,
    getMetricsByNodeId,
    getNodeDetailsWithCounts
} = require('../utils/db');

/**
 * Get peer network topology
 * Aggregates peer connections from all nodes and builds a graph from database
 */
exports.getPeerTopology = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    // Check if run exists in database
    const runExists = await checkRunExists(runId);
    if (!runExists) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    // Get all peers for this run from database
    const peersData = await getPeersByRun(runId);

    // Get all nodes for this run from database
    const nodesData = await listNodes(runId);

    // Build topology graph with directed edges
    const nodes = new Map(); // nodeId -> { id, label, peers, stats }
    const edges = []; // directed edges array

    // Initialize nodes from database nodes
    for (const node of nodesData) {
        const nodeId = node.original_node_id;
        if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
                id: nodeId,
                label: nodeId,
                peerCount: 0,
                connectedPeers: [],
                state: 'unknown'
            });
        }
    }

    // Process peer connections (directed edges)
    const seenEdges = new Set();
    for (const peer of peersData) {
        const sourceNodeId = peer.source_node_id;
        const peerNodeId = peer.peer_node_id;
        const peerState = peer.state;

        // Ensure source node exists
        if (!nodes.has(sourceNodeId)) {
            nodes.set(sourceNodeId, {
                id: sourceNodeId,
                label: sourceNodeId,
                peerCount: 0,
                connectedPeers: [],
                state: 'unknown'
            });
        }

        const node = nodes.get(sourceNodeId);

        // Add peer to node's connected peers
        node.connectedPeers.push({
            id: peerNodeId,
            state: peerState,
            address: peer.peer_address,
            port: peer.peer_port,
            uri: peer.peer_uri
        });
        node.peerCount = node.connectedPeers.length;

        // Create directed edge (source -> target)
        const edgeKey = `${sourceNodeId}->${peerNodeId}`;
        if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            edges.push({
                source: sourceNodeId,
                target: peerNodeId,
                state: peerState,
                connectionTime: peer.connected_at ? new Date(peer.connected_at).getTime() : Date.now()
            });
        }

        // Ensure peer node exists (even if we haven't seen it as a source)
        if (!nodes.has(peerNodeId)) {
            nodes.set(peerNodeId, {
                id: peerNodeId,
                label: peerNodeId,
                peerCount: 0,
                connectedPeers: [],
                state: 'unknown'
            });
        }

        // Update node state based on connected peers
        const connectedCount = node.connectedPeers.filter(p => p.state === 1 || p.state === 'connected').length;
        node.state = connectedCount > 0 ? 'connected' : 'disconnected';
    }

    // Calculate statistics
    const nodeArray = Array.from(nodes.values());

    const totalNodes = nodeArray.length;
    const totalConnections = edges.length;
    const avgConnections = totalNodes > 0 ? totalConnections / totalNodes : 0;

    // Find nodes with highest connectivity
    const sortedByPeers = [...nodeArray].sort((a, b) => b.peerCount - a.peerCount);
    const mostConnected = sortedByPeers.slice(0, 5);

    res.status(200).json({
        status: 'success',
        data: {
            nodes: nodeArray,
            edges,
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
 * Get live node status with health metrics from database
 */
exports.getNodeStatus = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    if (isNaN(runId)) {
        return next(new AppError('Invalid runId', 400));
    }

    // Check if run exists in database
    const runExists = await checkRunExists(runId);
    if (!runExists) {
        return res.status(200).json({
            status: 'success',
            data: {
                runId,
                nodes: [],
                totalNodes: 0,
                healthyNodes: 0,
                unhealthyNodes: 0
            }
        });
    }

    // Get all nodes with their counts from database
    const nodeDetails = await getNodeDetailsWithCounts(runId);

    const nodeStatuses = [];

    for (const node of nodeDetails) {
        const status = {
            nodeId: node.original_node_id,
            hasTangle: node.transaction_count > 0,
            hasPeers: node.peer_count > 0,
            hasMetrics: node.has_metrics > 0,
            lastUpdated: node.created_at,
            transactionCount: node.transaction_count,
            peerCount: node.peer_count,
            health: 'unknown'
        };

        // Determine health based on database data
        if (status.hasTangle && status.hasPeers) {
            status.health = status.transactionCount > 0 ? 'healthy' : 'idle';
        } else if (status.hasTangle || status.hasPeers) {
            status.health = 'partial';
        } else {
            status.health = 'unhealthy';
        }

        nodeStatuses.push(status);
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
 * Get node details: peers and latest metrics
 * GET /api/peers/runs/:runId/nodes/:nodeIndex
 */
exports.getNodeDetails = catchAsync(async (req, res, next) => {
    const runId = parseInt(req.params.runId);
    const nodeIndex = parseInt(req.params.nodeIndex);

    if (isNaN(runId) || isNaN(nodeIndex)) {
        return next(new AppError('Invalid runId or nodeIndex', 400));
    }

    // Check if run exists in database
    const runExists = await checkRunExists(runId);
    if (!runExists) {
        return next(new AppError(`Run ${runId} not found`, 404));
    }

    // Get all nodes for this run to find the database node ID
    const nodes = await listNodes(runId);
    const node = nodes.find(n => n.node_index === nodeIndex);

    if (!node) {
        return next(new AppError(`Node ${nodeIndex} not found in run ${runId}`, 404));
    }

    // Get peers for this node from database
    const peers = await getPeersByNodeId(node.id);

    // Get metrics history for this node from database (last 50 samples)
    const metrics = await getMetricsByNodeId(node.id, 50);

    // Transform peers to match expected format
    const formattedPeers = peers.map(p => ({
        id: p.peer_node_id,
        address: p.peer_address,
        port: p.peer_port,
        uri: p.peer_uri,
        state: p.state,
        connectionTime: p.connected_at ? new Date(p.connected_at).getTime() : null
    }));

    // Transform metrics to match expected format
    const formattedMetrics = metrics.map(m => ({
        ts: m.ts,
        cpu_percent: m.cpu_percent,
        ram_total_mb: m.ram_total_mb,
        ram_used_mb: m.ram_used_mb,
        net_bytes_sent: m.net_bytes_sent,
        net_bytes_recv: m.net_bytes_recv
    }));

    res.status(200).json({
        status: 'success',
        data: {
            nodeId: node.original_node_id,
            nodeIndex,
            peers: formattedPeers,
            metrics: formattedMetrics,
            timestamp: Date.now()
        }
    });
});
