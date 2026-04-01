require("dotenv").config();
const express = require("express");
const cors = require("cors");
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
app.use("/api/spam", require("./routes/spamRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/activity", require("./routes/activityRoutes"));
app.use("/api/user", require("./routes/userRoutes"));

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "KAVACH Backend API",
    version: "1.0.0",
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
      spam: "/api/spam",
      notifications: "/api/notifications",
      activity: "/api/activity",
      user: "/api/user",
    },
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 KAVACH Backend Server started on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 API available at: http://localhost:${PORT}`);
});
