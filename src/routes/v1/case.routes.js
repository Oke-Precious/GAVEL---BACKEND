const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');

const {
  getCases,
  createCase,
  getCaseById,
  updateCase,
  deleteCase,
  updateCaseStatus,
  getAuditLog,
  bulkImport,
  exportCases,
  getCaseQRSlip
} = require('../../controllers/caseController');

const { protect, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const router = express.Router();

// Multer setup for CSV bulk import (in-memory buffer)
const upload = multer({ storage: multer.memoryStorage() });

// Validation chains
const createCaseValidation = [
  body('caseNumber').trim().notEmpty().withMessage('Case number is required'),
  body('title').trim().notEmpty().withMessage('Case title is required'),
  body('stage').optional().isIn(['Pre-Trial', 'Trial', 'Judgment', 'Appealed', 'Closed']),
  body('status').optional().isIn(['Active', 'Stalled', 'Resolved']),
];

const updateStatusValidation = [
  body('stage').optional().isIn(['Pre-Trial', 'Trial', 'Judgment', 'Appealed', 'Closed']),
  body('status').optional().isIn(['Active', 'Stalled', 'Resolved']),
  body('comments').optional().isString(),
  body('stallReason').optional().isString(),
];

// Apply protection to all routes in this router
router.use(protect);

// Exports
router.get('/export', authorize('admin', 'judge'), exportCases);

// Bulk Import
router.post('/bulk-import', authorize('admin', 'clerk'), upload.single('file'), bulkImport);

// Main CRUD
router.route('/')
  .get(getCases)
  .post(authorize('admin', 'clerk'), createCaseValidation, validate, createCase);

router.route('/:id')
  .get(getCaseById)
  .patch(authorize('admin', 'clerk', 'judge'), updateCase)
  .delete(authorize('admin'), deleteCase);

// Status and Audit
router.post('/:id/status', authorize('admin', 'clerk', 'judge'), updateStatusValidation, validate, updateCaseStatus);
router.get('/:id/audit-log', getAuditLog);

// QR Slip
router.get('/:id/qr-slip', getCaseQRSlip);

module.exports = router;
