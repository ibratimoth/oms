const bcrypt = require('bcrypt');
const { User } = require('../models');

(async () => {
  try {
    const existing = await User.findOne({ where: { username: 'user' } });

    if (existing) {
      console.log('User already exists');
      return;
    }

    await User.create({
      full_name: 'user',
      username: 'user',
      password: await bcrypt.hash('user123', 10),
      role: 'user'
    });

    console.log('User created successfully');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();