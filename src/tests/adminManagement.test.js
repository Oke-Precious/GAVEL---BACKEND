const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const UserDeletionLog = require('../models/UserDeletionLog');
const Case = require('../models/Case');
const CaseDocument = require('../models/CaseDocument');
const StatusHistory = require('../models/StatusHistory');
const Hearing = require('../models/Hearing');
const Adjournment = require('../models/Adjournment');
const ContactMessage = require('../models/ContactMessage');
const UserAuditLog = require('../models/UserAuditLog');
const { authorize } = require('../middleware/auth');
const { getUserDeletionCheck, deleteUser } = require('../controllers/userController');
const {
  getManagementDenial,
  getDeletionConfirmation
} = require('../utils/userManagementPolicy');

const user = (id, role) => ({ _id: id, role });

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

test('Super administrator role is valid and inherits admin authorization', async (t) => {
  await t.test('User model accepts super_admin', async () => {
    const superAdmin = new User({
      firstName: 'System',
      lastName: 'Owner',
      email: 'owner@example.com',
      password: 'Password123!',
      role: 'super_admin'
    });

    await superAdmin.validate();
    assert.equal(superAdmin.role, 'super_admin');
  });

  await t.test('authorize(admin) permits a super_admin', () => {
    let nextCalled = false;
    authorize('admin')(
      { user: { role: 'super_admin' } },
      {},
      () => { nextCalled = true; }
    );

    assert.equal(nextCalled, true);
  });
});

test('User management policy enforces the administrative hierarchy', () => {
  const admin = user('507f1f77bcf86cd799439011', 'admin');
  const superAdmin = user('507f1f77bcf86cd799439012', 'super_admin');
  const otherSuperAdmin = user('507f1f77bcf86cd799439013', 'super_admin');
  const lawyer = user('507f1f77bcf86cd799439014', 'lawyer');

  assert.equal(
    getManagementDenial(admin, lawyer, 'delete'),
    'Only a super administrator can delete user accounts'
  );
  assert.match(getManagementDenial(admin, superAdmin, 'delete'), /cannot be managed/);
  assert.match(getManagementDenial(admin, { ...admin, _id: '507f1f77bcf86cd799439015' }, 'delete'), /Only a super administrator/);
  assert.equal(getManagementDenial(superAdmin, admin, 'delete'), null);
  assert.match(getManagementDenial(superAdmin, otherSuperAdmin, 'delete'), /cannot be managed/);
  assert.equal(getManagementDenial(admin, admin, 'delete'), 'You cannot delete your own account');
});

test('Deletion confirmation is target-specific and audit reason is required', async () => {
  assert.equal(getDeletionConfirmation('lawyer@example.com'), 'DELETE lawyer@example.com');

  const log = new UserDeletionLog({
    targetUserId: '507f1f77bcf86cd799439014',
    targetEmail: 'lawyer@example.com',
    targetRole: 'lawyer',
    deletedBy: '507f1f77bcf86cd799439012',
    deletedByEmail: 'owner@example.com',
    deletedByRole: 'super_admin',
    reason: 'Testing account cleanup'
  });

  await log.validate();
  assert.equal(log.status, 'pending');
});

test('Super administrator can preflight and delete an unreferenced testing account', async () => {
  const countModels = [Case, CaseDocument, StatusHistory, Hearing, Adjournment, ContactMessage, UserAuditLog];
  const originalFindById = User.findById;
  const originalUserCount = User.countDocuments;
  const originalCounts = countModels.map(model => model.countDocuments);
  const originalCreateLog = UserDeletionLog.create;
  let userDeleted = false;
  let auditSaves = 0;

  const targetUser = {
    _id: '507f1f77bcf86cd799439014',
    firstName: 'Test',
    lastName: 'Lawyer',
    email: 'test-lawyer@example.com',
    role: 'lawyer',
    deleteOne: async () => { userDeleted = true; }
  };
  const actor = {
    _id: '507f1f77bcf86cd799439012',
    email: 'owner@example.com',
    role: 'super_admin'
  };

  try {
    User.findById = async () => targetUser;
    User.countDocuments = async () => 0;
    countModels.forEach(model => { model.countDocuments = async () => 0; });
    UserDeletionLog.create = async data => ({
      _id: '507f1f77bcf86cd799439016',
      ...data,
      save: async () => { auditSaves += 1; }
    });

    const preflight = await invokeHandler(getUserDeletionCheck, {
      user: actor,
      params: { id: targetUser._id }
    });

    assert.equal(preflight.statusCode, 200);
    assert.equal(preflight.body.data.canDelete, true);
    assert.equal(preflight.body.data.requiredConfirmation, 'DELETE test-lawyer@example.com');

    const deletion = await invokeHandler(deleteUser, {
      user: actor,
      params: { id: targetUser._id },
      body: {
        reason: 'Removing a disposable test account',
        confirmation: 'DELETE test-lawyer@example.com'
      }
    });

    assert.equal(deletion.statusCode, 200);
    assert.equal(deletion.body.success, true);
    assert.equal(userDeleted, true);
    assert.equal(auditSaves, 1);
  } finally {
    User.findById = originalFindById;
    User.countDocuments = originalUserCount;
    countModels.forEach((model, index) => { model.countDocuments = originalCounts[index]; });
    UserDeletionLog.create = originalCreateLog;
  }
});
