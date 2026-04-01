const mongoose = require("mongoose");

/**
 * Alert Model - System-generated and manual alerts for suspicious activity
 */
const AlertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },

  // Alert classification
  alertType: {
    type: String,
    enum: [
      "fraud_alert",
      "anomaly_alert",
      "rule_violation",
      "verification_required",
      "account_security",
      "manual_alert",
    ],
    required: true,
  },

  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    required: true,
    index: true,
  },

  // Alert trigger
  triggerType: String, // "high_risk_score", "pattern_detected", etc.
  triggerSource: {
    type: String,
    enum: ["automation_rule", "manual", "ml_model", "analyst"],
  },
  sourceRuleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AutomationRule",
    sparse: true,
  },

  // Affected entities
  primaryUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    sparse: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    sparse: true,
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Case",
    sparse: true,
  },

  // Alert content
  title: String,
  message: String,
  details: mongoose.Schema.Types.Mixed,

  // Status
  status: {
    type: String,
    enum: ["new", "acknowledged", "investigating", "resolved", "false_positive"],
    default: "new",
    index: true,
  },

  // Response tracking
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    sparse: true,
  },
  acknowledgedAt: Date,
  acknowledgmentNotes: String,

  // Recommended actions
  recommendedActions: [String],
  actionsTaken: [
    {
      action: String,
      takenBy: mongoose.Schema.Types.ObjectId,
      timestamp: Date,
      notes: String,
    },
  ],

  // Escalation
  escalated: {
    type: Boolean,
    default: false,
  },
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    sparse: true,
  },
  escalationReason: String,

  // Notifications
  notificationChannels: [String], // email, sms, in_app, dashboard
  notificationsSent: [
    {
      channel: String,
      recipientId: mongoose.Schema.Types.ObjectId,
      sentAt: Date,
      status: String, // sent, failed, delivered
    },
  ],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  resolvedAt: Date,
  expiresAt: Date,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    sparse: true,
  },
});

// Index for alert queries
AlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
AlertSchema.index({ primaryUserId: 1, status: 1 });

module.exports = mongoose.model("Alert", AlertSchema);
