/**
 * Behavior Event Model
 * Tracks all user actions and events for behavioral analysis
 */

const mongoose = require('mongoose');

const behaviorEventSchema = new mongoose.Schema({
  // Event Identifiers
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },

  // User Information
  userId: {
    type: String,
    required: true,
    index: true
  },
  phoneNumber: String,

  // Event Type
  eventType: {
    type: String,
    required: true,
    enum: [
      // Authentication Events
      'app_open',
      'app_background',
      'app_foreground',
      'login_attempt',
      'login_success',
      'login_failure',
      'biometric_attempt',
      'biometric_success',
      'biometric_failure',
      'pin_attempt',
      'pin_success',
      'pin_failure',
      'otp_request',
      'otp_verify',
      'logout',
      'session_timeout',

      // Navigation Events
      'screen_view',
      'screen_exit',
      'button_click',
      'navigation',

      // Transaction Events
      'transaction_initiate',
      'transaction_confirm',
      'transaction_cancel',
      'transaction_complete',
      'transaction_fail',
      'recipient_select',
      'recipient_add_new',
      'amount_enter',
      'upi_app_select',
      'payment_review',

      // Security Events
      'fraud_scan_start',
      'fraud_scan_complete',
      'suspicious_activity_detected',
      'reauth_triggered',
      'reauth_complete',
      'reauth_failed',
      'device_change_detected',
      'location_change_detected',

      // Feature Usage
      'qr_scan_start',
      'qr_scan_success',
      'qr_scan_fail',
      'voice_command_start',
      'voice_command_complete',
      'balance_check',
      'history_view',

      // Settings
      'settings_change',
      'pin_change',
      'biometric_toggle',
      'language_change',

      // Other
      'error_occurred',
      'crash',
      'custom'
    ],
    index: true
  },

  // Event Category
  category: {
    type: String,
    enum: ['authentication', 'navigation', 'transaction', 'security', 'feature', 'settings', 'error', 'other'],
    default: 'other'
  },

  // Event Data (flexible schema)
  eventData: {
    // Screen/Navigation
    screenName: String,
    previousScreen: String,
    buttonId: String,
    buttonLabel: String,

    // Transaction related
    transactionId: String,
    amount: Number,
    recipientUpiId: String,
    recipientName: String,

    // Authentication related
    authMethod: String,
    attemptNumber: Number,
    errorCode: String,
    errorMessage: String,

    // Additional data (flexible)
    additionalData: mongoose.Schema.Types.Mixed
  },

  // Device Information
  deviceInfo: {
    deviceId: String,
    deviceModel: String,
    manufacturer: String,
    osName: String,
    osVersion: String,
    appVersion: String,
    screenWidth: Number,
    screenHeight: Number,
    orientation: String,
    batteryLevel: Number,
    isCharging: Boolean,
    networkType: String, // wifi, cellular, none
    carrier: String
  },

  // Location Information
  locationInfo: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    altitude: Number,
    speed: Number,
    heading: Number,
    city: String,
    region: String,
    country: String,
    ipAddress: String,
    timezone: String
  },

  // Timing Information
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  clientTimestamp: Date,
  serverTimestamp: { type: Date, default: Date.now },
  timeSinceLastEvent: Number, // milliseconds
  timeSinceSessionStart: Number, // milliseconds

  // Behavioral Metrics (for ML)
  behavioralMetrics: {
    // Touch/Interaction metrics
    touchPressure: Number,
    touchDuration: Number, // milliseconds
    swipeVelocity: Number,
    scrollSpeed: Number,

    // Typing metrics
    typingSpeed: Number, // chars per minute
    keystrokeIntervals: [Number], // ms between keystrokes
    backspaceFrequency: Number,
    pasteUsed: Boolean,

    // Session metrics
    idleTime: Number, // ms since last interaction
    focusTime: Number, // ms on current screen
    interactionCount: Number // touches/clicks in session
  },

  // Risk Indicators
  riskIndicators: {
    isUnusualTime: Boolean,
    isUnusualDevice: Boolean,
    isUnusualLocation: Boolean,
    isHighVelocity: Boolean,
    isSuspiciousPattern: Boolean,
    riskScore: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false }
  },

  // Processing Status
  processed: { type: Boolean, default: false },
  processedAt: Date,

  // Metadata
  createdAt: { type: Date, default: Date.now }
});

