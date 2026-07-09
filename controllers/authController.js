const bcrypt = require('bcrypt');
const { User, Business } = require('../models');
const logger = require('./../utils/logger');

exports.showLogin = (req, res) => {
  res.render('auth/login');
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  console.log(req.body);

  const user = await User.findOne({ where: { username } });

  if (!user) {
    return res.render('auth/login', { error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.render('auth/login', { error: 'Invalid credentials' });
  }

  req.session.user = {
    id: user.id,
    full_name: user.full_name,
    role: user.role,
    business_id: user.business_id
  };

  console.log(`user session: ${JSON.stringify(req.session.user)}`);
  return res.redirect('/dashboard');
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};

exports.showSuperadminRegister = async (req, res) => {
  const username = req.session.user?.full_name || 'Superadmin';
  try {
    const businesses = await Business.findAll({ order: [['name', 'ASC']] });
    return res.render('auth/superadmin-register', {
      error: null,
      success: null,
      businesses,
      username,
      userRole: req.session.user?.role
    });
  } catch (error) {
    logger.error(error, 'Failed to load superadmin view dependencies');
    return res.status(500).render('error', { message: 'Failed to load panel.', username });
  }
};

exports.superadminRegister = async (req, res) => {
  const { full_name, username: accountUsername, password, business_id } = req.body;
  const username = req.session.user?.full_name || 'Superadmin';
  const userRole = req.session.user?.role;

  const businesses = await Business.findAll({ order: [['name', 'ASC']] });

  if (!full_name || !accountUsername || !password || !business_id || business_id === 'none') {
    return res.render('auth/superadmin-register', {
      error: 'You must select an explicit Business/Shop branch to assign this Administrator to.',
      success: null, businesses, username, userRole
    });
  }

  try {
    const existingUser = await User.findOne({ where: { username: accountUsername.trim() } });
    if (existingUser) {
      return res.render('auth/superadmin-register', {
        error: `Username "${accountUsername}" is already taken.`, success: null, businesses, username, userRole
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await User.create({
      full_name: full_name.trim(),
      username: accountUsername.trim().toLowerCase(),
      password: hashedPassword,
      role: 'admin', // Superadmin explicitly births 'admin' users
      business_id
    });

    logger.info(`Superadmin provisioned Business Admin Manager: ${newAdmin.username} for Business ID: ${newAdmin.business_id}`);
    return res.render('auth/superadmin-register', {
      error: null, success: `Business Admin profile for ${newAdmin.full_name} created successfully!`, businesses, username, userRole
    });
  } catch (error) {
    logger.error(error, 'Superadmin registration database insertion failed');
    return res.status(500).render('auth/superadmin-register', { error: 'Database exception occurred during provisioning.', success: null, businesses, username, userRole });
  }
};

// ==========================================
// 2. BUSINESS ADMIN WORKSPACE (Creates Branch Staff)
// ==========================================

exports.showAdminRegisterStaff = async (req, res) => {
  const username = req.session.user?.full_name || 'Admin';
  try {
    const activeBusiness = await Business.findByPk(req.session.user.business_id);
    return res.render('auth/admin-register-staff', {
      error: null,
      success: null,
      businessName: activeBusiness ? activeBusiness.name : 'Your Assigned Branch',
      username,
      userRole: req.session.user?.role
    });
  } catch (error) {
    logger.error(error, 'Failed to resolve business scope context');
    return res.status(500).render('error', { message: 'Internal system tracking exception.', username });
  }
};

exports.adminRegisterStaff = async (req, res) => {
  const { full_name, username: accountUsername, password, role } = req.body;
  const username = req.session.user?.full_name || 'Admin';
  const userRole = req.session.user?.role;
  const adminBusinessId = req.session.user.business_id;

  try {
    const activeBusiness = await Business.findByPk(adminBusinessId);
    const businessName = activeBusiness ? activeBusiness.name : 'Your Assigned Branch';

    if (!full_name || !accountUsername || !password || !role) {
      return res.render('auth/admin-register-staff', {
        error: 'All fields are strictly required.', success: null, businessName, username, userRole
      });
    }

    const existingUser = await User.findOne({ where: { username: accountUsername.trim() } });
    if (existingUser) {
      return res.render('auth/admin-register-staff', {
        error: `Username "${accountUsername}" is already taken.`, success: null, businessName, username, userRole
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newStaff = await User.create({
      full_name: full_name.trim(),
      username: accountUsername.trim().toLowerCase(),
      password: hashedPassword,
      role, // 'sales_officer' or 'store_officer'
      business_id: adminBusinessId // Bound strictly to the current admin's company branch
    });

    logger.info(`Admin created staff member: ${newStaff.username} bound to Business ID: ${adminBusinessId}`);
    return res.render('auth/admin-register-staff', {
      error: null, success: `Employee profile for ${newStaff.full_name} is now active inside ${businessName}!`, businessName, username, userRole
    });
  } catch (error) {
    logger.error(error, 'Admin staff registration transaction rejected');
    return res.status(500).render('auth/admin-register-staff', { error: 'Failed to create branch account profile.', success: null, businessName: 'Your Branch', username, userRole });
  }
};

exports.listUsers = async (req, res) => {
  const username = req.session.user?.full_name || 'Operator';
  const { role: userRole, business_id: adminBusinessId } = req.session.user;

  try {
    let users;
    let businesses = [];

    if (userRole === 'superadmin') {
      users = await User.findAll({
        include: [{ model: Business, as: 'Business', attributes: ['name'] }],
        order: [['createdAt', 'DESC']]
      });
      businesses = await Business.findAll({ order: [['name', 'ASC']] });
    } else {
      // Regular Admin only sees users matching their business_id, excluding superadmins
      users = await User.findAll({
        where: { business_id: adminBusinessId },
        include: [{ model: Business, as: 'Business', attributes: ['name'] }],
        order: [['createdAt', 'DESC']]
      });

      businesses = await Business.findAll({
        where: { id: adminBusinessId }
      });
    }

    console.log(`businesses fetched for user directory: ${JSON.stringify(businesses)}`);

    return res.render('auth/users-list', {
      users,
      businesses,
      username,
      userRole,
      error: req.query.error || null,
      success: req.query.success || null,
      currentPath: '/users'
    });
  } catch (error) {
    logger.error(error, 'Failed to fetch user directory entries');
    return res.status(500).render('error', { message: 'Could not load user list directory.', username });
  }
};

// ==========================================
// UPDATE USER RECORD
// ==========================================
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, username, role, business_id } = req.body;
  const currentAdmin = req.session.user;

  try {
    const targetUser = await User.findByPk(id);
    if (!targetUser) {
      return res.redirect('/auth/users?error=User+not+found.');
    }

    // Role Enforcement Guards
    if (currentAdmin.role !== 'superadmin') {
      // Branch admins cannot touch users outside their business, or change their business lines
      if (targetUser.business_id !== currentAdmin.business_id) {
        return res.redirect('/auth/users?error=Unauthorized+access+boundary.');
      }
      // Branch admins cannot elevate staff to superadmin/admin roles
      if (role === 'superadmin' || role === 'admin') {
        return res.redirect('/auth/users?error=Action+denied:+Cannot+assign+administrative+roles.');
      }
    }

    // Process safely
    targetUser.full_name = full_name.trim();
    targetUser.username = username.trim().toLowerCase();

    if (currentAdmin.role === 'superadmin') {
      targetUser.role = role;
      targetUser.business_id = business_id === 'none' ? null : business_id;
    } else {
      targetUser.role = role; // Limited to sales_officer / store_officer via client constraints
    }

    await targetUser.save();
    logger.info(`User record ID ${id} modified by ${currentAdmin.username}`);
    return res.redirect('/auth/users?success=User+profile+updated+successfully.');
  } catch (error) {
    logger.error(error, `Failed executing modification for user profile ID ${id}`);
    return res.redirect('/auth/users?error=Failed+to+update+user+record.');
  }
};

// ==========================================
// DELETE USER RECORD
// ==========================================
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const currentAdmin = req.session.user;

  try {
    const targetUser = await User.findByPk(id);
    if (!targetUser) {
      return res.redirect('/auth/users?error=User+not+found.');
    }

    // Guard against suicide loop
    if (targetUser.id === currentAdmin.id) {
      return res.redirect('/auth/users?error=You+cannot+remove+your+own+active+profile.');
    }

    // Boundary Isolation Guard
    if (currentAdmin.role !== 'superadmin' && targetUser.business_id !== currentAdmin.business_id) {
      return res.redirect('/auth/users?error=Unauthorized+access+boundary.');
    }

    await targetUser.destroy();
    logger.info(`Account entity deleted successfully: ${targetUser.username} removed by ${currentAdmin.username}`);
    return res.redirect('/auth/users?success=User+profile+deleted+successfully.');
  } catch (error) {
    logger.error(error, `Failed execution sequence removing user account ID ${id}`);
    return res.redirect('/auth/users?error=Failed+to+purge+user+identity.');
  }
};