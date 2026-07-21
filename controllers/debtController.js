const { Debt, Business, Order } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Helper to fetch allowed businesses for the current session user
const getAccessibleBusinesses = async (userSession) => {
  if (userSession?.business_id) {
    return await Business.findAll({ where: { id: userSession.business_id } });
  }
  return await Business.findAll({ order: [['name', 'ASC']] });
};

exports.getAllDebts = async (req, res) => {
  const username = req.session.user?.full_name || 'User';
  const businessId = req.session.user?.business_id;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  const { single_date, start_date, end_date, type, status, search } = req.query;

  const whereConditions = {};

  if (businessId) {
    whereConditions.business_id = businessId;
  }

  if (type) {
    whereConditions.type = type;
  }

  if (status) {
    whereConditions.status = status;
  }

  if (search) {
    whereConditions.person_name = { [Op.like]: `%${search}%` };
  }

  if (single_date) {
    const startOfDay = new Date(`${single_date}T00:00:00.000Z`);
    const endOfDay = new Date(`${single_date}T23:59:59.999Z`);
    whereConditions.created_at = {
      [Op.between]: [startOfDay, endOfDay]
    };
  } else if (start_date && end_date) {
    const start = new Date(`${start_date}T00:00:00.000Z`);
    const end = new Date(`${end_date}T23:59:59.999Z`);
    whereConditions.created_at = {
      [Op.between]: [start, end]
    };
  } else if (start_date) {
    whereConditions.created_at = {
      [Op.gte]: new Date(`${start_date}T00:00:00.000Z`)
    };
  } else if (end_date) {
    whereConditions.created_at = {
      [Op.lte]: new Date(`${end_date}T23:59:59.999Z`)
    };
  }

  try {
    const { count, rows: debts } = await Debt.findAndCountAll({
      where: whereConditions,
      include: [
        { model: Business, attributes: ['id', 'name'] },
        { model: Order, attributes: ['id', 'order_number'] }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    return res.render('debt/index', {
      debts,
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
        type: type || '',
        status: status || '',
        search: search || ''
      }
    });
  } catch (error) {
    logger.error('Failed to fetch filtered debts list:', error);
    return res.status(500).render('error', {
      message: 'Failed to load debts.',
      username,
      userRole: req.session.user?.role
    });
  }
};

// Show Create Form (Scoped to user's business)
exports.showCreateDebt = async (req, res) => {
  const username = req.session.user?.full_name || 'User';

  try {
    const businesses = await getAccessibleBusinesses(req.session.user);

    return res.render('debt/create', { 
      businesses, 
      error: null, 
      username, 
      userRole: req.session.user?.role 
    });
  } catch (error) {
    logger.error('Error loading create debt form:', error);
    return res.status(500).render('error', { 
      message: 'Failed to load page.', 
      username, 
      userRole: req.session.user?.role 
    });
  }
};

// Create Debt / Customer Credit (Enforces user's business_id)
exports.createDebt = async (req, res) => {
  const { person_name, phone_number, type, amount, notes, order_id, business_id } = req.body;
  const username = req.session.user?.full_name || 'User';
  
  // Always prioritize session business_id for shop users
  const assignedBusinessId = req.session.user?.business_id || business_id;

  try {
    if (!person_name || !type || !amount) {
      const businesses = await getAccessibleBusinesses(req.session.user);
      return res.status(400).render('debt/create', { 
        error: 'Person Name, Type, and Amount are required.', 
        businesses, 
        username, 
        userRole: req.session.user?.role 
      });
    }

    await Debt.create({
      person_name,
      phone_number,
      type,
      amount,
      notes,
      order_id: order_id || null,
      business_id: assignedBusinessId,
      status: 'PENDING'
    });

    return res.redirect('/debts');
  } catch (error) {
    logger.error('Error creating debt record:', error);
    return res.status(500).render('error', { 
      message: 'Failed to record debt.', 
      username, 
      userRole: req.session.user?.role 
    });
  }
};

// Toggle Debt Status (PENDING <-> CLEARED)
exports.toggleDebtStatus = async (req, res) => {
  const { id } = req.params;
  const businessId = req.session.user?.business_id;

  try {
    const whereCondition = { id };
    if (businessId) whereCondition.business_id = businessId;

    const debt = await Debt.findOne({ where: whereCondition });
    if (!debt) {
      return res.status(404).render('error', { 
        message: 'Debt record not found.', 
        username: req.session.user?.full_name || 'User', 
        userRole: req.session.user?.role 
      });
    }

    const newStatus = debt.status === 'PENDING' ? 'CLEARED' : 'PENDING';
    await debt.update({ status: newStatus });

    return res.redirect('/debts');
  } catch (error) {
    logger.error(`Error clearing debt ID ${id}:`, error);
    return res.status(500).render('error', { 
      message: 'Failed to update debt status.', 
      username: req.session.user?.full_name || 'User', 
      userRole: req.session.user?.role 
    });
  }
};

// Show Edit Form (Scoped to user's business)
exports.showEditDebt = async (req, res) => {
  const { id } = req.params;
  const username = req.session.user?.full_name || 'User';
  const businessId = req.session.user?.business_id;

  try {
    const whereCondition = { id };
    if (businessId) whereCondition.business_id = businessId;

    const debt = await Debt.findOne({ where: whereCondition });
    if (!debt) {
      return res.status(404).render('error', { 
        message: 'Debt record not found.', 
        username, 
        userRole: req.session.user?.role 
      });
    }

    const businesses = await getAccessibleBusinesses(req.session.user);

    return res.render('debt/edit', { 
      debt, 
      businesses, 
      error: null, 
      username, 
      userRole: req.session.user?.role 
    });
  } catch (error) {
    logger.error(`Error loading edit form for debt ID ${id}:`, error);
    return res.status(500).render('error', { 
      message: 'Internal server error.', 
      username, 
      userRole: req.session.user?.role 
    });
  }
};

// Update Debt Record
exports.updateDebt = async (req, res) => {
  const { id } = req.params;
  const { person_name, phone_number, type, amount, status, notes, business_id } = req.body;
  const userBusinessId = req.session.user?.business_id;

  try {
    const whereCondition = { id };
    if (userBusinessId) whereCondition.business_id = userBusinessId;

    const debt = await Debt.findOne({ where: whereCondition });
    if (!debt) {
      return res.status(404).render('error', { 
        message: 'Debt record not found.', 
        username: req.session.user?.full_name || 'User', 
        userRole: req.session.user?.role 
      });
    }

    await debt.update({
      person_name,
      phone_number,
      type,
      amount,
      status,
      notes,
      business_id: userBusinessId || business_id
    });

    return res.redirect('/debts');
  } catch (error) {
    logger.error(`Error updating debt ID ${id}:`, error);
    return res.status(500).render('error', { 
      message: 'Failed to update debt.', 
      username: req.session.user?.full_name || 'User', 
      userRole: req.session.user?.role 
    });
  }
};

// Delete Debt Record
exports.deleteDebt = async (req, res) => {
  const { id } = req.params;
  const businessId = req.session.user?.business_id;

  try {
    const whereCondition = { id };
    if (businessId) whereCondition.business_id = businessId;

    const debt = await Debt.findOne({ where: whereCondition });
    if (!debt) {
      return res.status(404).json({ success: false, message: 'Debt record not found.' });
    }

    await debt.destroy();
    return res.redirect('/debts');
  } catch (error) {
    logger.error(`Error deleting debt ID ${id}:`, error);
    return res.status(500).render('error', { 
      message: 'Failed to delete debt record.', 
      username: req.session.user?.full_name || 'User', 
      userRole: req.session.user?.role 
    });
  }
};