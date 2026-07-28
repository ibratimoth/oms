const express = require('express');
const router = express.Router();
const debtController = require('../controllers/debtController');
const auth = require('../middleware/auth');

// List All
router.get('/', auth, debtController.getAllDebts);

// Create Operations
router.get('/create', auth, debtController.showCreateDebt);
router.post('/create', auth, debtController.createDebt);

// Quick Status Toggle (Clear Debt / Reopen Debt)
router.get('/toggle-status/:id', auth, debtController.toggleDebtStatus);

// Edit Operations
router.get('/edit/:id', auth, debtController.showEditDebt);
router.post('/edit/:id', auth, debtController.updateDebt);

// Delete Operation
router.get('/delete/:id', auth, debtController.deleteDebt);

module.exports = router;