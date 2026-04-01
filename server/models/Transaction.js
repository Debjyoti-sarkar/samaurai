/**
 * Transaction Model
 * Stores all transaction data for behavior analysis
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Transaction Identifiers
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: String,
    index: true
  },
  cfPaymentId: String, // Cashfree payment ID

  // User Information
  userId: {
    type: String,
    required: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },

  // Transaction Details
  type: {
    type: String,
    enum: ['send', 'receive', 'refund', 'failed', 'pending'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    index: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['initiated', 'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'],
    default: 'initiated',
    index: true
  },

  // Recipient Details
  recipient: {
    upiId: String,
    name: String,
    bankAccount: String,
    ifsc: String,
    phoneNumber: String,
    isNewRecipient: { type: Boolean, default: false }
  },

  // Sender Details (for received transactions)
  sender: {
    upiId: String,
    name: String,
    phoneNumber: String
  },

  // Payment Method
  paymentMethod: {
    type: { type: String, enum: ['upi', 'card', 'netbanking', 'wallet'] },
    provider: String, // Google Pay, PhonePe, etc.
    upiId: String,
    maskedCard: String
  },

  // Device Information
  deviceInfo: {
    deviceId: String,
    deviceModel: String,
    osName: String,
    osVersion: String,
    appVersion: String,
    screenResolution: String,
    isRooted: Boolean,
    isEmulator: Boolean
  },

  // Location Information
  locationInfo: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    ipAddress: String,
    vpnDetected: Boolean
  },

  // Timing Information
  timing: {
    initiatedAt: { type: Date, default: Date.now },
    processedAt: Date,
    completedAt: Date,
    duration: Number, // milliseconds from initiation to completion
    hourOfDay: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    isWeekend: Boolean,
    isHoliday: Boolean
  },

  // Session Information
  sessionInfo: {
    sessionId: String,
    sessionDuration: Number, // seconds before transaction
    actionsBeforeTransaction: Number,
    timeSinceLastAction: Number, // milliseconds
    authMethodUsed: { type: String, enum: ['pin', 'biometric', 'otp'] }
  },

  // Risk Assessment
  riskAssessment: {
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    riskFactors: [{
      factor: String,
      contribution: Number,
      description: String
    }],
    anomalyDetected: { type: Boolean, default: false },
    anomalyType: [String],
    mlModelScore: Number,
    mlModelVersion: String,
    requiresReauth: { type: Boolean, default: false },
    reauthCompleted: { type: Boolean, default: false },
    reauthMethod: String,
    manualReview: { type: Boolean, default: false },
    reviewedBy: String,
    reviewedAt: Date,
    reviewNotes: String
  },

  // Behavioral Features (for ML)
  behavioralFeatures: {
    amountDeviationFromAvg: Number, // Z-score
    isUnusualTime: Boolean,
    isUnusualLocation: Boolean,
    isUnusualDevice: Boolean,
    isUnusualRecipient: Boolean,
    velocityScore: Number, // Transactions in last hour
    patternMatchScore: Number
  },

  // Notes and Metadata
  note: String,
  merchantName: String,
  merchantCategory: String,
  tags: [String],

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound indexes for common queries
transactionSchema.index({ userId: 1, 'timing.initiatedAt': -1 });
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ 'riskAssessment.riskScore': -1 });
transactionSchema.index({ 'riskAssessment.anomalyDetected': 1, createdAt: -1 });
transactionSchema.index({ 'recipient.upiId': 1, userId: 1 });

// Pre-save middleware to calculate timing fields
transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  if (this.timing.initiatedAt) {
    const date = new Date(this.timing.initiatedAt);
    this.timing.hourOfDay = date.getHours();
    this.timing.dayOfWeek = date.getDay();
    this.timing.isWeekend = date.getDay() === 0 || date.getDay() === 6;
  }

  // Calculate duration if completed
  if (this.timing.completedAt && this.timing.initiatedAt) {
    this.timing.duration = new Date(this.timing.completedAt) - new Date(this.timing.initiatedAt);
  }

  next();
});

// Instance method to calculate behavioral features
transactionSchema.methods.calculateBehavioralFeatures = async function(userProfile) {
  if (!userProfile) return;

  const avgAmount = userProfile.transactionPatterns.avgTransactionAmount || 0;
  const stdDev = userProfile.transactionPatterns.stdDevAmount || 1;

  // Amount deviation (Z-score)
  this.behavioralFeatures.amountDeviationFromAvg =
    stdDev > 0 ? (this.amount - avgAmount) / stdDev : 0;

  // Check unusual time
  const hour = this.timing.hourOfDay;
  const preferredHours = userProfile.timePatterns.preferredHours || [];
  this.behavioralFeatures.isUnusualTime =
    preferredHours.length > 0 && !preferredHours.includes(hour);

  // Check unusual recipient
  const frequentRecipients = userProfile.recipientPatterns.frequentRecipients || [];
  const recipientIds = frequentRecipients.map(r => r.upiId);
  this.behavioralFeatures.isUnusualRecipient =
    this.recipient?.upiId && !recipientIds.includes(this.recipient.upiId);

  // Mark new recipient
  this.recipient.isNewRecipient = this.behavioralFeatures.isUnusualRecipient;
};

// Static method for aggregating user transaction stats
transactionSchema.statics.getUserTransactionStats = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId,
        'timing.initiatedAt': { $gte: startDate },
        status: 'success'
      }
    },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' },
        stdDevAmount: { $stdDevPop: '$amount' },
        uniqueRecipients: { $addToSet: '$recipient.upiId' }
      }
    },
    {
      $project: {
        _id: 0,
        totalTransactions: 1,
        totalAmount: 1,
        avgAmount: 1,
        maxAmount: 1,
        minAmount: 1,
        stdDevAmount: 1,
        uniqueRecipientsCount: { $size: '$uniqueRecipients' }
      }
    }
  ]);
};

// Static method to get recent transactions velocity
transactionSchema.statics.getTransactionVelocity = async function(userId, hours = 1) {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  const count = await this.countDocuments({
    userId,
    'timing.initiatedAt': { $gte: startDate }
  });

  return count;
};

// Static method for hourly distribution
transactionSchema.statics.getHourlyDistribution = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId,
        'timing.initiatedAt': { $gte: startDate },
        status: 'success'
      }
    },
    {
      $group: {
        _id: '$timing.hourOfDay',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
