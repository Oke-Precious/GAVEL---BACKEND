const Case = require('../models/Case');
const BacklogSnapshot = require('../models/BacklogSnapshot');

/**
 * Scheduled job to take daily snapshot of court backlog
 */
async function runSnapshotBacklog() {
  try {
    const backlog = await Case.aggregate([
      { $match: { status: { $in: ['Active', 'Stalled'] } } },
      {
        $group: {
          _id: '$court',
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          stalledCount: { $sum: { $cond: [{ $eq: ['$status', 'Stalled'] }, 1, 0] } },
          totalBacklog: { $sum: 1 }
        }
      }
    ]);

    for (const item of backlog) {
      await BacklogSnapshot.create({
        court: item._id || 'Unassigned',
        activeCount: item.activeCount,
        stalledCount: item.stalledCount,
        totalBacklog: item.totalBacklog,
        snapshotDate: new Date()
      });
    }

    console.log(`[JOB] Backlog snapshot created for ${backlog.length} courts.`);
  } catch (error) {
    console.error(`[JOB ERROR] Backlog snapshot failed:`, error);
  }
}

module.exports = runSnapshotBacklog;
