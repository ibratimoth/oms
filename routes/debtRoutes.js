const express = require('express');
const router = express.Router();
const debtController = require('../controllers/debtController');

// List All
router.get('/', debtController.getAllDebts);

// Create Operations
router.get('/create', debtController.showCreateDebt);
router.post('/create', debtController.createDebt);

// Quick Status Toggle (Clear Debt / Reopen Debt)
router.post('/toggle-status/:id', debtController.toggleDebtStatus);

// Edit Operations
router.get('/edit/:id', debtController.showEditDebt);
router.post('/edit/:id', debtController.updateDebt);

// Delete Operation
router.post('/delete/:id', debtController.deleteDebt);

module.exports = router;