const User = require('../models/User');
const UserAuditLog = require('../models/UserAuditLog');
const Case = require('../models/Case');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get all users (paginated, filterable)
 * @route   GET /api/v1/users
 * @access  Private (Admin)
 */
exports.getUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const query = {};

  if (role) query.role = role;

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
  // Prevent password updates through this generic endpoint
  const updateData = { ...req.body };
  delete updateData.password;
  delete updateData.resetPasswordToken;

  const user = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  sendSuccess(res, 200, 'User updated', { user });
});

/**
 * @desc    Suspend a user
 * @route   PATCH /api/v1/users/:id/suspend
 * @access  Private (Admin)
 */
exports.suspendUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;

  // Reject if admin tries to suspend themselves
  if (req.user._id.toString() === targetUserId || req.user.id === targetUserId) {
    return sendError(res, 400, 'An administrator cannot suspend their own account');
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    return sendError(res, 404, 'User not found');
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

  const logs = await UserAuditLog.find({ userId: req.params.id })
    .populate('performedBy', 'firstName lastName email')
    .sort({ timestamp: -1 });

  sendSuccess(res, 200, 'User audit log retrieved successfully', { logs });
});

