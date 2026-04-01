const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["send", "receive", "qr", "loan_disbursement", "emi_payment"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  recipientPhone: {
    type: String,
  },
  recipientName: {
    type: String,
  },
  recipientUPI: {
    type: String,
  },
  senderPhone: {
    type: String,
  },
  senderName: {
    type: String,
  },
  senderUPI: {
    type: String,
  },
  description: {
    type: String,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "flagged"],
    default: "pending",
  },
  transactionId: {
    type: String,
    unique: true,
    required: true,
  },
  fraudScore: {
    type: Number,
    default: 0,
  },
  fraudReason: {
    type: String,
  },
  isFlagged: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  method: {
    type: String,
    enum: ["upi", "bank", "qr", "loan"],
    default: "upi",
  },
  balanceAfter: {
    type: Number,
  },

  // Risk & Intelligence fields
  riskAssessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RiskAssessment",
    sparse: true,
  },
  riskLevel: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "low",
  },

  // Device & Location context
  deviceId: String,
  location: {
    latitude: Number,
    longitude: Number,
    country: String,
    city: String,
    ipAddress: String,
  },

  // Case management
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Case",
    sparse: true,
  },

  // Event correlation
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    sparse: true,
  },

  // Recipient risk tracking
  recipientUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    sparse: true,
  },
  recipientRiskScore: Number,

  // Automation actions
  automationActionsTriggered: [
    {
      ruleId: mongoose.Schema.Types.ObjectId,
      action: String,
      timestamp: Date,
    },
  ],

  // Verification requirements
  verificationRequired: {
    type: Boolean,
    default: false,
  },
  verificationMethods: [String],
  verificationStatus: String,

  // Metadata for analysis
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

TransactionSchema.index({ userId: 1, timestamp: -1 });
TransactionSchema.index({ riskLevel: 1, status: 1 });
TransactionSchema.index({ caseId: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
