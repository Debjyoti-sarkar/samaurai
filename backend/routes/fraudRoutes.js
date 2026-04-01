const express = require("express");
const router = express.Router();
const FraudAlert = require("../models/FraudAlert");
const auth = require("../middleware/auth");
const mlFraudDetection = require("../services/mlFraudDetection");

// @route   GET /api/fraud-alerts
// @desc    Get user's fraud alerts
router.get("/", auth, async (req, res) => {
  try {
    const { status, type, limit = 50 } = req.query;
    
    const query = { userId: req.user.id };
    if (status) query.status = status;
    if (type) query.type = type;

    const alerts = await FraudAlert.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate("relatedTransactionId");

    res.json(alerts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/fraud-alerts
// @desc    Create fraud alert
router.post("/", auth, async (req, res) => {
  try {
    const { type, title, description, severity, phoneNumber, messageContent } = req.body;

    const alert = new FraudAlert({
      userId: req.user.id,
      type,
      title,
      description,
      severity,
      phoneNumber,
      messageContent,
    });

    await alert.save();

    res.json(alert);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/fraud-alerts/:id/resolve
// @desc    Resolve fraud alert
router.put("/:id/resolve", auth, async (req, res) => {
  try {
    const { actionTaken } = req.body;

    const alert = await FraudAlert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        status: "resolved",
        resolvedAt: new Date(),
        actionTaken,
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ msg: "Alert not found" });
    }

    res.json(alert);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/fraud-alerts/analyze-transaction
// @desc    Analyze transaction for fraud
router.post("/analyze-transaction", auth, async (req, res) => {
  try {
    const { amount, recipientPhone, description } = req.body;

    const analysis = await mlFraudDetection.analyzeTransaction({
      amount,
      recipientPhone,
      description,
      userId: req.user.id,
      type: "send",
    });

    res.json(analysis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
