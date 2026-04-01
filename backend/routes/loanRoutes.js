const express = require("express");
const router = express.Router();
const Loan = require("../models/Loan");
const EMI = require("../models/EMI");
const auth = require("../middleware/auth");
const { calculateLoanDetails, generateAmortizationSchedule } = require("../services/emiCalculator");
const { sendLoanNotification } = require("../services/notificationService");

// @route   POST /api/loans/apply
// @desc    Apply for a loan
router.post("/apply", auth, async (req, res) => {
  try {
    const { loanType, principalAmount, interestRate, tenureMonths, purpose } = req.body;

    // Calculate loan details
    const loanDetails = calculateLoanDetails(principalAmount, interestRate, tenureMonths);

    const loan = new Loan({
      userId: req.user.id,
      loanType,
      principalAmount: loanDetails.principalAmount,
      interestRate: loanDetails.interestRate,
      tenureMonths: loanDetails.tenureMonths,
      emiAmount: loanDetails.emiAmount,
      totalAmount: loanDetails.totalPayment,
      remainingAmount: loanDetails.totalPayment,
      purpose,
      status: "pending",
    });

    await loan.save();

    await sendLoanNotification(req.user.id, {
      message: `Your loan application for ₹${principalAmount} has been submitted`,
      priority: "medium",
      loanId: loan.id,
    });

    res.json(loan);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/loans
// @desc    Get user's loans
router.get("/", auth, async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = { userId: req.user.id };
    if (status) query.status = status;

    const loans = await Loan.find(query).sort({ applicationDate: -1 });

    res.json(loans);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/loans/:id
// @desc    Get loan details
router.get("/:id", auth, async (req, res) => {
  try {
    const loan = await Loan.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!loan) {
      return res.status(404).json({ msg: "Loan not found" });
    }

    res.json(loan);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/loans/:id/approve
// @desc    Approve loan (admin only - simplified for demo)
router.put("/:id/approve", auth, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ msg: "Loan not found" });
    }

    loan.status = "approved";
    loan.approvalDate = new Date();
    loan.disbursementDate = new Date();
    loan.nextEmiDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await loan.save();

    // Generate EMI schedule
    const schedule = generateAmortizationSchedule(
      loan.principalAmount,
      loan.interestRate,
      loan.tenureMonths,
      loan.disbursementDate
    );

    // Create EMI records
    for (const emi of schedule) {
      const emiRecord = new EMI({
        loanId: loan.id,
        userId: req.user.id,
        emiNumber: emi.emiNumber,
        amount: emi.emiAmount,
        dueDate: emi.dueDate,
        principalComponent: emi.principalComponent,
        interestComponent: emi.interestComponent,
      });
      await emiRecord.save();
    }

    await sendLoanNotification(req.user.id, {
      message: `Your loan of ₹${loan.principalAmount} has been approved!`,
      priority: "high",
      loanId: loan.id,
    });

    res.json({ loan, emiSchedule: schedule });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/loans/:id/emis
// @desc    Get EMIs for a loan
router.get("/:id/emis", auth, async (req, res) => {
  try {
    const emis = await EMI.find({
      loanId: req.params.id,
      userId: req.user.id,
    }).sort({ emiNumber: 1 });

    res.json(emis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
