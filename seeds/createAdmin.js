const bcrypt = require('bcrypt');
const { User } = require('../models');

(async () => {
  try {
    const existing = await User.findOne({ where: { username: 'admin@delle' } });

    if (existing) {
      console.log('User already exists');
      return;
    }

    await User.create({
      full_name: 'ibrahimu',
      username: 'admin@delle',
      password: await bcrypt.hash('admin@123', 10),
      role: 'admin'
    });

    console.log('User created successfully');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();