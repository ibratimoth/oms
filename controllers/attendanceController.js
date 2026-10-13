const { Attendance, User } = require('../models');
const { Op } = require('sequelize');

// Sign in (Arriving at work)
exports.signIn = async (req, res) => {
  const userId = req.session.user?.id;
  const businessId = req.session.user?.business_id;
  const username = req.session.user?.full_name || 'User';

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Check if already signed in today without signing out
    const existingAttendance = await Attendance.findOne({
      where: {
        user_id: userId,
        sign_in: { [Op.gte]: startOfDay },
        sign_out: null
      }
    });

    if (existingAttendance) {
      return res.status(400).render('error', { message: 'You have already signed in today.', username, userRole: req.session.user?.role });
    }

    await Attendance.create({
      business_id: businessId,
      user_id: userId,
      sign_in: new Date()
    });

    return res.redirect('/attendance');
  } catch (error) {
    console.error('Failed to sign in:', error);
    return res.status(500).render('error', { message: 'Failed to record sign-in.', username, userRole: req.session.user?.role });
  }
};

// Sign out (Leaving work)
exports.signOut = async (req, res) => {
  const userId = req.session.user?.id;
  const username = req.session.user?.full_name || 'User';

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      where: {
        user_id: userId,
        sign_in: { [Op.gte]: startOfDay },
        sign_out: null
      }
    });

    if (!attendance) {
      return res.status(400).render('error', { message: 'No active sign-in found for today.', username, userRole: req.session.user?.role });
    }

    attendance.sign_out = new Date();
    await attendance.save();

    return res.redirect('/attendance');
  } catch (error) {
    console.error('Failed to sign out:', error);
    return res.status(500).render('error', { message: 'Failed to record sign-out.', username, userRole: req.session.user?.role });
  }
};

// View today's attendance for the business
// exports.getTodayAttendance = async (req, res) => {
//   const userId = req.session.user?.id;
//   const username = req.session.user?.full_name || 'User';

//   try {
//     const startOfDay = new Date();
//     startOfDay.setHours(0, 0, 0, 0);

//     const endOfDay = new Date();
//     endOfDay.setHours(23, 59, 59, 999);

//     const attendances = await Attendance.findAll({
//       where: {
//         user_id: userId,
//         sign_in: { [Op.between]: [startOfDay, endOfDay] }
//       },
//       include: [{ model: User, attributes: ['id', 'full_name', 'username', 'role'] }],
//       order: [['sign_in', 'DESC']]
//     });

//     return res.render('attendance/today', { attendances, username, userRole: req.session.user?.role, error: null });
//   } catch (error) {
//     console.error('Failed to fetch today attendance:', error);
//     return res.status(500).render('error', { message: 'Failed to load today attendance.', username, userRole: req.session.user?.role });
//   }
// };

// View today's attendance for the business
exports.getTodayAttendance = async (req, res) => {
  const userId = req.session.user?.id;
  const businessId = req.session.user?.business_id;
  const username = req.session.user?.full_name || 'User';

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Fetch today's attendance records for the entire business
    const attendances = await Attendance.findAll({
      where: {
        user_id: userId,
        sign_in: { [Op.between]: [startOfDay, endOfDay] }
      },
      include: [{ model: User, attributes: ['id', 'full_name', 'username', 'role'] }],
      order: [['sign_in', 'DESC']]
    });

    // 2. Check the logged-in user's active status for today
    const currentUserAttendance = attendances.find(att => att.user_id === userId);

    const hasSignedInToday = !!currentUserAttendance;
    const hasSignedOutToday = !!(currentUserAttendance && currentUserAttendance.sign_out);

    // 3. Render page with button state flags
    return res.render('attendance/today', { 
      attendances, 
      hasSignedInToday,
      hasSignedOutToday,
      username, 
      userRole: req.session.user?.role, 
      currentPath: '/attendance',
      error: req.query.error || null 
    });
  } catch (error) {
    console.error('Failed to fetch today attendance:', error);
    return res.status(500).render('error', { message: 'Failed to load today attendance.', username, userRole: req.session.user?.role });
  }
};

// View user attendance within any period of time
exports.getUserAttendanceByPeriod = async (req, res) => {
  const { userId, startDate, endDate } = req.query;
  const businessId = req.session.user?.business_id;
  const username = req.session.user?.full_name || 'User';

  try {
    const targetUserId = userId || req.session.user?.id;
    
    let whereClause = {
      business_id: businessId,
      user_id: targetUserId
    };

    if (startDate && endDate) {
      whereClause.sign_in = {
        [Op.between]: [new Date(startDate), new Date(`${endDate} 23:59:59`)]
      };
    }

    const attendances = await Attendance.findAll({
      where: whereClause,
      include: [{ model: User, attributes: ['id', 'full_name', 'username'] }],
      order: [['sign_in', 'DESC']]
    });

    const users = await User.findAll({ 
      where: { business_id: businessId }, 
      attributes: ['id', 'full_name'] 
    });

    return res.render('attendance/report', { 
      attendances, 
      users, 
      selectedUserId: targetUserId, 
      startDate: startDate || '', 
      endDate: endDate || '', 
      username, 
      userRole: req.session.user?.role, 
      error: null 
    });
  } catch (error) {
    console.error('Failed to fetch user attendance report:', error);
    return res.status(500).render('error', { message: 'Failed to load attendance report.', username, userRole: req.session.user?.role });
  }
};