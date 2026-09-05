const alertService = require('../services/alertService');

/**
 * Scheduled job to recompute stall risk levels across cases
 */
async function runRecomputeAlertLevels() {
  try {
    const result = await alertService.recomputeAlertLevels();
    console.log(`[JOB] Recompute alert levels completed:`, result);
  } catch (error) {
    console.error(`[JOB ERROR] Recompute alert levels failed:`, error);
  }
}

module.exports = runRecomputeAlertLevels;
