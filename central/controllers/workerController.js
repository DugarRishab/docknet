// central/controllers/workerController.js
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const { saveArrayToFile, saveJsonToFile } = require('../utils/saveFIle');
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');

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
                        `CENTRAL_WS=ws://localhost:8000/worker`,
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
    res.status(200).json({ message: `${node_count} workers started` });
});

exports.uploadTelemetry = catchAsync(async (req, res, next) => {
    const DATA_ROOT = process.env.DATA_ROOT || path.resolve('./data'); // data/runX/nodeY/...
    fs.mkdirSync(DATA_ROOT, { recursive: true });

    const { nodeId, tangle, peers, metrics, runId } = req.body;
    if (!nodeId || !tangle || !peers || !metrics) {
        return next(new AppError('Missing required telemetry data', 400));
    }

    const run = `run${runId || 0}`;

    const runDir = path.join(DATA_ROOT, run, nodeId);
    await fs.promises.mkdir(runDir, { recursive: true });

    // Save arrays to CSV files
    const saved = {};
    // tangle -> tangle.csv
    saved.tangle = await saveJsonToFile(
        tangle,
        path.join(runDir, 'tangle.json')
    );
    // peers -> peers.csv
    saved.peers = await saveJsonToFile(peers, path.join(runDir, 'peers.json'));
    // metrics -> metrics.csv
    saved.metrics = await saveJsonToFile(
        metrics,
        path.join(runDir, 'metrics.json')
    );

    if (req.body.metadata) {
        const meta = Object.assign({}, req.body.metadata || {}, {
            node_id: nodeId,
            run_id: run,
            ts_received: new Date().toISOString(),
            saved,
		});
		
        await saveJsonToFile(meta, path.join(runDir, 'metadata.json'));
    }

    return res.status(200).json({ message: 'success', run, nodeId, saved });
});
