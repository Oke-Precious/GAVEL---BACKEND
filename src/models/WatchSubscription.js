const mongoose = require('mongoose');
const crypto = require('crypto');

const watchSubscriptionSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  unsubscribeToken: {
    type: String,
    unique: true,
    index: true,
  }
}, {
  timestamps: true
});

// Ensure a user can only subscribe once per case
watchSubscriptionSchema.index({ caseId: 1, email: 1 }, { unique: true });

// Auto-generate unsubscribe token before saving
watchSubscriptionSchema.pre('save', function() {
  if (!this.unsubscribeToken) {
    this.unsubscribeToken = crypto.randomBytes(32).toString('hex');
  }
});

module.exports = mongoose.model('WatchSubscription', watchSubscriptionSchema);
