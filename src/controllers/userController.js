const User = require('../models/User');
const UserAuditLog = require('../models/UserAuditLog');
const UserDeletionLog = require('../models/UserDeletionLog');
const Case = require('../models/Case');
const CaseDocument = require('../models/CaseDocument');
const StatusHistory = require('../models/StatusHistory');
const Hearing = require('../models/Hearing');
const Adjournment = require('../models/Adjournment');
const ContactMessage = require('../models/ContactMessage');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { STANDARD_ROLES } = require('../constants/roles');
const { getManagementDenial, getDeletionConfirmation, isSameUser } = require('../utils/userManagementPolicy');

const getUserDependencies = async userId => {
  const [
    assignedCases,
    uploadedDocuments,
    statusChanges,
    hearings,
    adjournments,
    resolvedContacts,
    administrativeActions,
    managedUsers
  ] = await Promise.all([
    Case.countDocuments({ $or: [{ lawyers: userId }, { judge: userId }] }),
    CaseDocument.countDocuments({ uploadedBy: userId }),
    StatusHistory.countDocuments({ changedBy: userId }),
    Hearing.countDocuments({ judge: userId }),
    Adjournment.countDocuments({ requestedBy: userId }),
    ContactMessage.countDocuments({ resolvedBy: userId }),
    UserAuditLog.countDocuments({ performedBy: userId }),
    User.countDocuments({ $or: [{ suspendedBy: userId }, { reactivatedBy: userId }] })
  ]);

  const dependencies = {
    assignedCases,
    uploadedDocuments,
    statusChanges,
    hearings,
    adjournments,
    resolvedContacts,
    administrativeActions,
    managedUsers
  };

  return {
    dependencies,
    total: Object.values(dependencies).reduce((sum, count) => sum + count, 0)
  };
};

/**
 * @desc    Get all users (paginated, filterable)
 * @route   GET /api/v1/users
 * @access  Private (Admin)
 */
exports.getUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const query = req.user.role === 'super_admin' ? {} : { role: { $ne: 'super_admin' } };

  if (role) {
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return sendError(res, 403, 'Only a super administrator can view super administrator accounts');
    }
    query.role = role;
  }

  const users = await User.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const count = await User.countDocuments(query);

  sendSuccess(res, 200, 'Users retrieved', {
    users,
    totalPages: Math.ceil(count / limit),
    currentPage: Number(page),
    totalUsers: count
  });
});

/**
 * @desc    Invite a new user (creates account + temp password)
 * @route   POST /api/v1/users/invite
 * @access  Private (Admin)
 */
exports.inviteUser = asyncHandler(async (req, res) => {
  const { email, firstName, lastName, role, court } = req.body;

  if (role === 'super_admin') {
    return sendError(res, 403, 'Super administrator accounts can only be created with the secure bootstrap command');
  }

  if (role === 'admin' && req.user.role !== 'super_admin') {
    return sendError(res, 403, 'Only a super administrator can create an administrator account');
  }

  let user = await User.findOne({ email });
  if (user) {
    return sendError(res, 400, 'User with this email already exists');
  }

  // Generate secure temporary password
  const tempPassword = crypto.randomBytes(8).toString('hex');

  user = await User.create({
    firstName,
    lastName,
    email,
    role,
    court,
    password: tempPassword,
    isEmailVerified: true // Pre-verified by admin
  });

  // Dispatch invite email containing the temp password
  const subject = 'You have been invited to GAVEL';
  const text = `Hello ${firstName},\n\nYou have been invited to GAVEL as a ${role}.\n\nYour temporary password is: ${tempPassword}\n\nPlease login and change your password immediately.`;
  const html = `
    <h3>Welcome to GAVEL</h3>
    <p>You have been invited by an Administrator to join the platform as a <strong>${role}</strong>.</p>
    <p>Your temporary password is: <br><strong>${tempPassword}</strong></p>
    <p>Please log in and reset your password immediately.</p>
  `;
  
  try {
    await emailService.sendEmail({ to: email, subject, text, html });
  } catch (error) {
    console.error('Invite email failed to send', error);
  }

  sendSuccess(res, 201, 'User invited successfully', { 
    user: await User.findById(user._id)
  });
});

/**
 * @desc    Update a user
 * @route   PATCH /api/v1/users/:id
 * @access  Private (Admin)
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id);

  if (!targetUser) {
    return sendError(res, 404, 'User not found');
  }

  const denial = getManagementDenial(req.user, targetUser, 'update');
  if (denial) {
    return sendError(res, 403, denial);
  }

  const allowedFields = ['firstName', 'lastName', 'phoneNumber', 'barNumber'];
  const updateData = Object.fromEntries(
    allowedFields
      .filter(field => req.body[field] !== undefined)
      .map(field => [field, req.body[field]])
  );

  if (req.body.role !== undefined) {
    if (isSameUser(req.user, targetUser) && req.body.role !== targetUser.role) {
      return sendError(res, 400, 'You cannot change your own role');
    }

    if (req.body.role === 'super_admin') {
      return sendError(res, 403, 'The super administrator role cannot be assigned through the API');
    }

    if (req.body.role === 'admin' && req.user.role !== 'super_admin') {
      return sendError(res, 403, 'Only a super administrator can assign the administrator role');
    }

    if (!STANDARD_ROLES.includes(req.body.role) && req.body.role !== 'admin') {
      return sendError(res, 400, 'Invalid role specified');
    }

    updateData.role = req.body.role;
  }

  if (Object.keys(updateData).length === 0) {
    return sendError(res, 400, 'No supported user fields were provided');
  }

  const user = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  });

  sendSuccess(res, 200, 'User updated', { user });
});

/**
 * @desc    Suspend a user
 * @route   PATCH /api/v1/users/:id/suspend
 * @access  Private (Admin)
 */
