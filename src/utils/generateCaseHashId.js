const crypto = require('crypto');

/**
 * Generates a unique short alphanumeric identifier for cases
 * Example format: GAV-26-8A3F9
 */
exports.generateCaseHashId = () => {
  const year = new Date().getFullYear().toString().slice(-2);
  const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  return `GAV-${year}-${randomStr}`;
};
