const mongoose = require("mongoose");

const EMISchema = new mongoose.Schema({
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Loan",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  emiNumber: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  paidDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ["pending", "paid", "overdue", "partially_paid"],
    default: "pending",
  },
  principalComponent: {
    type: Number,
  },
  interestComponent: {
    type: Number,
  },
  penalty: {
    type: Number,
    default: 0,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
  },
});

module.exports = mongoose.model("EMI", EMISchema);
