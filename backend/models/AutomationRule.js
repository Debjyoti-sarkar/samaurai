const mongoose = require("mongoose");

/**
 * AutomationRule Model - Defines rules for automated actions based on risk/events
 * Example: If risk_score > 80 AND transaction_amount > 50000, THEN block and alert
 */
const AutomationRuleSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },

  // Rule metadata
  name: {
    type: String,
    required: true,
  },
  description: String,

  // Rule trigger conditions
  triggers: [
    {
      type: String, // event_type, risk_score, anomaly, pattern
      eventType: String, // for "event_type" trigger
      condition: String, // gt, lt, eq, contains, etc.
      value: mongoose.Schema.Types.Mixed,
      operator: {
        type: String,
        enum: ["AND", "OR"],
        default: "AND",
      },
    },
  ],

  // Conditions that must be met
  conditions: [
    {
      type: String, // risk_score_threshold, user_status, transaction_status
      operator: String, // gt, lt, eq, gte, lte, between, contains, matches
      value: mongoose.Schema.Types.Mixed,
      field: String,
    },
  ],

  // Actions to execute when rule triggers
  actions: [
    {
      actionType: {
        type: String,
        enum: [
          "block_transaction",
          "flag_user",
          "send_alert",
          "create_case",
          "request_verification",
          "suspend_account",
          "notify_user",
          "escalate_to_analyst",
        ],
        required: true,
      },
      parameters: mongoose.Schema.Types.Mixed, // action-specific params
      priority: {
        type: Number,
        default: 0, // execution order
      },
      enabled: {
        type: Boolean,
        default: true,
      },
    },
  ],

  // Rule configuration
  isActive: {
    type: Boolean,
    default: true,
  },
  priority: {
    type: Number,
    default: 0, // Higher number = higher priority
  },

  // Rule scope
  applicableEntityTypes: {
    type: [String],
    default: ["transaction", "user", "session"], // Which entities this applies to
  },

  // Performance settings
  cooldownSeconds: {
    type: Number,
    default: 0, // Prevent rule from firing again within this time
  },
  maxActionsPerDay: {
    type: Number,
    default: 1000, // Cap on how many times actions execute per day
  },

  // Execution history
  executionStats: {
    totalExecutions: {
      type: Number,
      default: 0,
    },
    successfulExecutions: {
      type: Number,
      default: 0,
    },
    lastExecutedAt: Date,
    lastExecutedFor: String, // entityId
  },

  // Override conditions
  overrideable: {
    type: Boolean,
    default: false,
  },
  allowedOverrideRoles: [String], // ["admin", "senior_analyst"]

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
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

// Index for active rule queries
AutomationRuleSchema.index({ isActive: 1, priority: -1 });

module.exports = mongoose.model("AutomationRule", AutomationRuleSchema);
