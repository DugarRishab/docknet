const express = require('express');
const {
    getAllTangle,
    getTransactionById,
    getTransactionHops,
    compareTransactions,
    getRunSummary
} = require('../controllers/tangleController');

const router = express.Router();

// Get aggregated tangle from all nodes
router.get('/all', getAllTangle);

// Get single transaction by ID
router.get('/:txId', getTransactionById);

// Get hop history for a transaction
router.get('/:txId/hops', getTransactionHops);

// Compare multiple transactions
router.get('/compare/transactions', compareTransactions);

// Get run summary
router.get('/runs/:runId/summary', getRunSummary);

module.exports = router;
