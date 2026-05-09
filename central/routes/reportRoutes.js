// central/routes/reportRoutes.js
const express = require('express');
const {
    generateReport,
    getTelemetry,
    getConsistency,
    compareNodes,
    generatePythonReport,
    getGeneratedMarkdown,
    getGeneratedMarkdownBundle,
    // Multi-run reports
    queryRunsByFilters,
    generateMultiRunReport,
    getMultiRunReportStatus,
    getMultiRunReport,
    listMultiRunReports,
    deleteMultiRunReport
} = require('../controllers/reportController');

const router = express.Router();

// ========== MULTI-RUN REPORTS (must come before :runId catch-all) ==========

// Query runs by filters (for selecting runs before analysis)
router.get('/runs/filter', queryRunsByFilters);

// List all multi-run reports
router.get('/multi', listMultiRunReports);

// Generate new multi-run report
router.post('/multi/generate', generateMultiRunReport);

// Check report generation status
router.get('/multi/:reportId/status', getMultiRunReportStatus);

// Get multi-run report content
router.get('/multi/:reportId', getMultiRunReport);

// Delete a multi-run report
router.delete('/multi/:reportId', deleteMultiRunReport);

// ========== SINGLE-RUN REPORTS ==========

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
router.get('/:runId/generated/bundle', getGeneratedMarkdownBundle);

module.exports = router;
