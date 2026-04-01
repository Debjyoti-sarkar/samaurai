require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ extended: false }));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/ml", require("./routes/mlRoutes"));
app.use("/api/fraud-alerts", require("./routes/fraudRoutes"));
app.use("/api/loans", require("./routes/loanRoutes"));
app.use("/api/emi", require("./routes/emiRoutes"));
app.use("/api/qr", require("./routes/qrRoutes"));
app.use("/api/offline-otp", require("./routes/offlineOtpRoutes"));
app.use("/api/otp", require("./routes/otpRoutes")); // Real OTP with Fast2SMS
app.use("/api/aadhaar", require("./routes/aadhaarRoutes")); // Aadhaar Verification
app.use("/api/spam", require("./routes/spamRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/activity", require("./routes/activityRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/intelligence", require("./routes/intelligenceRoutes")); // Intelligence Platform

// KAVACH Shield Fraud Risk Verification Endpoint
app.post("/api/check-risk", (req, res) => {
  try {
    const { value, amount, isFirstTransaction } = req.body;
    let score = 0;
    let reasons = [];
    
    if (!value) {
      return res.status(400).json({ error: "Missing value (UPI/Phone/Link)" });
    }

    const valueLower = value.toLowerCase();

    // 1. Blacklist check
    const blacklist = ["fraud@upi", "scam@okaxis", "test@upi"];
    if (blacklist.includes(valueLower)) {
      score += 95;
      reasons.push("Blacklisted UPI ID or Phone");
      return res.json({ risk: "HIGH", score: Math.min(score, 100), reasons });
    }

    // 2. Invalid UPI Format
    // We assume if it's less than 10 chars without '@', it could be a weird ID. 
    // The prompt says "no '@' -> +50"
    if (!valueLower.includes("@") && valueLower.length > 0) {
      // It might be a phone number if it's 10 digits without '@'. But we'll follow the exact rule for now.
      // If we want to be safe, we check if it's purely numerical phone. The prompt explicitly says invalid UPI format (no "@") -> +50
      score += 50;
      reasons.push("Invalid UPI format (missing '@')");
    }

    // 3. Suspicious keywords
    const suspiciousKeywords = ["fraud", "test", "support", "help", "refund", "bank"];
    const hasSuspiciousKeyword = suspiciousKeywords.some(keyword => valueLower.includes(keyword));
    if (hasSuspiciousKeyword) {
      score += 30;
      reasons.push("Suspicious keywords in recipient ID");
    }

    // 4. Short ID
    if (valueLower.length < 6) {
      score += 20;
      reasons.push("Very short recipient ID (<6 chars)");
    }

    // 5. First-time transaction
    if (isFirstTransaction) {
      score += 10;
      reasons.push("First-time transaction with this recipient");
    }

    // 6. Large amount
    if (amount && Number(amount) > 5000) {
      score += 20;
      reasons.push("Unusually large amount (> ₹5000)");
    }
    
    // Optional: Placeholder for External API check
    // async function checkExternalPhishingDB(id) { /* calls VirusTotal */ }
    // const isExternalFlagged = await checkExternalPhishingDB(value);

    // Calculate Risk Level
    let risk = "LOW";
    if (score >= 70) {
      risk = "HIGH";
    } else if (score >= 30) {
      risk = "MEDIUM";
    }

    res.json({
      risk,
      score: Math.min(score, 100),
      reasons
    });
  } catch (err) {
    console.error("Risk check error: ", err);
    res.status(500).json({ error: "Server error during risk check" });
  }
});

// JWT Token Generation Endpoint (for testing)
app.get("/test-token", (req, res) => {
  const token = jwt.sign(
    { userId: "test123", role: "admin", email: "admin@kavach.com" },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "24h" }
  );
  res.json({ 
    token,
    message: "Test JWT token generated successfully",
    expiresIn: "24 hours",
    userId: "test123",
    role: "admin"
  });
});

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "KAVACH Backend API + Intelligence Platform",
    version: "2.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      transactions: "/api/transactions",
      ml: "/api/ml",
      fraudAlerts: "/api/fraud-alerts",
      loans: "/api/loans",
      emi: "/api/emi",
      qr: "/api/qr",
      offlineOtp: "/api/offline-otp",
      otp: "/api/otp",
      aadhaar: "/api/aadhaar",
      spam: "/api/spam",
      notifications: "/api/notifications",
      activity: "/api/activity",
      user: "/api/user",
      intelligence: "/api/intelligence (NEW - Risk, Events, Cases, Graph, Automation)",
    },
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 KAVACH Backend Server started on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 API available at: http://localhost:${PORT}`);
});
