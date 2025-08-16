// central/controllers/workerController.js

const Docker = require("dockerode");
const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const SHARED_VOLUME = "program-files";

async function startWorkers(req, res) {
	const { node_count, tx_count, tx_delay, max_peers, pow } = req.query;
	if (!node_count || node_count < 1) return res.status(400).send("Invalid node_count");

	if (!tx_count || tx_count < 1) return res.status(400).send("Invalid tx_count");
	if (!tx_delay || tx_delay < 0) return res.status(400).send("Invalid tx_delay");
	if (!max_peers || max_peers < 1) return res.status(400).send("Invalid max_peers");

	if (pow && (pow < 1 || pow > 5)) 
		return res.status(400).send("Invalid POW difficulty, must be between 1 and 5");

	try {
		// Remove all existing worker containers
		const existing = await docker.listContainers({
			all: true,
			filters: { name: ["^docknet-worker"] },
		});

		await Promise.all(
			existing.map((c) =>
				docker.getContainer(c.Id).remove({ force: true })
			)
		);

		// Launch new workers
		const promises = [];
		for (let i = 1; i <= node_count; i++) {
			const name = `docknet-worker-${i}`;
			promises.push(
				docker
					.createContainer({
						name,
						Image: "docknet/worker:latest",
						Env: [
							`NODE_ID=worker${i}`,
							`CENTRAL_WS=ws://localhost:8000/worker`,
							`REPO_URL=https://github.com/DugarRishab/tangle-sg`, // passed into entrypoint
							`REPO_BRANCH=monitor`,
							`TX_COUNT=${tx_count}`,
							`TX_DELAY=${tx_delay}`,
							`MAX_PEERS=${max_peers}`,
							`POW=${pow || 3}`, // Default POW difficulty is 3
						],
						HostConfig: {
							NetworkMode: "docknet_docknet",
							Binds: [`${SHARED_VOLUME}:/app/program:ro`],
						},
					})
					.then((container) => container.start())
			);
		}

		await Promise.all(promises);
		res.status(200).json({ message: `${node_count} workers started` });
	} catch (err) {
		console.error("Error starting workers:", err);
		res.status(500).json({ error: err.message });
	}
}

module.exports = { startWorkers };
