const mongoose = require("mongoose");

const FraudAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["transaction", "sms", "call", "otp", "behavior", "ml_detected"],
    required: true,
  },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  fraudScore: {
    type: Number,
    default: 0,
  },
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
  },
  phoneNumber: {
    type: String,
  },
  messageContent: {
    type: String,
  },
  mlAnalysis: {
    type: Object,
  },
  status: {
    type: String,
    enum: ["active", "resolved", "dismissed"],
    default: "active",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: {
    type: Date,
  },
  actionTaken: {
    type: String,
  },
});

module.exports = mongoose.model("FraudAlert", FraudAlertSchema);
