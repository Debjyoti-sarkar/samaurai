const express = require("express");
const router = express.Router();
const { analyzeMessage, analyzePhoneNumber, checkOTPMessageLegitimacy } = require("../services/spamDetectionService");
const auth = require("../middleware/auth");
const FraudAlert = require("../models/FraudAlert");

// @route   POST /api/spam/analyze-message
// @desc    Analyze SMS message for spam
router.post("/analyze-message", auth, async (req, res) => {
  try {
    const { message, sender } = req.body;

    if (!message) {
      return res.status(400).json({ msg: "Message is required" });
    }

    const analysis = analyzeMessage(message, sender);

    // If spam detected, create fraud alert
    if (analysis.isSpam && analysis.spamScore > 60) {
      const alert = new FraudAlert({
        userId: req.user.id,
        type: "sms",
        severity: analysis.riskLevel,
        title: "Spam SMS Detected",
        description: `Potential spam message from ${sender}`,
        fraudScore: analysis.spamScore,
        phoneNumber: sender,
        messageContent: message,
      });

      await alert.save();
    }

    res.json(analysis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/spam/analyze-phone
// @desc    Analyze phone number for spam
router.post("/analyze-phone", auth, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ msg: "Phone number is required" });
    }

    const analysis = analyzePhoneNumber(phoneNumber);

    res.json(analysis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/spam/check-otp-legitimacy
// @desc    Check if OTP message is legitimate
router.post("/check-otp-legitimacy", auth, async (req, res) => {
  try {
    const { message, sender } = req.body;

    if (!message) {
      return res.status(400).json({ msg: "Message is required" });
    }

    const analysis = checkOTPMessageLegitimacy(message, sender);

    // If fraudulent OTP detected, create alert
    if (!analysis.isLegitimate && analysis.spamScore > 50) {
      const alert = new FraudAlert({
        userId: req.user.id,
        type: "otp",
        severity: "high",
        title: "Fraudulent OTP Detected",
        description: `Suspicious OTP message from ${sender}`,
        fraudScore: analysis.spamScore,
        phoneNumber: sender,
        messageContent: message,
      });

      await alert.save();
    }

    res.json(analysis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
