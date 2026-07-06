const { Business, User, Product, Order, sequelize } = require('../models');
const logger = require('../utils/logger');

exports.getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.findAll({
      order: [['created_at', 'DESC']]
    });
    
    return res.render('business/index', { businesses, error: null });
  } catch (error) {
    logger.error('Failed to fetch businesses list:', error);
    return res.status(500).render('error', { message: 'Failed to load businesses.' });
  }
};

exports.getBusinessById = async (req, res) => {
  const { id } = req.params;

  try {
    const business = await Business.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'full_name', 'username', 'role'] }
      ]
    });

    if (!business) {
      logger.warn(`Business with ID ${id} not found.`);
      return res.status(404).render('error', { message: 'Business not found.' });
    }

    return res.render('business/view', { business });
  } catch (error) {
    logger.error(`Error fetching business ID ${id}:`, error);
    return res.status(500).render('error', { message: 'Internal server error.' });
  }
};

exports.showEditBusiness = async (req, res) => {
  const { id } = req.params;
  
  try {
    const business = await Business.findByPk(id);
    if (!business) {
      return res.status(404).render('error', { message: 'Business not found.' });
    }
    return res.render('business/edit', { business, error: null });
  } catch (error) {
    return res.status(500).render('error', { message: 'Internal server error.' });
  }
};

exports.updateBusiness = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.render('business/edit', { 
      business: { id, name }, 
      error: 'Business name cannot be empty.' 
    });
  }

  try {
    const [updatedRows] = await Business.update(
      { name: name.trim() },
      { where: { id } }
    );

    if (updatedRows === 0) {
      return res.status(404).render('error', { message: 'Business not found or no changes made.' });
    }

    logger.info(`Business ID ${id} profile updated to "${name.trim()}"`);
    return res.redirect(`/businesses/view/${id}`);
  } catch (error) {
    logger.error(`Failed to update business ID ${id}:`, error);
    return res.status(500).render('business/edit', { 
      business: { id, name }, 
      error: 'Failed to update business details.' 
    });
  }
};

exports.deleteBusiness = async (req, res) => {
  const { id } = req.params;

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
      return res.status(404).render('error', { message: 'Business not found.' });
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
    return res.status(500).render('error', { message: 'Failed to delete business entity.' });
  }
};