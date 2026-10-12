const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
// Assuming you have an authentication middleware
const  isAuthenticated  = require('../middleware/auth'); 

// Clock-in / Clock-out actions
router.post('/sign-in', isAuthenticated, attendanceController.signIn);
router.post('/sign-out', isAuthenticated, attendanceController.signOut);

// View today's attendance for the business
router.get('/', isAuthenticated, attendanceController.getTodayAttendance);

// View user attendance report over a custom period
router.get('/report', isAuthenticated, attendanceController.getUserAttendanceByPeriod);

module.exports = router;