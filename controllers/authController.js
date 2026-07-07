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
    role: user.role
  };

  return res.redirect('/dashboard');
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};

exports.showRegister = async (req, res) => {
  const username = req.session.user?.full_name || 'Admin';
  
  try {
    const businesses = await Business.findAll({
      order: [['name', 'ASC']]
    });
    
    return res.render('auth/register', { 
      error: null, 
      success: null, 
      businesses, 
      username,
      userRole: req.session.user?.role
    });
  } catch (error) {
    logger.error(error, 'Failed to load registration dependencies');
    return res.status(500).render('error', { 
      message: 'Failed to open user registration panel.', 
      username ,
      userRole: req.session.user?.role
    });
  }
};

exports.register = async (req, res) => {
  const { full_name, username: accountUsername, password, role, business_id } = req.body;
  const username = req.session.user?.full_name || 'Admin';

  const businesses = await Business.findAll({ order: [['name', 'ASC']] });

  if (!full_name || !accountUsername || !password || !role) {
    return res.render('auth/register', { 
      error: 'All fields except Business Assignment are required.', 
      success: null, 
      businesses, 
      username 
    });
  }

  try {
    const existingUser = await User.findOne({ where: { username: accountUsername.trim() } });
    if (existingUser) {
      return res.render('auth/register', { 
        error: `Username "${accountUsername}" is already taken.`, 
        success: null, 
        businesses, 
        username 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      full_name: full_name.trim(),
      username: accountUsername.trim().toLowerCase(),
      password: hashedPassword,
      role,
      business_id: (business_id && business_id !== 'none') ? business_id : null
    });

    logger.info(`User identity created successfully: ${newUser.username} linked to Business ID: ${newUser.business_id || 'None (Global)'}`);

    return res.render('auth/register', { 
      error: null, 
      success: `Account for ${newUser.full_name} has been provisioned successfully!`, 
      businesses, 
      username 
    });

  } catch (error) {
    logger.error(error, 'User creation transaction rejected');
    return res.status(500).render('auth/register', { 
      error: 'Database rejection: Failed to create user record.', 
      success: null, 
      businesses, 
      username 
    });
  }
};