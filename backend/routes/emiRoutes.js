const express = require("express");
const router = express.Router();
const EMI = require("../models/EMI");
const Loan = require("../models/Loan");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { sendEMIReminder, sendLoanNotification } = require("../services/notificationService");

// @route   GET /api/emi
// @desc    Get all EMIs for user
router.get("/", auth, async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = { userId: req.user.id };
    if (status) query.status = status;

    const emis = await EMI.find(query)
      .populate("loanId")
      .sort({ dueDate: 1 });

    res.json(emis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/emi/due
// @desc    Get upcoming due EMIs
router.get("/due", auth, async (req, res) => {
  try {
    const emis = await EMI.find({
      userId: req.user.id,
      status: "pending",
      dueDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    })
      .populate("loanId")
      .sort({ dueDate: 1 });

    res.json(emis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/emi/:id/pay
// @desc    Pay EMI
router.post("/:id/pay", auth, async (req, res) => {
  try {
    const emi = await EMI.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!emi) {
      return res.status(404).json({ msg: "EMI not found" });
    }

    if (emi.status === "paid") {
      return res.status(400).json({ msg: "EMI already paid" });
    }

    const user = await User.findById(req.user.id);
    
    if (user.balance < emi.amount) {
      return res.status(400).json({ msg: "Insufficient balance" });
    }

    // Deduct from user balance
    user.balance -= emi.amount;
    await user.save();

    // Update EMI
    emi.status = "paid";
    emi.paidDate = new Date();
    await emi.save();

    // Update loan
    const loan = await Loan.findById(emi.loanId);
    loan.remainingAmount -= emi.amount;
    
    // Check if all EMIs are paid
    const remainingEMIs = await EMI.countDocuments({
      loanId: loan.id,
      status: { $ne: "paid" },
    });

    if (remainingEMIs === 0) {
      loan.status = "completed";
      loan.completionDate = new Date();
    }

    await loan.save();

    // Create transaction
    const transaction = new Transaction({
      userId: req.user.id,
      type: "emi_payment",
      amount: emi.amount,
      description: `EMI payment ${emi.emiNumber} for loan`,
      status: "completed",
      transactionId: `EMI${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      balanceAfter: user.balance,
    });

    await transaction.save();

    emi.transactionId = transaction.id;
    await emi.save();

    await sendLoanNotification(req.user.id, {
      message: `EMI of ₹${emi.amount} paid successfully`,
      priority: "medium",
      loanId: loan.id,
    });

    res.json({
      msg: "EMI paid successfully",
      emi,
      newBalance: user.balance,
      loanStatus: loan.status,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
