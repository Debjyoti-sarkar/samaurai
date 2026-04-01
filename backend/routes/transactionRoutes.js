const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const auth = require("../middleware/auth");
const mlFraudDetection = require("../services/mlFraudDetection");
const { sendTransactionNotification } = require("../services/notificationService");
const { logTransaction } = require("../services/activityLogger");

// @route   POST /api/transactions/send
// @desc    Send money
router.post("/send", auth, async (req, res) => {
  try {
    const { recipientPhone, recipientUPI, amount, description } = req.body;

    const sender = await User.findById(req.user.id);
    
    if (sender.balance < amount) {
      return res.status(400).json({ msg: "Insufficient balance" });
    }

    // Fraud detection
    const fraudAnalysis = await mlFraudDetection.analyzeTransaction({
      amount,
      recipientPhone,
      description,
      userId: req.user.id,
      type: "send",
    });

    if (fraudAnalysis.isFraud) {
      return res.status(403).json({
        msg: "Transaction blocked due to fraud detection",
        fraudAnalysis,
      });
    }

    const recipient = await User.findOne({
      $or: [{ phoneNumber: recipientPhone }, { upiId: recipientUPI }],
    });

    if (!recipient) {
      return res.status(404).json({ msg: "Recipient not found" });
    }

    // Create transaction
    const transaction = new Transaction({
      userId: req.user.id,
      type: "send",
      amount,
      recipientPhone: recipient.phoneNumber,
      recipientName: recipient.name,
      recipientUPI: recipient.upiId,
      senderPhone: sender.phoneNumber,
      senderName: sender.name,
      senderUPI: sender.upiId,
      description,
      status: "completed",
      transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      fraudScore: fraudAnalysis.fraudScore,
      balanceAfter: sender.balance - amount,
    });

    // Update balances
    sender.balance -= amount;
    recipient.balance += amount;

    await sender.save();
    await recipient.save();
    await transaction.save();

    // Create receive transaction for recipient
    const receiveTransaction = new Transaction({
      userId: recipient.id,
      type: "receive",
      amount,
      senderPhone: sender.phoneNumber,
      senderName: sender.name,
      senderUPI: sender.upiId,
      recipientPhone: recipient.phoneNumber,
      recipientName: recipient.name,
      recipientUPI: recipient.upiId,
      description,
      status: "completed",
      transactionId: transaction.transactionId,
      balanceAfter: recipient.balance,
    });

    await receiveTransaction.save();

    // Log and notify
    await logTransaction(req.user.id, transaction.transactionId, true);
    await sendTransactionNotification(req.user.id, transaction);
    await sendTransactionNotification(recipient.id, receiveTransaction);

    res.json({
      msg: "Transaction successful",
      transaction,
      newBalance: sender.balance,
      fraudAnalysis,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/transactions
// @desc    Get user transactions
router.get("/", auth, async (req, res) => {
  try {
    const { type, limit = 50, skip = 0 } = req.query;
    
    const query = { userId: req.user.id };
    if (type) query.type = type;

    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    res.json(transactions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/transactions/:id
// @desc    Get transaction by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({ msg: "Transaction not found" });
    }

    res.json(transaction);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
