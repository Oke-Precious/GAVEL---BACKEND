const mongoose = require('mongoose');
const { CONTACT_CATEGORIES, CONTACT_STATUSES } = require('../constants/contact');

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    index: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: CONTACT_CATEGORIES,
    index: true
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  status: {
    type: String,
    enum: CONTACT_STATUSES,
    default: 'new',
    index: true
  },
  userAgent: {
    type: String,
    trim: true,
    maxlength: [1000, 'User agent cannot exceed 1000 characters']
  },
  ipAddress: {
    type: String,
    trim: true,
    maxlength: [100, 'IP address cannot exceed 100 characters']
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: [5000, 'Admin notes cannot exceed 5000 characters']
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ status: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
