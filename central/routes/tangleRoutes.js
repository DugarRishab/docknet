const express = require('express');
const {
    getAllTangle,
    getTransactionById,
    getTransactionHops,
    compareTransactions,
    getRunSummary,
    listRuns,
    listNodes,
    getNodeTangle,
    deleteRun
} = require('../controllers/tangleController');

const router = express.Router();

// List all runs
router.get('/runs', listRuns);

// List nodes for a run
router.get('/runs/:runId/nodes', listNodes);

// Get run summary
router.get('/runs/:runId/summary', getRunSummary);

// Get full tangle for a specific node
router.get('/runs/:runId/nodes/:nodeIndex', getNodeTangle);

// Get aggregated tangle from all nodes
router.get('/all', getAllTangle);

// Compare multiple transactions
router.get('/compare/transactions', compareTransactions);

// Get single transaction by ID
router.get('/runs/:runId/tx/:txId', getTransactionById);

// Get hop history for a transaction
router.get('/runs/:runId/tx/:txId/hops', getTransactionHops);

// Delete a run and all associated data
router.delete('/runs/:runId', deleteRun);

module.exports = router;
