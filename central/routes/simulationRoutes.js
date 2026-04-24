// central/routes/simulationRoutes.js
const express = require('express');
const {
    startSimulation
} = require('../controllers/simulationController');

const router = express.Router();

// POST /api/simulations/start
router.post('/start', startSimulation);

module.exports = router;
