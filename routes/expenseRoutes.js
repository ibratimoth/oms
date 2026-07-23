const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const auth = require('../middleware/auth');
// List All
router.get('/', auth, expenseController.getAllExpenses);

// Create Operations
router.get('/create', auth, expenseController.showCreateExpense);
router.post('/create', auth, expenseController.createExpense);

// Edit Operations
router.get('/edit/:id', auth, expenseController.showEditExpense);
router.post('/edit/:id', auth, expenseController.updateExpense);

// Delete Operation
router.get('/delete/:id', auth, expenseController.deleteExpense);

module.exports = router;