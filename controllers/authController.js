const bcrypt = require('bcrypt');
const { User } = require('../models');
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