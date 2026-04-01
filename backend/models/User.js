const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  pin: {
    type: String,
    required: true,
  },
  aadhaarNumber: {
    type: String,
    sparse: true,
  },
  aadhaarVerified: {
    type: Boolean,
    default: false,
  },
  balance: {
    type: Number,
    default: 0,
  },
  upiId: {
    type: String,
    unique: true,
    sparse: true,
  },
  accountNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  ifscCode: {
    type: String,
  },
  bankName: {
    type: String,
  },
  biometricEnabled: {
    type: Boolean,
    default: false,
  },
  faceVerificationEnabled: {
    type: Boolean,
    default: false,
  },
  otpSecret: {
    type: String, // For offline OTP generation
  },
  language: {
    type: String,
    default: "en",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("User", UserSchema);
