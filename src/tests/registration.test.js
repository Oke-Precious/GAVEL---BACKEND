const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { register } = require('../controllers/authController');

const invokeHandler = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode: this.statusCode, body });
      return this;
    }
  };

  handler(req, res, reject);
});

test('Public registration rejects non-lawyer roles', async () => {
  const response = await invokeHandler(register, {
    body: {
      firstName: 'Public',
      lastName: 'Admin',
      email: 'admin-signup@example.com',
      password: 'Password123!',
      role: 'admin'
    }
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, {
    success: false,
    message: 'Public signup is only available for volunteer lawyers.'
  });
});

test('Registration remains successful when verification email delivery fails', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalSendVerificationEmail = emailService.sendVerificationEmail;
  const originalConsoleError = console.error;
  let createdUserData;

  const user = {
    _id: '507f1f77bcf86cd799439011',
    firstName: 'Ada',
    lastName: 'Lawyer',
    email: 'ada@example.com',
    password: 'hashed-password',
    role: 'lawyer',
    createEmailVerificationToken: () => 'raw-token',
    save: async () => user,
    toObject: () => ({ ...user })
  };

  try {
    User.findOne = async () => null;
    User.create = async (data) => {
      createdUserData = data;
      return user;
    };
    emailService.sendVerificationEmail = async () => {
      throw new Error('SMTP unavailable');
    };
    console.error = () => {};

    const response = await invokeHandler(register, {
      body: {
        firstName: 'Ada',
        lastName: 'Lawyer',
        email: 'ada@example.com',
        password: 'Password123!'
      }
    });

    assert.equal(createdUserData.role, 'lawyer');
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.success, true);
    assert.equal(
      response.body.message,
      'Account created, but verification email could not be sent. Please request a new verification email.'
    );
    assert.equal(response.body.data.user.password, undefined);
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    emailService.sendVerificationEmail = originalSendVerificationEmail;
    console.error = originalConsoleError;
  }
});
