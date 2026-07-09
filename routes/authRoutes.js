const router = require('express').Router();
const authController = require('../controllers/authController');

router.get('/', authController.showLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

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

// Superadmin Exclusive Endpoints
router.get('/superadmin/register', isAuthenticated, isSuperadmin, authController.showSuperadminRegister);
router.post('/superadmin/register', isAuthenticated, isSuperadmin, authController.superadminRegister);

// Branch Admin Endpoints
router.get('/admin/register-staff', isAuthenticated, isBranchAdmin, authController.showAdminRegisterStaff);
router.post('/admin/register-staff', isAuthenticated, isBranchAdmin, authController.adminRegisterStaff);

// Add these below your registration pathways
router.get('/users', isAuthenticated, authController.listUsers);
router.post('/users/update/:id', isAuthenticated, authController.updateUser);
router.post('/users/delete/:id', isAuthenticated, authController.deleteUser);

module.exports = router;