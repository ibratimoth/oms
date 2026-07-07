const { Business, User, Product, Order, sequelize } = require('../models');
const logger = require('../utils/logger');

exports.getAllBusinesses = async (req, res) => {
  const username = req.session.user?.full_name || 'User'; 
  try {
    const businesses = await Business.findAll({
      order: [['created_at', 'DESC']] 
    });
    
    return res.render('business/index', { businesses, error: null, username, userRole: req.session.user?.role });
  } catch (error) {
    logger.error('Failed to fetch businesses list:', error);
    return res.status(500).render('error', { message: 'Failed to load businesses.', username, userRole: req.session.user?.role });
  }
};

exports.getBusinessById = async (req, res) => {
  const { id } = req.params;
  const username = req.session.user?.full_name || 'User';

  try {
    const business = await Business.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'full_name', 'username', 'role'] }
      ]
    });

    if (!business) {
      logger.warn(`Business with ID ${id} not found.`);
      return res.status(404).render('error', { message: 'Business not found.', username, userRole: req.session.user?.role });
    }

    return res.render('business/view', { business, username, userRole: req.session.user?.role });
  } catch (error) {
    logger.error(`Error fetching business ID ${id}:`, error);
    return res.status(500).render('error', { message: 'Internal server error.', username, userRole: req.session.user?.role });
  }
};

exports.showEditBusiness = async (req, res) => {
  const { id } = req.params;
  const username = req.session.user?.full_name || 'User';
  
  try {
    const business = await Business.findByPk(id);
    if (!business) {
      return res.status(404).render('error', { message: 'Business not found.', username, userRole: req.session.user?.role });
    }
    return res.render('business/edit', { business, error: null, username, userRole: req.session.user?.role });
  } catch (error) {
    return res.status(500).render('error', { message: 'Internal server error.', username, userRole: req.session.user?.role });
  }
};

exports.updateBusiness = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const username = req.session.user?.full_name || 'User';

  if (!name || name.trim() === '') {
    return res.render('business/edit', { 
      business: { id, name }, 
      error: 'Business name cannot be empty.', 
      username, 
      userRole: req.session.user?.role
    });
  }

  try {
    const [updatedRows] = await Business.update(
      { name: name.trim() },
      { where: { id } }
    );

    if (updatedRows === 0) {
      return res.status(404).render('error', { message: 'Business not found or no changes made.', username, userRole: req.session.user?.role });
    }

    logger.info(`Business ID ${id} profile updated to "${name.trim()}"`);
    return res.redirect(`/business/view/${id}`);
  } catch (error) {
    logger.error(`Failed to update business ID ${id}:`, error);
    return res.status(500).render('business/edit', { 
      business: { id, name }, 
      error: 'Failed to update business details.',
      username ,
      userRole: req.session.user?.role
    });
  }
};

exports.deleteBusiness = async (req, res) => {
  const { id } = req.params;
  const username = req.session.user?.full_name || 'User';

  const t = await sequelize.transaction();

  try {
    await User.update(
      { business_id: null },
      { where: { business_id: id }, transaction: t }
    );

    const deletedRows = await Business.destroy({
      where: { id },
      transaction: t
    });

    if (deletedRows === 0) {
      await t.rollback();
      return res.status(404).render('error', { message: 'Business not found.', username, userRole: req.session.user?.role });
    }

    await t.commit();
    logger.info(`Business ID ${id} completely removed from system database storage.`);
    
    if (req.session.user && req.session.user.business_id === id) {
      req.session.user.business_id = null;
    }

    return res.redirect('/businesses');
  } catch (error) {
    await t.rollback();
    logger.error(`Critical failure during removal of business ID ${id}:`, error);
    return res.status(500).render('error', { message: 'Failed to delete business entity.', username, userRole: req.session.user?.role });
  }
};

exports.showCreateBusiness = async (req, res) => {
  const username = req.session.user?.full_name || 'User';
  return res.render('business/create', { error: null, username, userRole: req.session.user?.role });
};

exports.createBusiness = async (req, res) => {
  const { name } = req.body;
  const username = req.session.user?.full_name || 'User';

  if (!name || name.trim() === '') {
    return res.render('business/create', { 
      error: 'Business name cannot be empty.', 
      username, 
      userRole: req.session.user?.role
    });
  }

  try {
    const newBusiness = await Business.create({
      name: name.trim()
    });

    logger.info(`New business entity provisioned successfully: ${newBusiness.name} (ID: ${newBusiness.id})`);
    return res.redirect('/business');
  } catch (error) {
    logger.error(error, 'Failed to register new business:');
    return res.status(500).render('business/create', { 
      error: 'Database rejection: Failed to create business profile.', 
      username,
      userRole: req.session.user?.role
    });
  }
};