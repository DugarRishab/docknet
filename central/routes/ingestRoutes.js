// central/routes/ingestRoutes.js
const express = require('express');
const {
    uploadTelemetry
} = require('../controllers/simulationController');

const router = express.Router();

// POST /api/ingest/telemetry
router.post('/telemetry', uploadTelemetry);

module.exports = router;
