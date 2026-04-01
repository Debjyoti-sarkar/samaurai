const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  activityType: {
    type: String,
    enum: ["login", "logout", "transaction", "pin_change", "settings_change", "biometric_auth", "face_verification", "otp_verification", "loan_application", "emi_payment"],
    required: true,
  },
  description: {
    type: String,
  },
  ipAddress: {
    type: String,
  },
  deviceInfo: {
    type: Object,
  },
  location: {
    type: Object,
  },
  success: {
    type: Boolean,
    default: true,
  },
  errorMessage: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: Object,
  },
});

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
