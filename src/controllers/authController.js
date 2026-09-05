const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

// Helper to set refresh token in cookie
const setRefreshTokenCookie = (res, token) => {
  const options = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days (matches env default)
  };
  res.cookie('refreshToken', token, options);
};

/**
 * @desc    Register user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, role, phoneNumber, barNumber } = req.body;

  // Check if user exists
  let user = await User.findOne({ email });
  if (user) {
    return sendError(res, 400, 'User already exists with that email');
  }

  // Create user
  user = await User.create({
    firstName,
    lastName,
    email,
    password,
    role: role || 'public',
    phoneNumber,
    barNumber
  });

  // Generate Email Verification Token
  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  try {
    await emailService.sendVerificationEmail(user, verificationToken);
  } catch (error) {
    console.error('Email sending failed', error);
    // Note: User is created but email failed. In prod, you might want to retry or let them request it again.
  }

  // Return success (excluding password)
  const userData = await User.findById(user._id);

  sendSuccess(res, 201, 'Registration successful. Please check your email to verify your account.', {
    user: userData
  });
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check for user
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return sendError(res, 401, 'Invalid credentials');
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return sendError(res, 401, 'Invalid credentials');
  }

  // Check if active
  if (!user.isActive) {
    return sendError(res, 401, 'Your account has been deactivated');
  }

  // Generate tokens
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  // Save refresh token to user
  user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  // Set cookie
  setRefreshTokenCookie(res, refreshToken);

  // Return user without password
  const userData = await User.findById(user._id);

  sendSuccess(res, 200, 'Login successful', {
    user: userData,
    accessToken,
    refreshToken // Sending in body as well for clients that don't support cookies well
  });
});

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res) => {
  // If user is authenticated (via auth middleware), clear their refresh token
  if (req.user) {
    req.user.refreshToken = undefined;
    await req.user.save({ validateBeforeSave: false });
  }

  res.clearCookie('refreshToken');
  
  sendSuccess(res, 200, 'Logged out successfully');
});

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingToken) {
    return sendError(res, 401, 'No refresh token provided');
  }

  try {
    // Verify token
    const decoded = jwt.verify(incomingToken, env.JWT_REFRESH_SECRET);

    // Hash incoming to compare with DB
    const hashedToken = crypto.createHash('sha256').update(incomingToken).digest('hex');

    // Find user with matching ID and refresh token
    const user = await User.findOne({
      _id: decoded.id,
      refreshToken: hashedToken,
      isActive: true
    });

    if (!user) {
      return sendError(res, 401, 'Invalid refresh token');
    }

    // Issue new tokens (Token rotation)
    const newAccessToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    // Update refresh token in DB
    user.refreshToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await user.save({ validateBeforeSave: false });

    // Set new cookie
    setRefreshTokenCookie(res, newRefreshToken);

    sendSuccess(res, 200, 'Token refreshed successfully', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 401, 'Refresh token invalid or expired');
  }
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  sendSuccess(res, 200, 'User retrieved successfully', {
    user
  });
});

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // For security, always return success even if user not found to prevent enumeration
  if (!user) {
    return sendSuccess(res, 200, 'If an account with that email exists, a password reset link has been sent');
  }

  // Generate token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    await emailService.sendPasswordResetEmail(user, resetToken);
    sendSuccess(res, 200, 'If an account with that email exists, a password reset link has been sent');
  } catch (error) {
    // Reset tokens if email failed
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    
    return sendError(res, 500, 'Email could not be sent');
  }
});

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;

  // Hash the incoming token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    return sendError(res, 400, 'Invalid or expired password reset token');
  }

  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  
  // Invalidate refresh tokens for security
  user.refreshToken = undefined;
  
  await user.save(); // Password will be hashed in pre-save hook

  sendSuccess(res, 200, 'Password updated successfully. Please login.');
});

/**
 * @desc    Verify email
 * @route   GET /api/v1/auth/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = asyncHandler(async (req, res) => {
  // Hash the incoming token
  const emailVerificationToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return sendError(res, 400, 'Invalid or expired email verification token');
  }

  // Update user
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  // If request accepts HTML (browser click), redirect to frontend login page
  if (req.accepts('html')) {
    return res.redirect(`${env.CLIENT_URL}/login?verified=true`);
  }

  sendSuccess(res, 200, 'Email verified successfully. You can now login.');
});

/**
 * @desc    Resend email verification link
 * @route   POST /api/v1/auth/resend-verification
 * @access  Public
 */
exports.resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 400, 'Please provide an email address');
  }

  const user = await User.findOne({ email });

  if (!user) {
    return sendError(res, 404, 'No user found with that email address');
  }

  if (user.isEmailVerified) {
    return sendError(res, 400, 'This email address is already verified');
  }

  // Generate new verification token
  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  try {
    await emailService.sendVerificationEmail(user, verificationToken);
    sendSuccess(res, 200, 'Verification email resent successfully. Please check your inbox.');
  } catch (error) {
    return sendError(res, 500, 'Could not send verification email. Please try again later.');
  }
});
