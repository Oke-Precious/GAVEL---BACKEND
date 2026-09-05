const Case = require('../models/Case');

class AlertService {
  /**
   * Recompute risk/stall alert levels for active cases
   */
  async recomputeAlertLevels() {
    const activeCases = await Case.find({ status: { $in: ['Active', 'Stalled'] } });
    let updated = 0;

    for (const caseObj of activeCases) {
      // Calculate days in current state
      const daysInState = Math.floor((Date.now() - new Date(caseObj.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      
      let newStatus = caseObj.status;
      if (daysInState > 60 && caseObj.status === 'Active') {
        newStatus = 'Stalled';
      }

      if (newStatus !== caseObj.status) {
        caseObj.status = newStatus;
        await caseObj.save();
        updated++;
      }
    }

    return { processed: activeCases.length, updated };
  }
}

module.exports = new AlertService();
