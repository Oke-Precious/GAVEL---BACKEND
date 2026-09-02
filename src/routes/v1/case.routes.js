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

const { uploadDocument, getCaseDocuments } = require('../../controllers/documentController');

const { protect, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const router = express.Router();

// Multer setup for CSV bulk import (in-memory buffer) and document uploads (disk storage)
const fs = require('fs');
const path = require('path');
const uploadDir = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const csvUpload = multer({ storage: multer.memoryStorage() });

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const docUpload = multer({ storage: diskStorage });

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
router.post('/bulk-import', authorize('admin', 'clerk'), csvUpload.single('file'), bulkImport);

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

// Case Documents (Nested)
router.route('/:id/documents')
  .get(getCaseDocuments)
  .post(authorize('admin', 'clerk', 'lawyer'), docUpload.single('file'), uploadDocument);

module.exports = router;
