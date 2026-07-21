const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');

// List All
router.get('/', expenseController.getAllExpenses);

// Create Operations
router.get('/create', expenseController.showCreateExpense);
router.post('/create', expenseController.createExpense);

// Edit Operations
router.get('/edit/:id', expenseController.showEditExpense);
router.post('/edit/:id', expenseController.updateExpense);

// Delete Operation
router.post('/delete/:id', expenseController.deleteExpense);

module.exports = router;