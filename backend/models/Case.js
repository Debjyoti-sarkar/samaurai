const mongoose = require("mongoose");

/**
 * Case Model - Tracks suspicious activity investigations
 * Groups related events, users, transactions, devices
 */
const CaseSchema = new mongoose.Schema({
  caseId: {
    type: String,
    unique: true,
    required: true,
  },

  // Case metadata
  title: {
    type: String,
    required: true,
  },
  description: String,

  // Case classification
  caseType: {
    type: String,
    enum: ["fraud", "account_takeover", "suspicious_activity", "policy_violation"],
    required: true,
  },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    required: true,
  },
  status: {
    type: String,
    enum: ["open", "investigating", "escalated", "resolved", "closed"],
    default: "open",
    index: true,
  },

  // Associated entities
  primaryUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  
  involvedUsers: [
    {
      userId: mongoose.Schema.Types.ObjectId,
      role: String, // victim, perpetrator, involved
      addedAt: Date,
    },
  ],

  involvedTransactions: [mongoose.Schema.Types.ObjectId],
  involvedDevices: [
    {
      deviceId: String,
      context: String,
    },
  ],
  associatedEvents: [mongoose.Schema.Types.ObjectId],

  // Investigation details
  evidence: [
    {
      type: String,
      description: String,
      sourceEventId: mongoose.Schema.Types.ObjectId,
      timestamp: Date,
    },
  ],

  // Timeline
  initiatedAt: {
    type: Date,
    default: Date.now,
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  lastUpdated: {
    type: Date,
    default: Date.now,
  },

  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  // Resolution details
  resolution: {
    outcome: String, // fraud_confirmed, false_positive, policy_violated, etc.
    notes: String,
    actions: [String], // block_user, reverse_transaction, etc.
  },

  // Assignment
  assignedTo: [
    {
      userId: mongoose.Schema.Types.ObjectId,
      role: String, // investigator, supervisor, etc.
      assignedAt: Date,
    },
  ],

  // Audit trail
  activityLog: [
    {
      action: String,
      actor: mongoose.Schema.Types.ObjectId,
      timestamp: Date,
      details: String,
    },
  ],

  // Automation related
  automationRuleTriggered: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AutomationRule",
    sparse: true,
  },

  tags: [String],

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Index for case queries
CaseSchema.index({ status: 1, severity: 1 });
CaseSchema.index({ primaryUser: 1, createdAt: -1 });

module.exports = mongoose.model("Case", CaseSchema);
