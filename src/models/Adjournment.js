const mongoose = require('mongoose');

const adjournmentSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  originalDate: {
    type: Date,
    required: true,
  },
  newDate: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    required: [true, 'Adjournment reason is required'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Adjournment', adjournmentSchema);
