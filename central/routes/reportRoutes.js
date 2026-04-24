// central/routes/reportRoutes.js
const express = require('express');
const {
    generateReport,
    getTelemetry,
    getConsistency,
    compareNodes,
    generatePythonReport,
    getGeneratedMarkdown
} = require('../controllers/reportController');

const router = express.Router();

// Full analysis report
router.get('/:runId', generateReport);

// Dashboard telemetry endpoint (KPIs + charts)
router.get('/:runId/telemetry', getTelemetry);

// Lightweight consistency check
router.get('/:runId/consistency', getConsistency);

// Compare two specific nodes
router.get('/:runId/compare-nodes', compareNodes);

// Python-generated Markdown report endpoints
router.post('/:runId/generate', generatePythonReport);
router.get('/:runId/generated', getGeneratedMarkdown);

module.exports = router;
