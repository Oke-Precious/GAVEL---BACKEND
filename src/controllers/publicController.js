const Case = require('../models/Case');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// Whitelisted fields for public exposure
const PUBLIC_CASE_FIELDS = 'caseNumber title description stage status court filingDate hashId createdAt updatedAt';

/**
 * @desc    Get public case details (strictly whitelisted, no PII)
 * @route   GET /api/v1/public/cases/:caseHashId
 * @access  Public
 */
exports.getPublicCase = asyncHandler(async (req, res) => {
  // Query by hashId and exclusively select the whitelisted fields.
  // We use .select(...) to enforce no names (plaintiffs, defendants, lawyers, judges) are sent back.
  // Also we use .lean() for performance since we don't need mongoose document methods here.
  const caseData = await Case.findOne({ hashId: req.params.caseHashId })
    .select(PUBLIC_CASE_FIELDS)
    .lean();

  if (!caseData) {
    return sendError(res, 404, 'Case not found');
  }

  sendSuccess(res, 200, 'Case retrieved successfully', { case: caseData });
});

/**
 * @desc    Get high-level public scorecard (resolution rates, totals)
 * @route   GET /api/v1/public/scorecard
 * @access  Public
 */
exports.getScorecard = asyncHandler(async (req, res) => {
  const stats = await Case.aggregate([
    {
      $group: {
        _id: null,
        totalCases: { $sum: 1 },
        activeCases: {
          $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
        },
        resolvedCases: {
          $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] }
        },
        stalledCases: {
          $sum: { $cond: [{ $eq: ['$status', 'Stalled'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalCases: 1,
        activeCases: 1,
        resolvedCases: 1,
        stalledCases: 1,
        resolutionRate: {
          $cond: [
            { $eq: ['$totalCases', 0] },
            0,
            { $multiply: [{ $divide: ['$resolvedCases', '$totalCases'] }, 100] }
          ]
        }
      }
    }
  ]);

  const scorecard = stats[0] || {
    totalCases: 0,
    activeCases: 0,
    resolvedCases: 0,
    stalledCases: 0,
    resolutionRate: 0
  };

  sendSuccess(res, 200, 'Scorecard retrieved successfully', { scorecard });
});

/**
 * @desc    Get backlog mapping (active/stalled cases by court)
 * @route   GET /api/v1/public/backlog-map
 * @access  Public
 */
exports.getBacklogMap = asyncHandler(async (req, res) => {
  const backlog = await Case.aggregate([
    {
      $match: { status: { $in: ['Active', 'Stalled'] } }
    },
    {
      $group: {
        _id: '$court',
        activeCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
        },
        stalledCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Stalled'] }, 1, 0] }
        },
        totalBacklog: { $sum: 1 }
      }
    },
    {
      $project: {
        court: { $ifNull: ['$_id', 'Unassigned'] },
        activeCount: 1,
        stalledCount: 1,
        totalBacklog: 1,
        _id: 0
      }
    },
    { $sort: { totalBacklog: -1 } }
  ]);

  sendSuccess(res, 200, 'Backlog map retrieved successfully', { backlog });
});

/**
 * @desc    Get filing vs resolution trends over time
 * @route   GET /api/v1/public/trends
 * @access  Public
 */
exports.getTrends = asyncHandler(async (req, res) => {
  // Aggregate filings by month
  const trends = await Case.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$filingDate' },
          month: { $month: '$filingDate' }
        },
        filed: { $sum: 1 },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id: 0,
        period: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: [
                { $lt: ['$_id.month', 10] },
                { $concat: ['0', { $toString: '$_id.month' }] },
                { $toString: '$_id.month' }
              ]
            }
          ]
        },
        filed: 1,
        resolved: 1
      }
    }
  ]);

  sendSuccess(res, 200, 'Trends retrieved successfully', { trends });
});
