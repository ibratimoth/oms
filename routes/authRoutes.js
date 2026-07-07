const router = require('express').Router();
const authController = require('../controllers/authController');

router.get('/', authController.showLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).render('error', { 
    message: 'Access Denied: Administrative privileges required.',
    username: req.session.user?.full_name || 'User'
  });
};

router.get('/register', isAdmin, authController.showRegister);
router.post('/register', isAdmin, authController.register);

module.exports = router;