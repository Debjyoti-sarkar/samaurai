/**
 * Fraud Alert Model
 * Stores fraud detection alerts and their resolution status
 */

const mongoose = require('mongoose');

const fraudAlertSchema = new mongoose.Schema({
  // Alert Identifiers
  alertId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // User Information
  userId: {
    type: String,
    required: true,
    index: true
  },
  phoneNumber: String,

  // Associated Transaction/Event
  transactionId: {
    type: String,
    index: true
  },
  eventId: String,
  sessionId: String,

  // Alert Details
  alertType: {
    type: String,
    required: true,
    enum: [
      'unusual_amount',
      'unusual_time',
      'unusual_location',
      'unusual_device',
      'unusual_recipient',
      'high_velocity',
      'pattern_anomaly',
      'ml_anomaly',
      'multiple_auth_failures',
      'device_change',
      'ip_change',
      'account_takeover_attempt',
      'suspicious_behavior',
      'bot_detected',
      'manual_flag'
    ],
    index: true
  },

  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },

  // Risk Scores
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    index: true
  },
  mlScore: Number, // Score from ML model
  ruleScore: Number, // Score from rule-based system
  combinedScore: Number,

  // Risk Factors
  riskFactors: [{
    factor: {
      type: String,
      enum: [
        'amount_deviation',
        'time_anomaly',
        'location_anomaly',
        'device_anomaly',
        'recipient_anomaly',
        'velocity_anomaly',
        'behavioral_anomaly',
        'session_anomaly',
        'auth_anomaly',
        'pattern_break'
      ]
    },
    score: Number,
    description: String,
    expectedValue: mongoose.Schema.Types.Mixed,
    actualValue: mongoose.Schema.Types.Mixed
  }],

  // Transaction Details (snapshot)
  transactionSnapshot: {
    amount: Number,
    recipientUpiId: String,
    recipientName: String,
    paymentMethod: String,
    timestamp: Date
  },

  // Context Information
  context: {
    // Device context
    deviceId: String,
    deviceModel: String,
    isNewDevice: Boolean,
    deviceTrustScore: Number,

    // Location context
    latitude: Number,
    longitude: Number,
    ipAddress: String,
    isNewLocation: Boolean,
    distanceFromUsual: Number, // km
    locationTrustScore: Number,

    // Time context
    hourOfDay: Number,
    dayOfWeek: Number,
    isUnusualTime: Boolean,
    timeFromLastTransaction: Number, // milliseconds

    // Behavioral context
    sessionDuration: Number,
    actionsInSession: Number,
    transactionsToday: Number,
    amountToday: Number
  },

  // Action Taken
  action: {
    type: String,
    enum: ['allow', 'block', 'challenge', 'flag_review', 'notify_user', 'require_reauth'],
    default: 'flag_review'
  },
  actionReason: String,
  actionTimestamp: Date,

  // Re-authentication
  reauthRequired: { type: Boolean, default: false },
  reauthMethod: {
    type: String,
    enum: ['pin', 'biometric', 'otp', 'security_questions']
  },
  reauthAttempts: { type: Number, default: 0 },
  reauthSuccessful: Boolean,
  reauthTimestamp: Date,

  // Resolution
  status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved_legitimate', 'resolved_fraud', 'escalated'],
    default: 'pending',
    index: true
  },
  resolution: {
    resolvedBy: String, // 'system', 'user', 'admin', 'ml_model'
    resolvedAt: Date,
    resolution: String,
    notes: String,
    isFraud: Boolean,
    confidenceLevel: Number
  },

  // User Notification
  userNotified: { type: Boolean, default: false },
  userNotifiedAt: Date,
  userNotificationMethod: String,
  userResponse: String,
  userResponseAt: Date,

  // ML Model Information
  mlModel: {
    modelVersion: String,
    modelName: String,
    features: [Number],
    prediction: Number,
    confidence: Number,
    explanations: [{
      feature: String,
      contribution: Number,
      direction: String
    }]
  },

  // Feedback for ML training
  feedback: {
    isCorrectPrediction: Boolean,
    actualOutcome: String,
    feedbackSource: String,
    feedbackAt: Date
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: Date // For auto-cleanup of old alerts
});

// Compound indexes
fraudAlertSchema.index({ userId: 1, createdAt: -1 });
fraudAlertSchema.index({ status: 1, severity: -1, createdAt: -1 });
fraudAlertSchema.index({ alertType: 1, status: 1 });
fraudAlertSchema.index({ transactionId: 1, status: 1 });

// Update timestamp on save
fraudAlertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to escalate alert
fraudAlertSchema.methods.escalate = function(reason) {
  this.status = 'escalated';
  this.severity = 'critical';
  this.action = 'block';
  this.actionReason = reason;
  this.actionTimestamp = new Date();
  return this.save();
};

// Instance method to resolve alert
fraudAlertSchema.methods.resolve = function(resolvedBy, resolution, isFraud, notes) {
  this.status = isFraud ? 'resolved_fraud' : 'resolved_legitimate';
  this.resolution = {
    resolvedBy,
    resolvedAt: new Date(),
    resolution,
    notes,
    isFraud
  };
  return this.save();
};

// Static method to get pending alerts
fraudAlertSchema.statics.getPendingAlerts = function(limit = 50) {
  return this.find({ status: 'pending' })
    .sort({ severity: -1, riskScore: -1, createdAt: -1 })
    .limit(limit);
};

// Static method to get user's recent alerts
fraudAlertSchema.statics.getUserAlerts = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    userId,
    createdAt: { $gte: startDate }
  }).sort({ createdAt: -1 });
};

// Static method for fraud statistics
fraudAlertSchema.statics.getStatistics = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.aggregate([
    {
      $match: { createdAt: { $gte: startDate } }
    },
    {
      $group: {
        _id: null,
        totalAlerts: { $sum: 1 },
        byType: {
          $push: '$alertType'
        },
        bySeverity: {
          $push: '$severity'
        },
        byStatus: {
          $push: '$status'
        },
        avgRiskScore: { $avg: '$riskScore' },
        confirmedFraud: {
          $sum: { $cond: [{ $eq: ['$resolution.isFraud', true] }, 1, 0] }
        },
        falsePositives: {
          $sum: { $cond: [{ $eq: ['$resolution.isFraud', false] }, 1, 0] }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalAlerts: 0,
      typeCounts: {},
      severityCounts: {},
      statusCounts: {},
      avgRiskScore: 0,
      confirmedFraud: 0,
      falsePositives: 0,
      precision: 0
    };
  }

  const result = stats[0];

  // Count occurrences
  const countOccurrences = arr => arr.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});

  return {
    totalAlerts: result.totalAlerts,
    typeCounts: countOccurrences(result.byType),
    severityCounts: countOccurrences(result.bySeverity),
    statusCounts: countOccurrences(result.byStatus),
    avgRiskScore: result.avgRiskScore,
    confirmedFraud: result.confirmedFraud,
    falsePositives: result.falsePositives,
    precision: result.confirmedFraud / (result.confirmedFraud + result.falsePositives) || 0
  };
};

const FraudAlert = mongoose.model('FraudAlert', fraudAlertSchema);

module.exports = FraudAlert;
