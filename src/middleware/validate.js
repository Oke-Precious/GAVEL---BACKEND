const { validationResult } = require('express-validator');
const { sendError } = require('../utils/apiResponse');

/**
 * Middleware to validate express-validator results
 * If there are validation errors, it returns a 422 response
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format errors for better client consumption
    const formattedErrors = errors.array().reduce((acc, error) => {
      acc[error.path] = error.msg;
      return acc;
    }, {});
    
    return sendError(res, 422, 'Validation failed', formattedErrors);
  }
  next();
};

module.exports = validate;
