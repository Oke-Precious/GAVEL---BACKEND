const test = require('node:test');
const assert = require('node:assert/strict');
const generateCaseHashId = require('../utils/generateCaseHashId');
const apiResponse = require('../utils/apiResponse');

test('Hash ID Generator', async (t) => {
  await t.test('should generate hash ID starting with GAV-', () => {
    const hashId = generateCaseHashId.generateCaseHashId();
    assert.ok(hashId.startsWith('GAV-'));
    assert.equal(typeof hashId, 'string');
    assert.ok(hashId.length > 8);
  });
});

test('API Response Formatter', async (t) => {
  await t.test('should format success response correctly', () => {
    let mockStatus, mockJson;
    const res = {
      status(s) { mockStatus = s; return this; },
      json(j) { mockJson = j; return this; }
    };

    apiResponse.sendSuccess(res, 200, 'Success test', { item: 1 });
    assert.equal(mockStatus, 200);
    assert.equal(mockJson.success, true);
    assert.equal(mockJson.message, 'Success test');
    assert.deepEqual(mockJson.data, { item: 1 });
  });

  await t.test('should format error response correctly', () => {
    let mockStatus, mockJson;
    const res = {
      status(s) { mockStatus = s; return this; },
      json(j) { mockJson = j; return this; }
    };

    apiResponse.sendError(res, 400, 'Bad request', { field: 'invalid' });
    assert.equal(mockStatus, 400);
    assert.equal(mockJson.success, false);
    assert.equal(mockJson.message, 'Bad request');
    assert.deepEqual(mockJson.errors, { field: 'invalid' });
  });
});
