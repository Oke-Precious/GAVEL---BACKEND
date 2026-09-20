const mongoose = require('mongoose');
const User = require('../models/User');
const env = require('../config/env');

const createSuperAdmin = async () => {
  try {
    if (!env.MONGO_URI) {
      throw new Error('MONGO_URI is required');
    }

    if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_PASSWORD) {
      throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required');
    }

    if (env.SUPER_ADMIN_PASSWORD.length < 12) {
      throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters long');
    }

    await mongoose.connect(env.MONGO_URI);

    const existingUser = await User.findOne({ email: env.SUPER_ADMIN_EMAIL });
    if (existingUser) {
      if (existingUser.role === 'super_admin') {
        console.log(`Super administrator already exists: ${existingUser.email}`);
        return;
      }

      throw new Error('A non-super-admin user already exists with SUPER_ADMIN_EMAIL');
    }

    const user = await User.create({
      firstName: env.SUPER_ADMIN_FIRST_NAME,
      lastName: env.SUPER_ADMIN_LAST_NAME,
      email: env.SUPER_ADMIN_EMAIL,
      password: env.SUPER_ADMIN_PASSWORD,
      role: 'super_admin',
      isEmailVerified: true
    });

    console.log(`Super administrator created successfully: ${user.email}`);
  } catch (error) {
    console.error(`Could not create super administrator: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createSuperAdmin();
