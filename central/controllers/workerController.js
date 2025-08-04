// central/controllers/workerController.js

const Docker = require("dockerode");
const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const SHARED_VOLUME = "program-files";

async function startWorkers(req, res) {
	const { count } = req.query;
	if (!count || count < 1) return res.status(400).send("Invalid count");

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
		for (let i = 1; i <= count; i++) {
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
		res.status(200).json({ message: `${count} workers started` });
	} catch (err) {
		console.error("Error starting workers:", err);
		res.status(500).json({ error: err.message });
	}
}

module.exports = { startWorkers };
