// central/routes/dashboardRoutes.js
const express = require('express');
const {
    getSummary,
    getHeatmap
} = require('../controllers/dashboardController');

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', getSummary);

// GET /api/dashboard/heatmap
router.get('/heatmap', getHeatmap);

module.exports = router;
