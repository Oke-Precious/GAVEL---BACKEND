const Case = require('../models/Case');
const StatusHistory = require('../models/StatusHistory');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const qrService = require('../services/qrService');
const exportService = require('../services/exportService');
const { Readable } = require('stream');

/**
 * @desc    Get all cases (paginated, filtered, role-scoped)
 * @route   GET /api/v1/cases
 * @access  Private
 */
exports.getCases = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, stage } = req.query;
  const query = {};

  // Filters
  if (status) query.status = status;
  if (stage) query.stage = stage;

  // Role scoping
  if (req.user.role === 'judge') {
    query.judge = req.user._id;
  } else if (req.user.role === 'lawyer') {
    query.lawyers = req.user._id;
  }
  // Admins see everything, litigants might need custom logic to find cases where they are a party

  const cases = await Case.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const count = await Case.countDocuments(query);

  sendSuccess(res, 200, 'Cases retrieved successfully', {
    cases,
    totalPages: Math.ceil(count / limit),
    currentPage: Number(page),
    totalCases: count
  });
});

/**
 * @desc    Create new case
 * @route   POST /api/v1/cases
 * @access  Private (Admin / Clerk)
 */
exports.createCase = asyncHandler(async (req, res) => {
  const newCase = await Case.create(req.body);

  // Create initial status history record
  await StatusHistory.create({
    caseId: newCase._id,
    changedBy: req.user._id,
    newStage: newCase.stage,
    newStatus: newCase.status,
    comments: 'Case filed/created',
  });

  sendSuccess(res, 201, 'Case created successfully', { case: newCase });
});

/**
 * @desc    Get single case by ID
 * @route   GET /api/v1/cases/:id
 * @access  Private
 */
exports.getCaseById = asyncHandler(async (req, res) => {
  const caseData = await Case.findById(req.params.id);

  if (!caseData) {
    return sendError(res, 404, 'Case not found');
  }

  sendSuccess(res, 200, 'Case retrieved successfully', { case: caseData });
});

/**
 * @desc    Update case details (general)
 * @route   PATCH /api/v1/cases/:id
 * @access  Private (Admin / Clerk / Judge)
 */
exports.updateCase = asyncHandler(async (req, res) => {
  // Prevent updating stage/status through this generic endpoint
  const updateData = { ...req.body };
  delete updateData.stage;
  delete updateData.status;

  const caseData = await Case.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!caseData) {
    return sendError(res, 404, 'Case not found');
  }

  sendSuccess(res, 200, 'Case updated successfully', { case: caseData });
});

/**
 * @desc    Delete case
 * @route   DELETE /api/v1/cases/:id
 * @access  Private (Admin only)
 */
exports.deleteCase = asyncHandler(async (req, res) => {
  const caseData = await Case.findById(req.params.id);

  if (!caseData) {
    return sendError(res, 404, 'Case not found');
  }

  await caseData.deleteOne();
  // Also delete associated status history
  await StatusHistory.deleteMany({ caseId: req.params.id });

  sendSuccess(res, 200, 'Case deleted successfully');
});

/**
 * @desc    Update case status/stage and write to StatusHistory
 * @route   POST /api/v1/cases/:id/status
 * @access  Private (Admin / Judge / Clerk)
 */
exports.updateCaseStatus = asyncHandler(async (req, res) => {
  const { stage, status, stallReason, comments } = req.body;
  const caseData = await Case.findById(req.params.id);

  if (!caseData) {
    return sendError(res, 404, 'Case not found');
  }

  const previousStage = caseData.stage;
  const previousStatus = caseData.status;

  // Update Case
  if (stage) caseData.stage = stage;
  if (status) caseData.status = status;
  await caseData.save();

  // Write Audit Log
  const history = await StatusHistory.create({
    caseId: caseData._id,
    changedBy: req.user._id,
    previousStage,
    newStage: caseData.stage,
    previousStatus,
    newStatus: caseData.status,
    stallReason,
    comments
  });

  sendSuccess(res, 200, 'Case status updated successfully', { case: caseData, history });
});

/**
 * @desc    Get case audit log (StatusHistory)
 * @route   GET /api/v1/cases/:id/audit-log
 * @access  Private
 */
exports.getAuditLog = asyncHandler(async (req, res) => {
  const logs = await StatusHistory.find({ caseId: req.params.id }).sort({ createdAt: -1 });

  sendSuccess(res, 200, 'Audit log retrieved successfully', { logs });
});

/**
 * @desc    Bulk import cases via CSV
 * @route   POST /api/v1/cases/bulk-import
 * @access  Private (Admin / Clerk)
 */
exports.bulkImport = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, 'Please upload a CSV file');
  }

  const csvString = req.file.buffer.toString('utf-8');
  const rows = csvString.split('\n').map(row => row.trim()).filter(row => row.length > 0);
  
  if (rows.length < 2) {
    return sendError(res, 400, 'CSV file is empty or missing headers');
  }

  const headers = rows[0].split(',').map(h => h.trim());
  const casesToInsert = [];
  
  let successCount = 0;
  let failedCount = 0;
  const errors = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(',').map(v => v.trim());
    const caseObj = {};
    
    headers.forEach((header, index) => {
      // Basic assignment, assuming headers match schema exactly for this simple native parser
      caseObj[header] = values[index];
    });

    try {
      // Very basic validation simulation
      if (!caseObj.caseNumber || !caseObj.title) {
        throw new Error('Missing required fields: caseNumber or title');
      }
      casesToInsert.push(caseObj);
      successCount++;
    } catch (err) {
      failedCount++;
      errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  if (casesToInsert.length > 0) {
    await Case.insertMany(casesToInsert, { ordered: false });
  }

  sendSuccess(res, 200, 'Bulk import completed', {
    successCount,
    failedCount,
    errors
  });
});

/**
 * @desc    Export cases to CSV or PDF
 * @route   GET /api/v1/cases/export
 * @access  Private (Admin / Judge)
 */
exports.exportCases = asyncHandler(async (req, res) => {
  const { format = 'csv', caseId } = req.query;

  if (format === 'pdf') {
    if (!caseId) {
      return sendError(res, 400, 'caseId is required for PDF export');
    }
    const caseData = await Case.findById(caseId);
    if (!caseData) return sendError(res, 404, 'Case not found');

    const pdfBuffer = await exportService.exportToPDF(caseData);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Case_${caseData.caseNumber}.pdf`);
    return res.end(pdfBuffer);
  } else {
    // Default to CSV
    const cases = await Case.find().lean();
    const csvData = exportService.exportToCSV(cases);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=Cases_Export.csv');
    return res.end(csvData);
  }
});

/**
 * @desc    Get case QR slip
 * @route   GET /api/v1/cases/:id/qr-slip
 * @access  Private
 */
exports.getCaseQRSlip = asyncHandler(async (req, res) => {
  const caseData = await Case.findById(req.params.id);

  if (!caseData) {
    return sendError(res, 404, 'Case not found');
  }

  const qrDataUrl = await qrService.generateCaseQRSlip(caseData);

  sendSuccess(res, 200, 'QR Slip generated successfully', {
    qrCode: qrDataUrl,
    caseNumber: caseData.caseNumber,
    hashId: caseData.hashId
  });
});
