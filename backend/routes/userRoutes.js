const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Account = require("../models/Account");
const auth = require("../middleware/auth");

// @route   GET /api/user/profile
// @desc    Get user profile
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-pin");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
router.put("/profile", auth, async (req, res) => {
  try {
    const { name, language } = req.body;

    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (language) user.language = language;

    await user.save();

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/user/upi
// @desc    Set/update UPI ID
router.put("/upi", auth, async (req, res) => {
  try {
    const { upiId } = req.body;

    // Check if UPI ID already exists
    const existingUser = await User.findOne({ upiId });
    if (existingUser && existingUser.id !== req.user.id) {
      return res.status(400).json({ msg: "UPI ID already in use" });
    }

    const user = await User.findById(req.user.id);
    user.upiId = upiId;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/user/biometric
// @desc    Enable/disable biometric
router.put("/biometric", auth, async (req, res) => {
  try {
    const { enabled } = req.body;

    const user = await User.findById(req.user.id);
    user.biometricEnabled = enabled;
    await user.save();

    res.json({ biometricEnabled: user.biometricEnabled });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/user/balance
// @desc    Get user balance
router.get("/balance", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ balance: user.balance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/user/accounts
// @desc    Get linked bank accounts
router.get("/accounts", auth, async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user.id });
    res.json(accounts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/user/accounts
// @desc    Link bank account
router.post("/accounts", auth, async (req, res) => {
  try {
    const { accountNumber, bankName, ifscCode, accountType } = req.body;

    const account = new Account({
      userId: req.user.id,
      accountNumber,
      bankName,
      ifscCode,
      accountType,
      isLinked: true,
      linkedDate: new Date(),
    });

    await account.save();

    res.json(account);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
