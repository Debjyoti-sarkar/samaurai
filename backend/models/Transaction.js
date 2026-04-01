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
});

module.exports = mongoose.model("Transaction", TransactionSchema);
