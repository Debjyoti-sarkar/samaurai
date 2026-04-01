const mongoose = require("mongoose");

const LoanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  loanType: {
    type: String,
    enum: ["personal", "business", "education", "home", "vehicle"],
    required: true,
  },
  principalAmount: {
    type: Number,
    required: true,
  },
  interestRate: {
    type: Number,
    required: true,
  },
  tenureMonths: {
    type: Number,
    required: true,
  },
  emiAmount: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  remainingAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "active", "completed", "rejected", "defaulted"],
    default: "pending",
  },
  applicationDate: {
    type: Date,
    default: Date.now,
  },
  approvalDate: {
    type: Date,
  },
  disbursementDate: {
    type: Date,
  },
  nextEmiDate: {
    type: Date,
  },
  completionDate: {
    type: Date,
  },
  purpose: {
    type: String,
  },
  documents: [{
    type: String,
  }],
  creditScore: {
    type: Number,
  },
  rejectionReason: {
    type: String,
  },
});

module.exports = mongoose.model("Loan", LoanSchema);
