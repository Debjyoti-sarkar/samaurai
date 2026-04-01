const mongoose = require("mongoose");

/**
 * RiskAssessment Model - Stores detailed risk evaluations
 * Tracks scoring rules applied, factor contributions, and historical assessments
 */
const RiskAssessmentSchema = new mongoose.Schema({
  assessmentId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },

  // Assessment target
  entityType: {
    type: String,
    enum: ["user", "transaction", "device", "session"],
    required: true,
  },
  entityId: {
    type: String,  // Changed from ObjectId to String to support transactionId "txn-xxx"
    required: true,
    index: true,
  },

  // Overall risk score
  overallRiskScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  },
  riskLevel: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    required: true,
  },

  // Risk factors (detailed breakdown)
  riskFactors: [
    {
      factorName: String, // e.g., "transaction_amount", "device_location_change"
      weight: Number, // 0-1
      score: Number, // contribution to overall score
      threshold: mongoose.Schema.Types.Mixed,
      currentValue: mongoose.Schema.Types.Mixed,
      reason: String,
    },
  ],

  // Rules applied
  rulesApplied: [
    {
      ruleId: mongoose.Schema.Types.ObjectId,
      ruleName: String,
      condition: String,
      score: Number,
      triggered: Boolean,
    },
  ],

  // Context
  context: {
    timeWindow: {
      start: Date,
      end: Date,
    },
    relatedEvents: [mongoose.Schema.Types.ObjectId],
  },

  // Action recommendations
  recommendedActions: [
    {
      action: String, // block, flag, monitor, alert
      confidence: Number, // 0-100
      reason: String,
    },
  ],

  // Manual review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    sparse: true,
  },
  reviewNotes: String,
  reviewedAt: Date,

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Index for querying recent assessments
RiskAssessmentSchema.index({ entityId: 1, createdAt: -1 });
RiskAssessmentSchema.index({ riskLevel: 1, createdAt: -1 });

module.exports = mongoose.model("RiskAssessment", RiskAssessmentSchema);
