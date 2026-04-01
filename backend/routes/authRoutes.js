const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { logLogin } = require("../services/activityLogger");
const { generateSecret } = require("../services/offlineOtpService");

// @route   POST /api/auth/register
// @desc    Register a new user
router.post("/register", async (req, res) => {
  try {
    const { phoneNumber, name, pin, language } = req.body;

    let user = await User.findOne({ phoneNumber });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // Hash PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    // Generate OTP secret for offline OTP
    const otpSecret = generateSecret();

    user = new User({
      phoneNumber,
      name,
      pin: hashedPin,
      language: language || "en",
      otpSecret,
    });

    await user.save();

    // Generate JWT
    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "30d" });

    await logLogin(user.id, true, { ipAddress: req.ip });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        upiId: user.upiId,
        language: user.language,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post("/login", async (req, res) => {
  try {
    const { phoneNumber, pin } = req.body;

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      await logLogin(null, false, { ipAddress: req.ip, errorMessage: "User not found" });
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      await logLogin(user.id, false, { ipAddress: req.ip, errorMessage: "Invalid PIN" });
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    await user.save();

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "30d" });

    await logLogin(user.id, true, { ipAddress: req.ip });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        upiId: user.upiId,
        language: user.language,
        biometricEnabled: user.biometricEnabled,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-pin");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/auth/change-pin
// @desc    Change user PIN
router.put("/change-pin", auth, async (req, res) => {
  try {
    const { oldPin, newPin } = req.body;

    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(oldPin, user.pin);
    
    if (!isMatch) {
      return res.status(400).json({ msg: "Current PIN is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    user.pin = await bcrypt.hash(newPin, salt);
    await user.save();

    res.json({ msg: "PIN changed successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
