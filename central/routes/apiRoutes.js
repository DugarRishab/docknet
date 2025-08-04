// central/routes/apiRoutes.js

const express = require("express");
const router = express.Router();
const { getRecentTelemetry } = require("../utils/db");
const { startWorkers } = require("../controllers/workerController");

// GET /api/latest - Return the latest N telemetry entries
router.get("/latest", async (req, res) => {
	try {
		const limit = parseInt(req.query.limit) || 20; // ?limit=50
		const data = await getRecentTelemetry(limit);
		res.json({ success: true, data });
	} catch (err) {
		console.error("Failed to fetch telemetry:", err.message);
		res.status(500).json({
			success: false,
			error: "Internal Server Error",
		});
	}
});

router.get("/start", startWorkers);

module.exports = router;
