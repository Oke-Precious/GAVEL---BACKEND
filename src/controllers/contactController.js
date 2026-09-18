const ContactMessage = require('../models/ContactMessage');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { CONTACT_CATEGORY_LABELS } = require('../constants/contact');

/**
 * @desc    Submit a contact message
 * @route   POST /api/v1/contact
 * @access  Public
 */
exports.createContactMessage = asyncHandler(async (req, res) => {
  const { name, email, category, message } = req.body;

  const contactMessage = await ContactMessage.create({
    name: name || undefined,
    email,
    category,
    message,
    userAgent: req.get('user-agent') || undefined,
    ipAddress: req.ip || undefined
  });

  // Persistence is the committed operation. Notification delivery is
  // deliberately best-effort and must not change the API result.
  try {
    await emailService.sendContactNotification(contactMessage);
  } catch (error) {
    console.error('Contact notification email failed', {
      messageId: contactMessage._id,
      recipientCategory: CONTACT_CATEGORY_LABELS[contactMessage.category],
      error: error.message
    });
  }

  sendSuccess(res, 201, 'Message sent successfully', {
    messageId: contactMessage._id
  });
});

/**
 * @desc    List contact messages
 * @route   GET /api/v1/contact/messages
 * @access  Private (Admin)
 */
exports.getContactMessages = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;

  const [messages, total] = await Promise.all([
    ContactMessage.find(filter)
      .populate('resolvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ContactMessage.countDocuments(filter)
  ]);

  sendSuccess(res, 200, 'Contact messages retrieved successfully', {
    messages,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

/**
 * @desc    Update a contact message status
 * @route   PATCH /api/v1/contact/messages/:id/status
 * @access  Private (Admin)
 */
exports.updateContactMessageStatus = asyncHandler(async (req, res) => {
  const contactMessage = await ContactMessage.findById(req.params.id);

  if (!contactMessage) {
    return sendError(res, 404, 'Contact message not found');
  }

  contactMessage.status = req.body.status;

  if (req.body.adminNotes !== undefined) {
    contactMessage.adminNotes = req.body.adminNotes || undefined;
  }

  if (req.body.status === 'resolved') {
    contactMessage.resolvedAt = new Date();
    contactMessage.resolvedBy = req.user._id;
  }

  await contactMessage.save();
  await contactMessage.populate('resolvedBy', 'firstName lastName email');

  sendSuccess(res, 200, 'Contact message updated successfully', {
    message: contactMessage
  });
});
