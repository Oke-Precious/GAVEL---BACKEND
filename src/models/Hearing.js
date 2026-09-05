const mongoose = require('mongoose');

const hearingSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true,
  },
  judge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required'],
  },
  purpose: {
    type: String,
    required: true,
    trim: true,
  },
  courtRoom: {
    type: String,
    trim: true,
  },
  outcome: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Adjourned', 'Cancelled'],
    default: 'Scheduled',
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Hearing', hearingSchema);
