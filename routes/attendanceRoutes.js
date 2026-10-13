const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
// Assuming you have an authentication middleware
const  isAuthenticated  = require('../middleware/auth'); 
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'superadmin' || req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).render('error', { 
    message: 'Access Denied: authorization tier required.', 
    username: req.session.user?.full_name || 'Operator' 
  });
};

// Clock-in / Clock-out actions
router.post('/sign-in', isAuthenticated, attendanceController.signIn);
router.post('/sign-out', isAuthenticated, attendanceController.signOut);

// View today's attendance for the business
router.get('/', isAuthenticated, attendanceController.getTodayAttendance);

// View user attendance report over a custom period
router.get('/report', isAuthenticated, isAdmin, attendanceController.getUserAttendanceByPeriod);

module.exports = router;