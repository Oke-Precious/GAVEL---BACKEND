const mongoose = require('mongoose');

const caseDocumentSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number, // in bytes
    required: true,
  },
  fileUrl: {
    type: String, // e.g., /uploads/filename.pdf
    required: true,
  },
  description: {
    type: String,
    trim: true,
  }
}, {
  timestamps: true
});

// Populate user info on find
caseDocumentSchema.pre(/^find/, function() {
  this.populate({
    path: 'uploadedBy',
    select: 'firstName lastName role email'
  });
});

module.exports = mongoose.model('CaseDocument', caseDocumentSchema);
