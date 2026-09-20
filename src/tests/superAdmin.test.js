const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const { authorize } = require('../middleware/auth');
const {
  getManagementDenial,
  getDeletionConfirmation
} = require('../utils/userManagementPolicy');
const { deleteUser, inviteUser } = require('../controllers/userController');

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

test('User model accepts the super_admin role', async () => {
  const user = new User({
    firstName: 'System',
    lastName: 'Owner',
    email: 'owner@example.com',
    password: 'Password123!',
    role: 'super_admin'
  });

  await user.validate();
  assert.equal(user.role, 'super_admin');
});

test('Super administrator bypasses role restrictions', () => {
  let nextCalled = false;
  authorize('lawyer')(
    { user: { role: 'super_admin' } },
    {},
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
});

test('Regular administrator cannot access a super-admin-only action', () => {
  let statusCode;
  let responseBody;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { responseBody = body; return this; }
  };

  authorize('super_admin')({ user: { role: 'admin' } }, res, () => {});

  assert.equal(statusCode, 403);
  assert.equal(responseBody.success, false);
});

test('Management policy protects administrators and self-deletion', () => {
  const admin = { _id: '507f1f77bcf86cd799439011', role: 'admin' };
  const anotherAdmin = { _id: '507f1f77bcf86cd799439012', role: 'admin' };
  const superAdmin = { _id: '507f1f77bcf86cd799439013', role: 'super_admin' };

  assert.equal(
    getManagementDenial(admin, anotherAdmin, 'suspend'),
    'Only a super administrator can suspend an administrator account'
  );
  assert.equal(getManagementDenial(superAdmin, anotherAdmin, 'delete'), null);
  assert.equal(
    getManagementDenial(superAdmin, superAdmin, 'delete'),
    'You cannot delete your own account'
  );
  assert.equal(getDeletionConfirmation('test@example.com'), 'DELETE test@example.com');
});

test('Regular administrator cannot delete users or create administrators', async () => {
  const actor = {
    _id: '507f1f77bcf86cd799439011',
    role: 'admin',
    email: 'admin@example.com'
  };

  const deleteResponse = await invokeHandler(deleteUser, {
    user: actor,
    params: { id: '507f1f77bcf86cd799439012' },
    body: { reason: 'Testing cleanup account', confirmation: 'DELETE user@example.com' }
  });
  const inviteResponse = await invokeHandler(inviteUser, {
    user: actor,
    body: {
      firstName: 'Another',
      lastName: 'Admin',
      email: 'another-admin@example.com',
      role: 'admin'
    }
  });

  assert.equal(deleteResponse.statusCode, 403);
  assert.equal(deleteResponse.body.message, 'Only a super administrator can delete user accounts');
  assert.equal(inviteResponse.statusCode, 403);
  assert.equal(inviteResponse.body.message, 'Only a super administrator can create an administrator account');
});
