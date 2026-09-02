const Case = require('../models/Case');
const StatusHistory = require('../models/StatusHistory');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * @desc    Get unrepresented pro-bono cases (filterable by detention duration)
 * @route   GET /api/v1/pro-bono/cases
 * @access  Private (Lawyer)
 */
exports.getUnrepresentedCases = asyncHandler(async (req, res) => {
  const { minDetentionDays } = req.query;

  const query = {
    isProBono: true,
    lawyers: { $size: 0 } // Unrepresented
  };

  if (minDetentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(minDetentionDays));
    
    query.detentionDate = { $lte: cutoffDate };
  }

  // Sort by longest detention time first (oldest dates first)
  const cases = await Case.find(query).sort({ detentionDate: 1 });

  sendSuccess(res, 200, 'Unrepresented pro-bono cases retrieved', { cases });
});

/**
 * @desc    Claim an unrepresented pro-bono case
 * @route   POST /api/v1/pro-bono/cases/:id/claim
 * @access  Private (Lawyer)
 */
exports.claimCase = asyncHandler(async (req, res) => {
  const caseData = await Case.findById(req.params.id);

  if (!caseData) {
    return sendError(res, 404, 'Case not found');
  }

  if (!caseData.isProBono) {
    return sendError(res, 400, 'This case is not marked for pro-bono');
  }

  if (caseData.lawyers && caseData.lawyers.length > 0) {
    return sendError(res, 400, 'This case has already been claimed by another lawyer');
  }

  // Claim the case
  caseData.lawyers.push(req.user._id);
  await caseData.save();

  // Audit log
  await StatusHistory.create({
    caseId: caseData._id,
    changedBy: req.user._id,
    previousStage: caseData.stage,
    newStage: caseData.stage,
    previousStatus: caseData.status,
    newStatus: caseData.status,
    comments: `Case claimed for Pro-Bono by ${req.user.firstName} ${req.user.lastName}`
  });

  sendSuccess(res, 200, 'Successfully claimed case', { case: caseData });
});

/**
 * @desc    Get cases claimed by the logged in lawyer
 * @route   GET /api/v1/pro-bono/my-claimed
 * @access  Private (Lawyer)
 */
exports.getMyClaimedCases = asyncHandler(async (req, res) => {
  const cases = await Case.find({
    isProBono: true,
    lawyers: req.user._id
  }).sort({ updatedAt: -1 });

  sendSuccess(res, 200, 'Claimed cases retrieved', { cases });
});
