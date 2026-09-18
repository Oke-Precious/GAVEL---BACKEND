const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createContactMessage,
  getContactMessages,
  updateContactMessageStatus
} = require('../../controllers/contactController');
const { protect, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { CONTACT_CATEGORIES, CONTACT_STATUSES } = require('../../constants/contact');

const router = express.Router();

const createContactValidation = [
  body('name')
    .optional()
    .isString().withMessage('Name must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Name cannot exceed 200 characters'),
  body('email')
    .isString().withMessage('Email must be a string')
    .trim()
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('category')
    .isString().withMessage('Category must be a string')
    .trim()
    .isIn(CONTACT_CATEGORIES).withMessage('Invalid contact category'),
  body('message')
    .isString().withMessage('Message must be a string')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ max: 5000 }).withMessage('Message cannot exceed 5000 characters')
];

const listContactValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('status')
    .optional()
    .isString().withMessage('Status must be a string')
    .trim()
    .isIn(CONTACT_STATUSES).withMessage('Invalid contact status'),
  query('category')
    .optional()
    .isString().withMessage('Category must be a string')
    .trim()
    .isIn(CONTACT_CATEGORIES).withMessage('Invalid contact category')
];

const updateContactValidation = [
  param('id').isMongoId().withMessage('Invalid contact message ID'),
  body('status')
    .isString().withMessage('Status must be a string')
    .trim()
    .isIn(CONTACT_STATUSES).withMessage('Invalid contact status'),
  body('adminNotes')
    .optional()
    .isString().withMessage('Admin notes must be a string')
    .trim()
    .isLength({ max: 5000 }).withMessage('Admin notes cannot exceed 5000 characters')
];

router.post('/', createContactValidation, validate, createContactMessage);
router.get('/messages', protect, authorize('admin'), listContactValidation, validate, getContactMessages);
router.patch('/messages/:id/status', protect, authorize('admin'), updateContactValidation, validate, updateContactMessageStatus);

module.exports = router;
