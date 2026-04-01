const express = require("express");
const router = express.Router();
const { analyzeTextWithML, analyzeOTPMessage } = require("../services/realMlApiService");
const auth = require("../middleware/auth");

// @route   POST /api/ml/analyze-text
// @desc    Analyze text using ML
router.post("/analyze-text", auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ msg: "Text is required" });
    }

    const analysis = await analyzeTextWithML(text);
    
    res.json(analysis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/ml/analyze-otp
// @desc    Analyze OTP message for fraud
router.post("/analyze-otp", auth, async (req, res) => {
  try {
    const { message, sender } = req.body;

    if (!message) {
      return res.status(400).json({ msg: "Message is required" });
    }

    const analysis = await analyzeOTPMessage(message);
    
    res.json({
      ...analysis,
      sender,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
