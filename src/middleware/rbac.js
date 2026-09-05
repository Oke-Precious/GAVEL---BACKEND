const { authorize } = require('./auth');

/**
 * Role-Based Access Control Middleware
 * Re-exports authorize from auth middleware for modular import support.
 */
module.exports = {
  authorize,
  checkRole: authorize
};
