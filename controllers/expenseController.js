const { Expense, Business, User } = require('../models');
const { Op, fn, col } = require('sequelize');
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
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
  const offset = (page - 1) * limit;

  const {
    single_date,
    start_date,
    end_date,
    category,
    entry_type,
    affects_profit
  } = req.query;

  // Build Dynamic Where Conditions
  const whereConditions = {};

  if (businessId) {
    whereConditions.business_id = businessId;
  }

  if (category) {
    whereConditions.category = { [Op.iLike]: `%${category.trim()}%` };
  }

  if (entry_type && ['OPERATING_EXPENSE', 'RESTOCK_INVENTORY'].includes(entry_type)) {
    whereConditions.entry_type = entry_type;
  }

  if (affects_profit === 'true' || affects_profit === 'false') {
    whereConditions.affects_profit = affects_profit === 'true';
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
    const [paginatedResult, summaryRows] = await Promise.all([
      Expense.findAndCountAll({
        where: whereConditions,
        include: [
          { model: Business, attributes: ['id', 'name'] },
          { model: User, attributes: ['id', 'full_name'] }
        ],
        order: [['expense_date', 'DESC'], ['created_at', 'DESC']],
        limit,
        offset
      }),
      Expense.findAll({
        where: whereConditions,
        attributes: [
          'entry_type',
          'affects_profit',
          [fn('COALESCE', fn('SUM', col('amount')), 0), 'total']
        ],
        group: ['entry_type', 'affects_profit'],
        raw: true
      })
    ]);

    const { count, rows: expenses } = paginatedResult;
    const totalPages = Math.ceil(count / limit);

    let totalCashOutflow = 0;
    let operatingExpenseTotal = 0;
    let restockTotal = 0;

    for (const row of summaryRows) {
      const amountNum = parseFloat(row.total) || 0;
      totalCashOutflow += amountNum;

      if (row.entry_type === 'RESTOCK_INVENTORY' || row.affects_profit === false) {
        restockTotal += amountNum;
      } else {
        operatingExpenseTotal += amountNum;
      }
    }

    return res.render('expense/index', {
      expenses,
      error: null,
      username,
      userRole: req.session.user?.role,
      summary: {
        totalCashOutflow,
        operatingExpenseTotal,
        restockTotal
      },
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
        category: category || '',
        entry_type: entry_type || '',
        affects_profit: affects_profit || ''
      }
    });
  } catch (error) {
    //logger.error('Failed to fetch filtered expenses list:', error);
    console.error('Failed to fetch filtered expenses list:', error);
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
  const requestedType = req.query.type;
  const defaultEntryType = ['OPERATING_EXPENSE', 'RESTOCK_INVENTORY'].includes(requestedType)
    ? requestedType
    : 'OPERATING_EXPENSE';

  try {
    const businesses = await getAccessibleBusinesses(req.session.user);

    return res.render('expense/create', {
      businesses,
      error: null,
      username,
      userRole: req.session.user?.role,
      entryTypes: [
        {
          value: 'OPERATING_EXPENSE',
          label: 'Operating Expense (Deducts from Profit)',
          affectsProfit: true
        },
        {
          value: 'RESTOCK_INVENTORY',
          label: 'Restock Inventory (Does Not Deduct from Profit)',
          affectsProfit: false
        }
      ],
      formData: {
        entry_type: defaultEntryType,
        affects_profit: defaultEntryType !== 'RESTOCK_INVENTORY'
      }
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

const ENTRY_TYPES = [
  {
    value: 'OPERATING_EXPENSE',
    label: 'Operating Expense (Deducts from Profit)',
    affectsProfit: true
  },
  {
    value: 'RESTOCK_INVENTORY',
    label: 'Restock Inventory (Does Not Deduct from Profit)',
    affectsProfit: false
  }
];

exports.createExpense = async (req, res) => {
  const {
    category,
    amount,
    description,
    expense_date,
    business_id,
    entry_type
  } = req.body;
  const username = req.session.user?.full_name || 'User';
  const userId = req.session.user?.id;

  // Always prioritize session business_id for shop users
  const assignedBusinessId = req.session.user?.business_id || business_id;

  const normalizedEntryType = ['OPERATING_EXPENSE', 'RESTOCK_INVENTORY'].includes(entry_type)
    ? entry_type
    : 'OPERATING_EXPENSE';

  const affectsProfit = normalizedEntryType !== 'RESTOCK_INVENTORY';
  const numericAmount = Number(amount);

  try {
    if (!category || !category.trim() || !amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      const businesses = await getAccessibleBusinesses(req.session.user);
      return res.status(400).render('expense/create', {
        error: 'Category and a valid positive Amount are required.',
        businesses,
        username,
        userRole: req.session.user?.role,
        entryTypes: ENTRY_TYPES,
        formData: {
          category: category || '',
          amount: amount || '',
          description: description || '',
          expense_date: expense_date || '',
          business_id: assignedBusinessId || '',
          entry_type: normalizedEntryType,
          affects_profit: affectsProfit
        }
      });
    }

    await Expense.create({
      entry_type: normalizedEntryType,
      affects_profit: affectsProfit,
      category: category.trim(),
      amount: numericAmount,
      description: description ? description.trim() : null,
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
      entryTypes: ENTRY_TYPES,
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
  const {
    category,
    amount,
    description,
    expense_date,
    business_id,
    entry_type
  } = req.body;
  const username = req.session.user?.full_name || 'User';
  const userBusinessId = req.session.user?.business_id;

  try {
    const whereCondition = { id };
    if (userBusinessId) whereCondition.business_id = userBusinessId;

    const expense = await Expense.findOne({ where: whereCondition });
    if (!expense) {
      return res.status(404).render('error', {
        message: 'Expense record not found.',
        username,
        userRole: req.session.user?.role
      });
    }

    const nextEntryType = ['OPERATING_EXPENSE', 'RESTOCK_INVENTORY'].includes(entry_type)
      ? entry_type
      : (expense.entry_type || 'OPERATING_EXPENSE');

    const nextAffectsProfit = nextEntryType !== 'RESTOCK_INVENTORY';
    const numericAmount = Number(amount);

    if (!category || !category.trim() || !amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      const businesses = await getAccessibleBusinesses(req.session.user);
      return res.status(400).render('expense/edit', {
        expense: {
          ...expense.toJSON(),
          category: category ?? expense.category,
          amount: amount ?? expense.amount,
          description: description ?? expense.description,
          expense_date: expense_date || expense.expense_date,
          entry_type: nextEntryType,
          affects_profit: nextAffectsProfit
        },
        businesses,
        entryTypes: ENTRY_TYPES,
        error: 'Category and a valid positive Amount are required.',
        username,
        userRole: req.session.user?.role
      });
    }

    await expense.update({
      entry_type: nextEntryType,
      affects_profit: nextAffectsProfit,
      category: category.trim(),
      amount: numericAmount,
      description: description !== undefined ? (description ? description.trim() : null) : expense.description,
      expense_date: expense_date || expense.expense_date,
      business_id: userBusinessId || business_id || expense.business_id
    });

    return res.redirect('/expenses');
  } catch (error) {
    logger.error(`Error updating expense ID ${id}:`, error);
    return res.status(500).render('error', {
      message: 'Failed to update expense.',
      username,
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