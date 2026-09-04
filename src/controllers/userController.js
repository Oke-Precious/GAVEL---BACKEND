const User = require('../models/User');
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
 * @desc    Delete a user
 * @route   DELETE /api/v1/users/:id
 * @access  Private (Admin)
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  // Safety Safeguard 1: Prevent self-deletion
  if (user._id.toString() === req.user._id.toString()) {
    return sendError(res, 400, 'You cannot delete your own administrator account');
  }

  // Safety Safeguard 2: Prevent deleting the last remaining admin
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      return sendError(res, 400, 'Cannot delete the last remaining administrator account in the system');
    }
  }

  await user.deleteOne();

  sendSuccess(res, 200, 'User deleted successfully');
});
