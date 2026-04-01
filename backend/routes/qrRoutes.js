const express = require("express");
const router = express.Router();
const { generateUPIQRCode, generatePaymentQRCode, parseUPIString } = require("../services/qrService");
const auth = require("../middleware/auth");
const User = require("../models/User");

// @route   POST /api/qr/generate
// @desc    Generate UPI QR code
router.post("/generate", auth, async (req, res) => {
  try {
    const { amount, note } = req.body;

    const user = await User.findById(req.user.id);

    if (!user.upiId) {
      return res.status(400).json({ msg: "UPI ID not set. Please set up your UPI ID first." });
    }

    const result = await generateUPIQRCode({
      upiId: user.upiId,
      name: user.name,
      amount,
      transactionNote: note,
    });

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/qr/generate-payment
// @desc    Generate payment QR code
router.post("/generate-payment", auth, async (req, res) => {
  try {
    const { recipientUPI, recipientName, amount, note } = req.body;

    const result = await generatePaymentQRCode({
      recipientUPI,
      recipientName,
      amount,
      note,
    });

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/qr/parse
// @desc    Parse UPI string from QR code
router.post("/parse", auth, async (req, res) => {
  try {
    const { upiString } = req.body;

    const result = parseUPIString(upiString);

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
