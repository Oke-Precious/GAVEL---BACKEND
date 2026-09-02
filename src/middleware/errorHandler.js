const { sendError } = require('../utils/apiResponse');
const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log to console for dev
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new Error(message);
    return sendError(res, 404, error.message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value entered for: ${field}. Please use another value.`;
    error = new Error(message);
    return sendError(res, 400, error.message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new Error(message);
    return sendError(res, 400, error.message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Not authorized to access this route. Invalid token.';
    return sendError(res, 401, message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please login again.';
    return sendError(res, 401, message);
  }

  // Default server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
