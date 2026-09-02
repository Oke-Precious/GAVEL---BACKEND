const CaseDocument = require('../models/CaseDocument');
const Case = require('../models/Case');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const fs = require('fs');
const path = require('path');

/**
 * @desc    Upload document attached to a case
 * @route   POST /api/v1/cases/:id/documents
 * @access  Private (Admin / Clerk / Lawyer assigned to case)
 */
exports.uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, 'Please upload a file');
  }

  const { id: caseId } = req.params;
  const { description } = req.body;

  // Verify case exists
  const caseData = await Case.findById(caseId);
  if (!caseData) {
    // Clean up uploaded file if case doesn't exist
    fs.unlinkSync(req.file.path);
    return sendError(res, 404, 'Case not found');
  }

  // Generate file URL (accessible via express static)
  // Converting backslashes to forward slashes for URLs
  const relativePath = req.file.path.replace(/\\/g, '/');
  const fileUrl = `/${relativePath}`; 

  const document = await CaseDocument.create({
    caseId,
    uploadedBy: req.user._id,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    fileUrl,
    description
  });

  sendSuccess(res, 201, 'Document uploaded successfully', { document });
});

/**
 * @desc    Get all documents for a case
 * @route   GET /api/v1/cases/:id/documents
 * @access  Private
 */
exports.getCaseDocuments = asyncHandler(async (req, res) => {
  const documents = await CaseDocument.find({ caseId: req.params.id }).sort({ createdAt: -1 });

  sendSuccess(res, 200, 'Documents retrieved successfully', { documents });
});

/**
 * @desc    Delete a document
 * @route   DELETE /api/v1/documents/:id
 * @access  Private (Admin / Uploader)
 */
exports.deleteDocument = asyncHandler(async (req, res) => {
  const document = await CaseDocument.findById(req.params.id);

  if (!document) {
    return sendError(res, 404, 'Document not found');
  }

  // Authorization check (Admin or the uploader)
  if (req.user.role !== 'admin' && document.uploadedBy._id.toString() !== req.user._id.toString()) {
    return sendError(res, 403, 'Not authorized to delete this document');
  }

  // Delete physical file
  try {
    const filePath = path.join(process.cwd(), document.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting physical file:', error);
    // Continue with DB deletion even if physical deletion fails
  }

  // Delete DB record
  await document.deleteOne();

  sendSuccess(res, 200, 'Document deleted successfully');
});
