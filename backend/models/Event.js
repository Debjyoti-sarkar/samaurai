const mongoose = require("mongoose");

/**
 * Event Model - Tracks all system events for correlation and analysis
 * Events are the foundation of the intelligence system
 */
const EventSchema = new mongoose.Schema({
  // Event identification
  eventId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    enum: [
      "login_attempt",
      "transaction",
      "device_used",
      "otp_sent",
      "otp_verified",
      "biometric_used",
      "session_created",
      "location_change",
      "aadhaar_verification",
      "api_call",
      "anomaly_detected",
      "fraud_alert",
      "case_created",
    ],
    required: true,
    index: true,
  },

  // Entity references
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
  },
  deviceId: {
    type: String,
    index: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    sparse: true,
  },

  // Event context
  description: String,
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["pending", "analyzed", "correlated", "actioned"],
    default: "pending",
    index: true,
  },

  // Event data
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },

  // Location and IP
  ipAddress: String,
  location: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number,
  },

  // Risk assessment (will be populated by risk engine)
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  riskLevel: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "low",
  },
  riskReasons: [String],

  // Correlation results
  correlatedEvents: [
    {
      eventId: String,
      type: String,
      similarity: Number, // 0-100
    },
  ],

  // Automation actions triggered
  automationActions: [
    {
      ruleId: mongoose.Schema.Types.ObjectId,
      action: String,
      status: String,
      timestamp: Date,
    },
  ],

  // Case reference
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Case",
    sparse: true,
  },

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for querying recent events by user
EventSchema.index({ userId: 1, timestamp: -1 });
EventSchema.index({ eventType: 1, timestamp: -1 });
EventSchema.index({ status: 1, riskLevel: 1 });

module.exports = mongoose.model("Event", EventSchema);
