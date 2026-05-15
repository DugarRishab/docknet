// central/routes/queueRoutes.js
const express = require('express');
const {
	addQueue,
	bulkAddQueue,
	listQueue,
	removeQueue,
	updateQueue,
	reorderQueue,
	startNow,
	preempt
} = require('../controllers/queueController');

const router = express.Router();

// Queue CRUD
router.post('/', addQueue);
router.post('/bulk', bulkAddQueue);
router.get('/', listQueue);
router.patch('/:id', updateQueue);
router.delete('/:id', removeQueue);
router.patch('/reorder', reorderQueue);

// Queue control
router.post('/start-now', startNow);
router.post('/preempt', preempt);

module.exports = router;
