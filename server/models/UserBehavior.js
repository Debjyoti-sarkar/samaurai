/**
 * User Behavior Model
 * Stores user behavioral patterns for anomaly detection
 */

const mongoose = require('mongoose');

// User Behavior Profile Schema - Stores aggregated behavior patterns
const userBehaviorProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },

  // Transaction Patterns
  transactionPatterns: {
    avgTransactionAmount: { type: Number, default: 0 },
    maxTransactionAmount: { type: Number, default: 0 },
    minTransactionAmount: { type: Number, default: Infinity },
    totalTransactions: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    stdDevAmount: { type: Number, default: 0 },

    // Daily patterns
    dailyAvgTransactions: { type: Number, default: 0 },
    dailyAvgAmount: { type: Number, default: 0 },

    // Weekly patterns
    weeklyAvgTransactions: { type: Number, default: 0 },
    weeklyAvgAmount: { type: Number, default: 0 },

    // Monthly patterns
    monthlyAvgTransactions: { type: Number, default: 0 },
    monthlyAvgAmount: { type: Number, default: 0 }
  },

  // Time-based Patterns (0-23 hours)
  timePatterns: {
    preferredHours: [{ type: Number }], // Most active hours
    hourlyDistribution: {
      type: Map,
      of: Number,
      default: {}
    },
    preferredDays: [{ type: Number }], // 0-6 (Sunday-Saturday)
    dayDistribution: {
      type: Map,
      of: Number,
      default: {}
    }
  },

  // Recipient Patterns
  recipientPatterns: {
    frequentRecipients: [{
      upiId: String,
      name: String,
      transactionCount: Number,
      totalAmount: Number,
      lastTransaction: Date,
      trustScore: { type: Number, default: 0 }
    }],
    uniqueRecipientsCount: { type: Number, default: 0 },
    newRecipientFrequency: { type: Number, default: 0 } // New recipients per week
  },

  // Device Patterns
  devicePatterns: {
    trustedDevices: [{
      deviceId: String,
      deviceModel: String,
      osVersion: String,
      firstSeen: Date,
      lastSeen: Date,
      transactionCount: Number,
      trustScore: { type: Number, default: 100 }
    }],
    primaryDevice: {
      deviceId: String,
      deviceModel: String
    }
  },

  // Location Patterns
  locationPatterns: {
    trustedLocations: [{
      latitude: Number,
      longitude: Number,
      radius: { type: Number, default: 5 }, // km
      name: String,
      visitCount: Number,
      lastVisit: Date,
      trustScore: { type: Number, default: 100 }
    }],
    commonIPs: [{
      ip: String,
      firstSeen: Date,
      lastSeen: Date,
      accessCount: Number,
      location: String
    }]
  },

  // Session Patterns
  sessionPatterns: {
    avgSessionDuration: { type: Number, default: 0 }, // seconds
    avgActionsPerSession: { type: Number, default: 0 },
    avgTimeBetweenActions: { type: Number, default: 0 }, // milliseconds
    typingSpeed: { type: Number, default: 0 }, // characters per minute
    touchPressure: { type: Number, default: 0 } // average pressure
  },

  // Authentication Patterns
  authPatterns: {
    preferredAuthMethod: { type: String, enum: ['pin', 'biometric', 'both'], default: 'pin' },
    avgAuthAttempts: { type: Number, default: 1 },
    failedAuthAttempts: { type: Number, default: 0 },
    lastAuthMethod: String,
    biometricSuccessRate: { type: Number, default: 0 }
  },

  // Risk Metrics
  riskMetrics: {
    overallRiskScore: { type: Number, default: 0, min: 0, max: 100 },
    lastRiskAssessment: Date,
    riskFactors: [{
      factor: String,
      score: Number,
      timestamp: Date
    }],
    anomalyCount: { type: Number, default: 0 },
    flaggedTransactions: { type: Number, default: 0 }
  },

  // Feature Vector (for ML model)
  featureVector: {
    type: [Number],
    default: []
  },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  profileVersion: { type: Number, default: 1 }
});

// Indexes for faster queries
userBehaviorProfileSchema.index({ 'riskMetrics.overallRiskScore': -1 });
userBehaviorProfileSchema.index({ updatedAt: -1 });
userBehaviorProfileSchema.index({ lastActivity: -1 });

// Update timestamp on save
userBehaviorProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to calculate feature vector for ML
userBehaviorProfileSchema.methods.calculateFeatureVector = function() {
  const features = [
    this.transactionPatterns.avgTransactionAmount,
    this.transactionPatterns.stdDevAmount,
    this.transactionPatterns.dailyAvgTransactions,
    this.recipientPatterns.uniqueRecipientsCount,
    this.recipientPatterns.newRecipientFrequency,
    this.devicePatterns.trustedDevices?.length || 0,
    this.locationPatterns.trustedLocations?.length || 0,
    this.sessionPatterns.avgSessionDuration,
    this.sessionPatterns.avgTimeBetweenActions,
    this.authPatterns.avgAuthAttempts,
    this.authPatterns.failedAuthAttempts,
    this.riskMetrics.anomalyCount
  ];

  this.featureVector = features;
  return features;
};

// Static method to find high-risk users
userBehaviorProfileSchema.statics.findHighRiskUsers = function(threshold = 70) {
  return this.find({ 'riskMetrics.overallRiskScore': { $gte: threshold } })
    .sort({ 'riskMetrics.overallRiskScore': -1 });
};

const UserBehaviorProfile = mongoose.model('UserBehaviorProfile', userBehaviorProfileSchema);

module.exports = UserBehaviorProfile;
