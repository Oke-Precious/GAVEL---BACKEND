const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { sendError } = require('../utils/apiResponse');
const env = require('../config/env');

/**
 * Middleware to protect routes and ensure user is authenticated.
 */
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // Extract token from Bearer token in header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Alternatively, extract from cookie
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return sendError(res, 401, 'Not authorized to access this route');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Fetch user and attach to req
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return sendError(res, 401, 'The user belonging to this token no longer exists');
    }
    
    if (!user.isActive) {
      return sendError(res, 401, 'Your account has been deactivated. Please contact support.');
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 401, 'Not authorized to access this route');
  }
});

/**
 * Middleware to restrict route access to specific roles.
 * Must be used AFTER protect middleware.
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, `User role ${req.user.role} is not authorized to access this route`);
    }
    next();
  };
};
