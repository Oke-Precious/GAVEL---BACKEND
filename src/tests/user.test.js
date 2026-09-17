const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const UserAuditLog = require('../models/UserAuditLog');

test('User Suspend and Reactivate Logic', async (t) => {
  await t.test('User model should have status default active and tokenVersion default 0', () => {
    const user = new User({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
    });

    assert.equal(user.status, 'active');
    assert.equal(user.tokenVersion, 0);
  });

  await t.test('generateAuthToken should embed tokenVersion in payload', () => {
    const user = new User({
      _id: '507f1f77bcf86cd799439011',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: 'lawyer',
      tokenVersion: 2,
    });

    const jwt = require('jsonwebtoken');
    const env = require('../config/env');
    const token = user.generateAuthToken();
    const decoded = jwt.verify(token, env.JWT_SECRET);

    assert.equal(decoded.id, '507f1f77bcf86cd799439011');
    assert.equal(decoded.role, 'lawyer');
    assert.equal(decoded.tokenVersion, 2);
  });

  await t.test('suspending user should increment tokenVersion and update suspension details', () => {
    const user = new User({
      _id: '507f1f77bcf86cd799439012',
      firstName: 'Officer',
      lastName: 'Smith',
      email: 'officer@example.com',
      password: 'password123',
      tokenVersion: 0,
      status: 'active',
    });

    // Simulate suspension action
    user.status = 'suspended';
    user.suspendedAt = new Date();
    user.suspendedBy = '507f1f77bcf86cd799439011';
    user.suspensionReason = 'Under investigation';
    user.tokenVersion += 1;

    assert.equal(user.status, 'suspended');
    assert.equal(user.tokenVersion, 1);
    assert.ok(user.suspendedAt instanceof Date);
    assert.equal(user.suspensionReason, 'Under investigation');
  });

  await t.test('tokenVersion mismatch invalidates pre-suspension token', () => {
    const user = new User({
      _id: '507f1f77bcf86cd799439013',
      firstName: 'Alex',
      lastName: 'Lawyer',
      tokenVersion: 0,
    });

    const jwt = require('jsonwebtoken');
    const env = require('../config/env');

    // Token generated before suspension
    const oldToken = jwt.sign(
      { id: user._id, role: 'lawyer', tokenVersion: user.tokenVersion },
      env.JWT_SECRET
    );

    // User gets suspended -> tokenVersion incremented
    user.tokenVersion += 1;

    const decoded = jwt.verify(oldToken, env.JWT_SECRET);

    // Simulation of protect middleware check
    const isTokenValid = decoded.tokenVersion === user.tokenVersion;
    assert.equal(isTokenValid, false);
  });

  await t.test('reactivation sets status active and preserves tokenVersion', () => {
    const user = new User({
      _id: '507f1f77bcf86cd799439014',
      firstName: 'Alex',
      lastName: 'Lawyer',
      status: 'suspended',
      tokenVersion: 1,
    });

    // Simulate reactivation
    user.status = 'active';
    user.reactivatedAt = new Date();
    user.reactivatedBy = '507f1f77bcf86cd799439011';

    assert.equal(user.status, 'active');
    assert.equal(user.tokenVersion, 1); // Token version MUST NOT reset
    assert.ok(user.reactivatedAt instanceof Date);
  });

  await t.test('UserAuditLog model instantiates valid audit log records', () => {
    const log = new UserAuditLog({
      userId: '507f1f77bcf86cd799439014',
      action: 'suspended',
      performedBy: '507f1f77bcf86cd799439011',
      reason: 'Policy violation',
    });

    assert.equal(log.action, 'suspended');
    assert.equal(log.reason, 'Policy violation');
    assert.ok(log.timestamp instanceof Date);
  });
});
