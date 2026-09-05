const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit auth attempts
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};
