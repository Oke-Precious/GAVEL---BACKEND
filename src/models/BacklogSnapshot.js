const mongoose = require('mongoose');

const backlogSnapshotSchema = new mongoose.Schema({
  snapshotDate: {
    type: Date,
    default: Date.now,
    index: true,
  },
  court: {
    type: String,
    required: true,
  },
  activeCount: {
    type: Number,
    default: 0,
  },
  stalledCount: {
    type: Number,
    default: 0,
  },
  totalBacklog: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BacklogSnapshot', backlogSnapshotSchema);
