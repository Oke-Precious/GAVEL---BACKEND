/**
 * Sends a successful response.
 * @param {Response} res 
 * @param {number} statusCode 
 * @param {string} message 
 * @param {object} [data=null] 
 * @param {object} [meta=null] 
 */
exports.sendSuccess = (res, statusCode, message, data = null, meta = null) => {
  const response = {
    success: true,
    message,
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  if (meta !== null) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Sends an error response.
 * @param {Response} res 
 * @param {number} statusCode 
 * @param {string} message 
 * @param {object} [errors=null] 
 */
exports.sendError = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};
