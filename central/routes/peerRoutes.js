const express = require('express');
const {
    getPeerTopology,
    getNodeStatus,
    getPeerHistory
} = require('../controllers/peerController');

const router = express.Router();

// Get peer network topology
router.get('/topology', getPeerTopology);

// Get live node status
router.get('/nodes/status', getNodeStatus);

// Get peer history for a specific node
router.get('/history', getPeerHistory);

module.exports = router;
