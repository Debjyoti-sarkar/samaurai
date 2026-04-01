const express = require("express");
const router = express.Router();
const { generateOTP, verifyOTP, getTimeRemaining } = require("../services/offlineOtpService");
const auth = require("../middleware/auth");
const User = require("../models/User");

// @route   GET /api/offline-otp/generate
// @desc    Generate offline OTP for user
router.get("/generate", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.otpSecret) {
      return res.status(400).json({ msg: "Offline OTP not set up" });
    }

    const result = generateOTP(user.otpSecret);

    res.json({
      ...result,
      timeRemaining: getTimeRemaining(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/offline-otp/verify
// @desc    Verify offline OTP
router.post("/verify", auth, async (req, res) => {
  try {
    const { otp } = req.body;

    const user = await User.findById(req.user.id);

    if (!user.otpSecret) {
      return res.status(400).json({ msg: "Offline OTP not set up" });
    }

    const result = verifyOTP(otp, user.otpSecret);

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/offline-otp/time-remaining
// @desc    Get time remaining for current OTP
router.get("/time-remaining", auth, async (req, res) => {
  try {
    const timeRemaining = getTimeRemaining();
    res.json({ timeRemaining });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
