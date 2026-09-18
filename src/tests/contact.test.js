const test = require('node:test');
const assert = require('node:assert/strict');
const ContactMessage = require('../models/ContactMessage');
const emailService = require('../services/emailService');
const env = require('../config/env');
const { createContactMessage } = require('../controllers/contactController');

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

test('ContactMessage applies defaults and validates category, email, and message length', async () => {
  const validMessage = new ContactMessage({
    name: '  Sender Name  ',
    email: '  SENDER@EXAMPLE.COM  ',
    category: 'privacy_concern',
    message: '  Please review this concern.  '
  });

  await validMessage.validate();
  assert.equal(validMessage.name, 'Sender Name');
  assert.equal(validMessage.email, 'sender@example.com');
  assert.equal(validMessage.message, 'Please review this concern.');
  assert.equal(validMessage.status, 'new');

  const invalidMessage = new ContactMessage({
    email: 'invalid-email',
    category: 'unknown',
    message: 'x'.repeat(5001)
  });
  let validationError;
  try {
    await invalidMessage.validate();
  } catch (error) {
    validationError = error;
  }

  assert.ok(validationError);
  assert.ok(validationError.errors.email);
  assert.ok(validationError.errors.category);
  assert.ok(validationError.errors.message);
});

test('Saved contact message returns success when notification email fails', async () => {
  const originalCreate = ContactMessage.create;
  const originalSendContactNotification = emailService.sendContactNotification;
  const originalConsoleError = console.error;
  const savedMessage = {
    _id: '507f1f77bcf86cd799439012',
    email: 'sender@example.com',
    category: 'report_issue'
  };

  try {
    ContactMessage.create = async () => savedMessage;
    emailService.sendContactNotification = async () => {
      throw new Error('SMTP unavailable');
    };
    console.error = () => {};

    const response = await invokeHandler(createContactMessage, {
      body: {
        name: 'Sender',
        email: 'sender@example.com',
        category: 'report_issue',
        message: 'Something is not working.'
      },
      ip: '127.0.0.1',
      get: () => 'test-user-agent'
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.body, {
      success: true,
      message: 'Message sent successfully',
      data: { messageId: savedMessage._id }
    });
  } finally {
    ContactMessage.create = originalCreate;
    emailService.sendContactNotification = originalSendContactNotification;
    console.error = originalConsoleError;
  }
});

test('Contact notification includes required details and escapes HTML', async () => {
  const originalRecipient = env.CONTACT_NOTIFICATION_EMAIL;
  const originalSendEmail = emailService.sendEmail;
  let sentOptions;

  try {
    env.CONTACT_NOTIFICATION_EMAIL = 'admin@example.com';
    emailService.sendEmail = async (options) => {
      sentOptions = options;
      return { messageId: 'test-message-id' };
    };

    await emailService.sendContactNotification({
      _id: '507f1f77bcf86cd799439013',
      name: '',
      email: 'sender@example.com',
      category: 'privacy_concern',
      message: '<script>alert("x")</script>',
      createdAt: new Date('2026-09-18T10:00:00.000Z')
    });

    assert.equal(sentOptions.to, 'admin@example.com');
    assert.equal(sentOptions.subject, '[GAVEL Contact] Privacy Concern from sender@example.com');
    assert.match(sentOptions.text, /Name: Not provided/);
    assert.match(sentOptions.text, /Message ID: 507f1f77bcf86cd799439013/);
    assert.doesNotMatch(sentOptions.html, /<script>/);
    assert.match(sentOptions.html, /&lt;script&gt;/);
  } finally {
    env.CONTACT_NOTIFICATION_EMAIL = originalRecipient;
    emailService.sendEmail = originalSendEmail;
  }
});
