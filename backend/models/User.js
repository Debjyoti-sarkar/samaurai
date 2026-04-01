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

  // RBAC - Role-Based Access Control
  role: {
    type: String,
    enum: ["user", "analyst", "admin", "system"],
    default: "user",
  },
  permissions: [String], // Specific permissions beyond role

  // Security & Risk Tracking
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  riskLevel: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "low",
  },

  // Device tracking
  registeredDevices: [
    {
      deviceId: String,
      deviceName: String,
      deviceType: String, // mobile, web, etc.
      osType: String,
      registeredAt: Date,
      lastUsedAt: Date,
      status: {
        type: String,
        enum: ["active", "inactive", "blocked"],
        default: "active",
      },
      ipAddresses: [String],
      locations: [
        {
          latitude: Number,
          longitude: Number,
          country: String,
          city: String,
          firstSeen: Date,
          lastSeen: Date,
        },
      ],
    },
  ],

  // Account security flags
  accountStatus: {
    type: String,
    enum: ["active", "suspended", "locked", "under_review"],
    default: "active",
  },
  suspendedAt: Date,
  suspendedReason: String,

  // Verification status
  emailVerified: {
    type: Boolean,
    default: false,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  documentVerified: {
    type: Boolean,
    default: false,
  },

  // Risk events tracking
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lastFailedLoginAt: Date,
  lastSuccessfulLoginAt: Date,

  // Behavioral data for ML
  behaviorProfile: {
    averageTransactionAmount: Number,
    usualTransactionTimes: [Number], // hours of day
    preferredDevices: [String],
    preferredLocations: [String],
    usualTransactionFrequency: String, // daily, weekly, etc.
  },

  // Compliance & monitoring
  underInvestigation: {
    type: Boolean,
    default: false,
  },
  caseIds: [mongoose.Schema.Types.ObjectId], // Cases involving this user

  notificationPreferences: {
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: true,
    },
    alertsOn: {
      type: Boolean,
      default: true,
    },
  },

  // Audit
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.index({ role: 1 });
UserSchema.index({ riskLevel: 1 });
UserSchema.index({ accountStatus: 1 });

module.exports = mongoose.model("User", UserSchema);
