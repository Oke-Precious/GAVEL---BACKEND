const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  previousStage: {
    type: String,
  },
  newStage: {
    type: String,
    required: true,
  },
  previousStatus: {
    type: String,
  },
  newStatus: {
    type: String,
    required: true,
  },
  stallReason: {
    type: String,
    trim: true,
  },
  comments: {
    type: String,
    trim: true,
  }
}, {
  timestamps: true
});

// Populate user info on find
statusHistorySchema.pre(/^find/, function(next) {
  this.populate({
    path: 'changedBy',
    select: 'firstName lastName role'
  });
  next();
});

module.exports = mongoose.model('StatusHistory', statusHistorySchema);
