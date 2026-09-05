const test = require('node:test');
const assert = require('node:assert/strict');
const exportService = require('../services/exportService');

test('Export Service', async (t) => {
  await t.test('should export cases to CSV string', () => {
    const cases = [
      {
        hashId: 'GAV-26-8A3F9',
        caseNumber: 'FHC/001',
        title: 'Test Case',
        stage: 'Trial',
        status: 'Active',
        filingDate: new Date('2026-01-01'),
        court: 'Lagos High Court'
      }
    ];

    const csvResult = exportService.exportToCSV(cases);
    assert.equal(typeof csvResult, 'string');
    assert.ok(csvResult.includes('hashId'));
    assert.ok(csvResult.includes('FHC/001'));
    assert.ok(csvResult.includes('Test Case'));
  });
});
