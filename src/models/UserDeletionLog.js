const mongoose = require('mongoose');
const { USER_ROLES } = require('../constants/roles');

const userDeletionLogSchema = new mongoose.Schema({
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  targetEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  targetFirstName: String,
  targetLastName: String,
  targetRole: {
    type: String,
    enum: USER_ROLES,
    required: true
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deletedByEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  deletedByRole: {
    type: String,
    enum: USER_ROLES,
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 500
  },
  dependencySnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  failureReason: String,
  deletedAt: Date
}, {
  timestamps: true
});

userDeletionLogSchema.index({ targetEmail: 1, createdAt: -1 });

module.exports = mongoose.model('UserDeletionLog', userDeletionLogSchema);
