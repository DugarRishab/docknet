// central/controllers/workerController.js
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const { saveTelemetryBatch, getOrCreateRun, insertRunParams } = require('../utils/db');
const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const SHARED_VOLUME = 'program-files';

exports.startWorkers = catchAsync(async (req, res, next) => {
    const { node_count, tx_count, tx_delay, max_peers, pow, run, wait } =
        req.query;
    if (!node_count || node_count < 1)
        return next(new AppError('Invalid node_count', 400));

    if (!tx_count || tx_count < 1)
        return next(new AppError('Invalid tx_count', 400));
    if (!tx_delay || tx_delay < 0)
        return next(new AppError('Invalid tx_delay', 400));
    if (!max_peers || max_peers < 1)
        return next(new AppError('Invalid max_peers', 400));
    if (pow && (pow < 1 || pow > 5))
        return next(new AppError('Invalid pow difficulty, must be 1-5', 400));

    // Remove all existing worker containers
    const existing = await docker.listContainers({
        all: true,
        filters: { name: ['^docknet-worker'] },
    });

    await Promise.all(
        existing.map((c) => docker.getContainer(c.Id).remove({ force: true }))
    );

    // Launch new workers
    const promises = [];
    for (let i = 1; i <= node_count; i++) {
        const name = `docknet-worker-${i}`;
        promises.push(
            docker
                .createContainer({
                    name,
                    Image: 'docknet/worker:latest',
                    Env: [
                        `NODE_ID=worker${i}`,
                        `TELEMETRY_ENDPOINT=http://172.25.0.10:8000/api/telemetry`,
                        `REPO_URL=https://github.com/DugarRishab/tangle-sg`, // passed into entrypoint
                        `REPO_BRANCH=monitor`,
                        `TX_COUNT=${tx_count}`,
                        `TX_DELAY=${tx_delay}`,
                        `MAX_PEERS=${max_peers}`,
                        `POW=${pow || 3}`, // Default POW difficulty is 3
                        `RUN_ID=${run || 0}`,
                        `WAIT_PERIOD=${wait || 300}`, // Default wait period is 300 seconds
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

    // Save run parameters to database
    try {
        const runRecord = await getOrCreateRun(parseInt(run) || 0);
        await insertRunParams(parseInt(run) || 0, {
            node_count: parseInt(node_count),
            tx_count: parseInt(tx_count),
            tx_delay: parseInt(tx_delay),
            max_peers: parseInt(max_peers),
            pow: parseInt(pow) || 3,
            wait: parseInt(wait) || 300
        });
        console.log(`[startWorkers] Saved run params for run ${runRecord.run_id}`);
    } catch (err) {
        console.error('[startWorkers] Failed to save run params:', err);
    }

    res.status(200).json({
        message: `${node_count} workers started`,
        runId: parseInt(run) || 0
    });
});

exports.uploadTelemetry = catchAsync(async (req, res, next) => {
    const { nodeId, nodeIP, tangle, peers, metrics, runId } = req.body;
    if (!nodeId || !tangle || !peers || !metrics) {
        return next(new AppError('Missing required telemetry data', 400));
    }

    console.log(`[telemetry] Received from node: ${nodeId}, run: ${runId || 0}`);
    console.log('[telemetry] Content-Length:', req.headers['content-length']);

    try {
        // Save to SQLite database
        const result = await saveTelemetryBatch(
            runId || 0,
            nodeId,
            nodeIP || null,
            { tangle, peers, metrics }
        );

        console.log(`[telemetry] Saved to SQL: run_id=${result.run.run_id}, node_index=${result.node.node_index}`);

        return res.status(200).json({
            message: 'success',
            runId: result.run.run_id,
            nodeIndex: result.node.node_index,
            originalNodeId: result.node.original_node_id
        });
    } catch (error) {
        console.error('[telemetry] Error saving to SQL:', error);
        return next(new AppError(`Failed to save telemetry: ${error.message}`, 500));
    }
});
