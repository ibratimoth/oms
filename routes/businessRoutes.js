const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');

const isAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  return res.redirect('/login');
};

// Check for explicit superadmin authority string
const isSuperadmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).render('error', { 
    message: 'Access Denied: Superadmin authorization tier required.', 
    username: req.session.user?.full_name || 'Operator' 
  });
};

// Check for explicit branch admin manager authority string
const isBranchAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).render('error', { 
    message: 'Access Denied: Administrative privileges required.', 
    username: req.session.user?.full_name || 'Operator' 
  });
};

// List All
router.get('/', isAuthenticated, isSuperadmin, businessController.getAllBusinesses);

// Create Operations (Place above /:id routes)
router.get('/create', isAuthenticated, isSuperadmin, businessController.showCreateBusiness);
router.post('/create', isAuthenticated, isSuperadmin, businessController.createBusiness);

// View One
router.get('/view/:id', isAuthenticated, businessController.getBusinessById);

// Update Operations
router.get('/edit/:id', isAuthenticated, isSuperadmin,businessController.showEditBusiness);
router.post('/edit/:id', isAuthenticated, isSuperadmin, businessController.updateBusiness);

// Delete Operation
router.get('/delete/:id', isAuthenticated, isSuperadmin, businessController.deleteBusiness);

module.exports = router;