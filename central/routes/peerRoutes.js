const express = require('express');
const {
    getPeerTopology,
    getNodeStatus,
    getNodeDetails
} = require('../controllers/peerController');

const router = express.Router();

// Get peer network topology for a run
router.get('/topology', getPeerTopology);

// Get live node status for a run
router.get('/runs/:runId/nodes/status', getNodeStatus);

// Get node details (peers + metrics) for a specific node
router.get('/runs/:runId/nodes/:nodeIndex', getNodeDetails);

module.exports = router;
