const { Merchant } = require('../models');
const { Op } = require('sequelize');

// GET /merchants - List all merchants for the business
exports.getAllMerchants = async (req, res) => {
  const username = req.session.user?.full_name;
  const userRole = req.session.user?.role;

  try {
    const business_id = req.session.user.business_id;
    const { search, status } = req.query;

    let whereClause = { business_id };

    if (status === 'active') {
      whereClause.is_active = true;
    } else if (status === 'inactive') {
      whereClause.is_active = false;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { account_number: { [Op.iLike]: `%${search}%` } },
        { provider: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const merchants = await Merchant.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    // Check if JSON request (API/AJAX) or HTML View
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, data: merchants });
    }

    return res.render('merchants/index', {
      merchants,
      search: search || '',
      statusFilter: status || 'all',
      username,
      userRole
    });

  } catch (err) {
    console.error('Error fetching merchants:', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Failed to retrieve merchants' });
    }
    return res.status(500).render('error', {
      message: 'Failed to load merchants directory',
      username,
      userRole
    });
  }
};

// POST /merchants - Create a new merchant / Lipa channel
exports.createMerchant = async (req, res) => {
  try {
    const business_id = req.session.user.business_id;
    const { name, account_number, provider } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Merchant name is required'
      });
    }

    const merchant = await Merchant.create({
      name: name.trim(),
      account_number: account_number ? account_number.trim() : null,
      provider: provider ? provider.trim() : null,
      is_active: true,
      business_id
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(201).json({
        success: true,
        message: 'Merchant account registered successfully',
        data: merchant
      });
    }

    return res.redirect('/merchants');

  } catch (err) {
    console.error('Error creating merchant:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to register merchant account'
    });
  }
};

// PUT /merchants/:id - Update merchant details
exports.updateMerchant = async (req, res) => {
  try {
    const business_id = req.session.user.business_id;
    const { id } = req.params;
    const { name, account_number, provider, is_active } = req.body;

    const merchant = await Merchant.findOne({
      where: { id, business_id }
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    await merchant.update({
      name: name !== undefined ? name.trim() : merchant.name,
      account_number: account_number !== undefined ? account_number.trim() : merchant.account_number,
      provider: provider !== undefined ? provider.trim() : merchant.provider,
      is_active: is_active !== undefined ? Boolean(is_active) : merchant.is_active
    });

    return res.json({
      success: true,
      message: 'Merchant updated successfully',
      data: merchant
    });

  } catch (err) {
    console.error('Error updating merchant:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update merchant'
    });
  }
};

// PATCH /merchants/:id/toggle - Quick toggle active status
exports.toggleMerchantStatus = async (req, res) => {
  try {
    const business_id = req.session.user.business_id;
    const { id } = req.params;

    const merchant = await Merchant.findOne({
      where: { id, business_id }
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    await merchant.update({ is_active: !merchant.is_active });

    return res.json({
      success: true,
      message: `Merchant status changed to ${merchant.is_active ? 'Active' : 'Inactive'}`,
      is_active: merchant.is_active
    });

  } catch (err) {
    console.error('Error toggling merchant status:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
};

// DELETE /merchants/:id - Delete a merchant record
exports.deleteMerchant = async (req, res) => {
  try {
    const business_id = req.session.user.business_id;
    const { id } = req.params;

    const merchant = await Merchant.findOne({
      where: { id, business_id }
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    await merchant.destroy();

    return res.json({
      success: true,
      message: 'Merchant account removed successfully'
    });

  } catch (err) {
    console.error('Error deleting merchant:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete merchant (it may be linked to existing orders)'
    });
  }
};

// Render creation form
exports.renderCreateForm = (req, res) => {
  res.render('merchants/create', {
    username: req.session.user?.full_name,
    userRole: req.session.user?.role
  });
};

// Render edit form
exports.renderEditForm = async (req, res) => {
  try {
    const merchant = await Merchant.findOne({
      where: { id: req.params.id, business_id: req.session.user.business_id }
    });
    if (!merchant) return res.redirect('/merchants');

    res.render('merchants/edit', {
      merchant,
      username: req.session.user?.full_name,
      userRole: req.session.user?.role
    });
  } catch (err) {
    res.redirect('/merchants');
  }
};