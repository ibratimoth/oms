const { Expense, Business, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Helper to fetch allowed businesses for the current session user
const getAccessibleBusinesses = async (userSession) => {
  if (userSession?.business_id) {
    return await Business.findAll({ where: { id: userSession.business_id } });
  }
  return await Business.findAll({ order: [['name', 'ASC']] });
};

exports.getAllExpenses = async (req, res) => {
  const username = req.session.user?.full_name || 'User';
  const businessId = req.session.user?.business_id;

  // Query Params
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  const { single_date, start_date, end_date, category } = req.query;

  // Build Dynamic Where Conditions
  const whereConditions = {};

  if (businessId) {
    whereConditions.business_id = businessId;
  }

  if (category) {
    whereConditions.category = { [Op.like]: `%${category}%` };
  }

  // Date Filtering Logic
  if (single_date) {
    whereConditions.expense_date = single_date;
  } else if (start_date && end_date) {
    whereConditions.expense_date = {
      [Op.between]: [start_date, end_date]
    };
  } else if (start_date) {
    whereConditions.expense_date = {
      [Op.gte]: start_date
    };
  } else if (end_date) {
    whereConditions.expense_date = {
      [Op.lte]: end_date
    };
  }

  try {
    const { count, rows: expenses } = await Expense.findAndCountAll({
      where: whereConditions,
      include: [
        { model: Business, attributes: ['id', 'name'] },
        { model: User, attributes: ['id', 'full_name'] }
      ],
      order: [['expense_date', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    return res.render('expense/index', {
      expenses,
      error: null,
      username,
      userRole: req.session.user?.role,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count,
        limit
      },
      filters: {
        single_date: single_date || '',
        start_date: start_date || '',
        end_date: end_date || '',
        category: category || ''
      }
    });
  } catch (error) {
    logger.error('Failed to fetch filtered expenses list:', error);
    return res.status(500).render('error', {
      message: 'Failed to load expenses.',
      username,
      userRole: req.session.user?.role
    });
  }
};

// Show Create Form (Scoped to user's business)
exports.showCreateExpense = async (req, res) => {
  const username = req.session.user?.full_name || 'User';

  try {
    const businesses = await getAccessibleBusinesses(req.session.user);

    return res.render('expense/create', { 
      businesses, 
      error: null, 
      username, 
      userRole: req.session.user?.role 
    });
  } catch (error) {
    logger.error('Error loading create expense form:', error);
    return res.status(500).render('error', { 
      message: 'Failed to load page.', 
      username, 
      userRole: req.session.user?.role 
    });
  }
};

// Create Expense (Enforces user's business_id)
exports.createExpense = async (req, res) => {
  const { category, amount, description, expense_date, business_id } = req.body;
  const username = req.session.user?.full_name || 'User';
  const userId = req.session.user?.id;

  // Always prioritize session business_id for shop users
  const assignedBusinessId = req.session.user?.business_id || business_id;

  try {
    if (!category || !amount) {
      const businesses = await getAccessibleBusinesses(req.session.user);
      return res.status(400).render('expense/create', { 
        error: 'Category and Amount are required.', 
        businesses, 
        username, 
        userRole: req.session.user?.role 
      });
    }

    await Expense.create({
      category,
      amount,
      description,
      expense_date: expense_date || new Date(),
      business_id: assignedBusinessId,
      created_by: userId
    });

    return res.redirect('/expenses');
  } catch (error) {
    logger.error('Error creating expense:', error);
    return res.status(500).render('error', { 
      message: 'Failed to create expense.', 
      username, 
      userRole: req.session.user?.role 
    });
  }
};

// Show Edit Form (Scoped to user's business)
exports.showEditExpense = async (req, res) => {
  const { id } = req.params;
  const username = req.session.user?.full_name || 'User';
  const businessId = req.session.user?.business_id;

  try {
    const whereCondition = { id };
    if (businessId) whereCondition.business_id = businessId;

    const expense = await Expense.findOne({ where: whereCondition });
    if (!expense) {
      return res.status(404).render('error', { 
        message: 'Expense record not found.', 
        username, 
        userRole: req.session.user?.role 
      });
    }

    const businesses = await getAccessibleBusinesses(req.session.user);

    return res.render('expense/edit', { 
      expense, 
      businesses, 
      error: null, 
      username, 
      userRole: req.session.user?.role 
    });
  } catch (error) {
    logger.error(`Error loading edit form for expense ID ${id}:`, error);
    return res.status(500).render('error', { 
      message: 'Internal server error.', 
      username, 
      userRole: req.session.user?.role 
    });
  }
};

// Update Expense Record
exports.updateExpense = async (req, res) => {
  const { id } = req.params;
  const { category, amount, description, expense_date, business_id } = req.body;
  const userBusinessId = req.session.user?.business_id;

  try {
    const whereCondition = { id };
    if (userBusinessId) whereCondition.business_id = userBusinessId;

    const expense = await Expense.findOne({ where: whereCondition });
    if (!expense) {
      return res.status(404).render('error', { 
        message: 'Expense record not found.', 
        username: req.session.user?.full_name || 'User', 
        userRole: req.session.user?.role 
      });
    }

    await expense.update({
      category,
      amount,
      description,
      expense_date,
      business_id: userBusinessId || business_id
    });

    return res.redirect('/expenses');
  } catch (error) {
    logger.error(`Error updating expense ID ${id}:`, error);
    return res.status(500).render('error', { 
      message: 'Failed to update expense.', 
      username: req.session.user?.full_name || 'User', 
      userRole: req.session.user?.role 
    });
  }
};

// Delete Expense Record
exports.deleteExpense = async (req, res) => {
  const { id } = req.params;
  const businessId = req.session.user?.business_id;

  try {
    const whereCondition = { id };
    if (businessId) whereCondition.business_id = businessId;

    const expense = await Expense.findOne({ where: whereCondition });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    await expense.destroy();
    return res.redirect('/expenses');
  } catch (error) {
    logger.error(`Error deleting expense ID ${id}:`, error);
    return res.status(500).render('error', { 
      message: 'Failed to delete expense record.', 
      username: req.session.user?.full_name || 'User', 
      userRole: req.session.user?.role 
    });
  }
};