exports.suspendUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;

  const user = await User.findById(targetUserId);
  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  const denial = getManagementDenial(req.user, user, 'suspend');
  if (denial) {
    return sendError(res, 403, denial);
  }

  if (user.role === 'admin' && (!req.body.reason || req.body.reason.trim().length < 10)) {
    return sendError(res, 400, 'A reason of at least 10 characters is required to suspend an administrator');
  }

  // Count active non-compliant/unclosed cases assigned to user
  const activeCasesCount = await Case.countDocuments({
    $or: [
      { lawyers: user._id },
      { judge: user._id },
      { assignedOfficer: user._id },
      { userId: user._id }
    ],
    alertLevel: { $ne: 'compliant' },
    lifecycleStage: { $ne: 'trial_or_discharge' }
  });

  user.status = 'suspended';
  user.suspendedAt = new Date();
  user.suspendedBy = req.user._id;
  user.suspensionReason = req.body.reason || undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save({ validateBeforeSave: false });

  await UserAuditLog.create({
    userId: user._id,
    action: 'suspended',
    performedBy: req.user._id,
    reason: req.body.reason || undefined,
    timestamp: new Date()
  });

  sendSuccess(res, 200, 'User suspended successfully', {
    user,
    activeCasesCount
  });
});

/**
 * @desc    Reactivate a user
 * @route   PATCH /api/v1/users/:id/reactivate
 * @access  Private (Admin)
 */
exports.reactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  const denial = getManagementDenial(req.user, user, 'reactivate');
  if (denial) {
    return sendError(res, 403, denial);
  }

  user.status = 'active';
  user.reactivatedAt = new Date();
  user.reactivatedBy = req.user._id;
  await user.save({ validateBeforeSave: false });

  await UserAuditLog.create({
    userId: user._id,
    action: 'reactivated',
    performedBy: req.user._id,
    timestamp: new Date()
  });

  sendSuccess(res, 200, 'User reactivated successfully', { user });
});

/**
 * @desc    Get user audit log
 * @route   GET /api/v1/users/:id/audit-log
 * @access  Private (Admin)
 */
exports.getUserAuditLog = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  const denial = getManagementDenial(req.user, user, 'manage');
  if (denial) {
    return sendError(res, 403, denial);
  }

  const logs = await UserAuditLog.find({ userId: req.params.id })
    .populate('performedBy', 'firstName lastName email')
    .sort({ timestamp: -1 });

  sendSuccess(res, 200, 'User audit log retrieved successfully', { logs });
});

/**
 * @desc    Check whether a user may be permanently deleted
 * @route   GET /api/v1/users/:id/deletion-check
 * @access  Private (Super Admin)
 */
exports.getUserDeletionCheck = asyncHandler(async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return sendError(res, 403, 'Only a super administrator can delete user accounts');
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  const denial = getManagementDenial(req.user, user, 'delete');
  if (denial) {
    return sendError(res, 403, denial);
  }

  const { dependencies, total } = await getUserDependencies(user._id);

  sendSuccess(res, 200, 'User deletion check completed', {
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    },
    canDelete: total === 0,
    requiredConfirmation: getDeletionConfirmation(user.email),
    dependencies
  });
});

/**
 * @desc    Permanently delete an eligible user
 * @route   DELETE /api/v1/users/:id
 * @access  Private (Super Admin)
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return sendError(res, 403, 'Only a super administrator can delete user accounts');
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  const denial = getManagementDenial(req.user, user, 'delete');
  if (denial) {
    return sendError(res, 403, denial);
  }

  const requiredConfirmation = getDeletionConfirmation(user.email);
  if (req.body.confirmation !== requiredConfirmation) {
    return sendError(res, 400, `Confirmation must exactly match: ${requiredConfirmation}`);
  }

  const { dependencies, total } = await getUserDependencies(user._id);
  if (total > 0) {
    return sendError(
      res,
      409,
      'User cannot be deleted while related operational records exist. Reassign or remove those records first.',
      { dependencies }
    );
  }

  const deletionLog = await UserDeletionLog.create({
    targetUserId: user._id,
    targetEmail: user.email,
    targetFirstName: user.firstName,
    targetLastName: user.lastName,
    targetRole: user.role,
    deletedBy: req.user._id,
    deletedByEmail: req.user.email,
    deletedByRole: req.user.role,
    reason: req.body.reason,
    dependencySnapshot: dependencies
  });

  try {
    await user.deleteOne();
  } catch (error) {
    deletionLog.status = 'failed';
    deletionLog.failureReason = error.message;
    await deletionLog.save();
    throw error;
  }

  deletionLog.status = 'completed';
  deletionLog.deletedAt = new Date();

  try {
    await deletionLog.save();
  } catch (error) {
    console.error('User was deleted but deletion audit finalization failed', {
      deletionLogId: deletionLog._id,
      targetUserId: user._id,
      error: error.message
    });
  }

  sendSuccess(res, 200, 'User deleted successfully', {
    deletedUserId: user._id,
    deletedEmail: user.email
  });
});
