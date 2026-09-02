const mongoose = require('mongoose');
const { generateCaseHashId } = require('../utils/generateCaseHashId');

const caseSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    required: [true, 'Case number is required'],
    unique: true,
    trim: true,
  },
  title: {
    type: String,
    required: [true, 'Case title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  stage: {
    type: String,
    enum: ['Pre-Trial', 'Trial', 'Judgment', 'Appealed', 'Closed'],
    default: 'Pre-Trial',
  },
  status: {
    type: String,
    enum: ['Active', 'Stalled', 'Resolved'],
    default: 'Active',
  },
  plaintiffs: [{
    type: String,
    trim: true,
  }],
  defendants: [{
    type: String,
    trim: true,
  }],
  lawyers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  judge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  court: {
    type: String, // Or could be a ref to a Court model
    trim: true,
  },
  filingDate: {
    type: Date,
    default: Date.now,
  },
  hashId: {
    type: String,
    unique: true,
    index: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-generate hashId before saving if not present
caseSchema.pre('save', function(next) {
  if (!this.hashId) {
    this.hashId = generateCaseHashId();
  }
  next();
});

// Populate lawyers and judge by default on find queries
caseSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'lawyers',
    select: 'firstName lastName email barNumber'
  }).populate({
    path: 'judge',
    select: 'firstName lastName email'
  });
  next();
});

module.exports = mongoose.model('Case', caseSchema);
