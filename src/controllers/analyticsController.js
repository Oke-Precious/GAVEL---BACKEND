const Case = require('../models/Case');
const User = require('../models/User');
const StatusHistory = require('../models/StatusHistory');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * @desc    Get admin overview (system stats)
 * @route   GET /api/v1/analytics/overview
 * @access  Private (Admin)
 */
exports.getOverview = asyncHandler(async (req, res) => {
  // Parallel promises for speed
  const [
    totalCases,
    activeCases,
    proBonoCases,
    totalUsers,
    roleDistribution
  ] = await Promise.all([
    Case.countDocuments(),
    Case.countDocuments({ status: 'Active' }),
    Case.countDocuments({ isProBono: true }),
    User.countDocuments(),
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ])
  ]);

  sendSuccess(res, 200, 'Overview stats retrieved', {
    overview: {
      cases: { total: totalCases, active: activeCases, proBono: proBonoCases },
      users: { total: totalUsers, roles: roleDistribution }
    }
  });
});

/**
 * @desc    Get bottleneck heatmap (by stage/court)
 * @route   GET /api/v1/analytics/heatmap
 * @access  Private (Admin)
 */
exports.getHeatmap = asyncHandler(async (req, res) => {
  const heatmap = await Case.aggregate([
    { $match: { status: { $ne: 'Closed' } } },
    {
      $group: {
        _id: { court: { $ifNull: ['$court', 'Unassigned'] }, stage: '$stage' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        court: '$_id.court',
        stage: '$_id.stage',
        count: 1
      }
    }
  ]);

  sendSuccess(res, 200, 'Heatmap data retrieved', { heatmap });
});

/**
 * @desc    Get trend data from StatusHistory logs
 * @route   GET /api/v1/analytics/trends
 * @access  Private (Admin)
 */
exports.getTrends = asyncHandler(async (req, res) => {
  // Aggregate status updates over time (e.g., how many stalls per month)
  const trends = await StatusHistory.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          status: '$newStatus'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  sendSuccess(res, 200, 'Trend data retrieved', { trends });
});