// Compound indexes for efficient queries
behaviorEventSchema.index({ userId: 1, timestamp: -1 });
behaviorEventSchema.index({ sessionId: 1, timestamp: 1 });
behaviorEventSchema.index({ eventType: 1, timestamp: -1 });
behaviorEventSchema.index({ 'riskIndicators.flagged': 1, timestamp: -1 });
behaviorEventSchema.index({ processed: 1, createdAt: 1 });

// Static method to get session events
behaviorEventSchema.statics.getSessionEvents = function(sessionId) {
  return this.find({ sessionId })
    .sort({ timestamp: 1 });
};

// Static method to get user activity in time range
behaviorEventSchema.statics.getUserActivity = function(userId, startDate, endDate) {
  return this.find({
    userId,
    timestamp: {
      $gte: startDate,
      $lte: endDate || new Date()
    }
  }).sort({ timestamp: -1 });
};

// Static method to calculate session metrics
behaviorEventSchema.statics.calculateSessionMetrics = async function(sessionId) {
  const events = await this.find({ sessionId }).sort({ timestamp: 1 });

  if (events.length === 0) return null;

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  const sessionDuration = lastEvent.timestamp - firstEvent.timestamp;
  const eventCount = events.length;

  // Calculate time between events
  const intervals = [];
  for (let i = 1; i < events.length; i++) {
    intervals.push(events[i].timestamp - events[i - 1].timestamp);
  }

  const avgInterval = intervals.length > 0
    ? intervals.reduce((a, b) => a + b, 0) / intervals.length
    : 0;

  // Count event types
  const eventTypeCounts = {};
  events.forEach(e => {
    eventTypeCounts[e.eventType] = (eventTypeCounts[e.eventType] || 0) + 1;
  });

  return {
    sessionId,
    sessionDuration,
    eventCount,
    avgTimeBetweenEvents: avgInterval,
    eventTypeCounts,
    startTime: firstEvent.timestamp,
    endTime: lastEvent.timestamp,
    screens: [...new Set(events.filter(e => e.eventData?.screenName).map(e => e.eventData.screenName))]
  };
};

// Static method to detect anomalies in recent events
behaviorEventSchema.statics.detectAnomalies = async function(userId, windowMinutes = 30) {
  const startTime = new Date();
  startTime.setMinutes(startTime.getMinutes() - windowMinutes);

  const recentEvents = await this.find({
    userId,
    timestamp: { $gte: startTime }
  }).sort({ timestamp: -1 });

  const anomalies = [];

  // Check for rapid-fire events (bot behavior)
  const intervals = [];
  for (let i = 1; i < recentEvents.length; i++) {
    const interval = recentEvents[i - 1].timestamp - recentEvents[i].timestamp;
    intervals.push(interval);
    if (interval < 100) { // Less than 100ms between events
      anomalies.push({
        type: 'rapid_events',
        description: 'Unusually fast event sequence detected',
        events: [recentEvents[i - 1].eventId, recentEvents[i].eventId]
      });
    }
  }

  // Check for multiple failed auth attempts
  const failedAuths = recentEvents.filter(e =>
    ['login_failure', 'pin_failure', 'biometric_failure'].includes(e.eventType)
  );
  if (failedAuths.length >= 3) {
    anomalies.push({
      type: 'multiple_auth_failures',
      description: `${failedAuths.length} failed authentication attempts`,
      count: failedAuths.length
    });
  }

  // Check for device changes
  const deviceIds = [...new Set(recentEvents.map(e => e.deviceInfo?.deviceId).filter(Boolean))];
  if (deviceIds.length > 1) {
    anomalies.push({
      type: 'multiple_devices',
      description: 'Multiple devices detected in session',
      deviceCount: deviceIds.length
    });
  }

  return anomalies;
};

// Static method to get event frequency patterns
behaviorEventSchema.statics.getEventFrequencyPattern = async function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          hour: { $hour: '$timestamp' },
          eventType: '$eventType'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.hour',
        events: {
          $push: {
            type: '$_id.eventType',
            count: '$count'
          }
        },
        totalCount: { $sum: '$count' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

const BehaviorEvent = mongoose.model('BehaviorEvent', behaviorEventSchema);

module.exports = BehaviorEvent;
