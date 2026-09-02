const WatchSubscription = require('../models/WatchSubscription');
const Case = require('../models/Case');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
// const emailService = require('../services/emailService'); // To be used for welcome email later if desired

/**
 * @desc    Subscribe to case updates via email
 * @route   POST /api/v1/watch/:caseHashId
 * @access  Public
 */
exports.subscribeToCase = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const { caseHashId } = req.params;

  if (!email) {
    return sendError(res, 400, 'Please provide an email address');
  }

  // Find the case
  const caseData = await Case.findOne({ hashId: caseHashId });
  if (!caseData) {
    return sendError(res, 404, 'Case not found');
  }

  // Check if already subscribed
  let subscription = await WatchSubscription.findOne({ caseId: caseData._id, email });
  if (subscription) {
    if (!subscription.isActive) {
      // Reactivate
      subscription.isActive = true;
      await subscription.save();
      return sendSuccess(res, 200, 'Subscription reactivated successfully');
    }
    return sendError(res, 400, 'Email is already subscribed to this case');
  }

  // Create new subscription
  subscription = await WatchSubscription.create({
    caseId: caseData._id,
    email
  });

  // Example: emailService.sendWatchWelcomeEmail(email, caseData, subscription.unsubscribeToken);

  sendSuccess(res, 201, 'Successfully subscribed to case updates', {
    unsubscribeToken: subscription.unsubscribeToken
  });
});

/**
 * @desc    Unsubscribe from case updates
 * @route   DELETE /api/v1/watch/:idOrToken
 * @access  Public
 */
exports.unsubscribe = asyncHandler(async (req, res) => {
  const { idOrToken } = req.params;

  // Try finding by token first, then by ID
  let subscription = await WatchSubscription.findOne({ unsubscribeToken: idOrToken });
  
  if (!subscription) {
    // If not found by token, try by ID (if it's a valid ObjectId)
    if (idOrToken.match(/^[0-9a-fA-F]{24}$/)) {
      subscription = await WatchSubscription.findById(idOrToken);
    }
  }

  if (!subscription) {
    return sendError(res, 404, 'Subscription not found or already removed');
  }

  await subscription.deleteOne();

  sendSuccess(res, 200, 'Successfully unsubscribed from case updates');
});
