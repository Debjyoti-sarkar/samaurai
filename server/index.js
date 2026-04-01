// -------------------------------
//  KAVACH MASTER BACKEND
// -------------------------------

import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import path from "path";
import multer from "multer";
import cors from "cors";
import { createClient } from "@deepgram/sdk";
import mongoose from "mongoose";

// ROUTERS
import paymentRouter from "./routes/payment.js";
import fraudDetectionRouter from "./routes/frauddetection.js";
import smsFraudRouter from "./routes/smsfraud.js";
import aadhaarRouter from "./routes/aadhaar.js";
import ttsRouter from "./tts.js";
import nexasafeRouter from "./routes/nexasafe-server.js"; // FIXED IMPORT
import faceRouter from "./routes/face.js";

// --------------------------------------
// Resolve __dirname for ES modules
// --------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --------------------------------------
// Load .env file
// --------------------------------------
dotenv.config({ path: join(__dirname, ".env") });

// --------------------------------------
// Deepgram STT initialization (FREE TIER)
// --------------------------------------
const deepgram = createClient(process.env.DEEPGRAM_API_KEY || "");

// --------------------------------------
// Connect MongoDB (optional for behavior)
// --------------------------------------
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/kavach";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB for Behavior Analysis"))
  .catch((err) =>
    console.log("⚠️ MongoDB optional, continuing without DB:", err.message),
  );

// --------------------------------------
// Express App Setup
// --------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// TTS
app.use("/tts", ttsRouter);

// FILE UPLOADS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// --------------------------------------
// HEALTH CHECK
// --------------------------------------
const startTime = Date.now();

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: (Date.now() - startTime) / 1000,
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------
// ROUTES
// --------------------------------------

// Payment
app.use("/api/payment", paymentRouter);

// Fraud detection
app.use("/api/fraud", fraudDetectionRouter);

// SMS Fraud
app.use("/api/sms", smsFraudRouter);

// Aadhaar / Digilocker
app.use("/api/aadhaar", aadhaarRouter);

// NexaSafe Router (FIXED)
app.use("/api/nexasafe", nexasafeRouter);

// Face enrollment + verification
app.use("/api/face", faceRouter);

// --------------------------------------
// DEEPGRAM SPEECH-TO-TEXT (FREE TIER)
// --------------------------------------
app.post("/assistant/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio provided" });

    console.log("🎤 Received audio:", req.file.originalname);

    // Use Deepgram for transcription
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      req.file.buffer,
      {
        model: "nova-2",
        language: "en",
        smart_format: true,
      },
    );

    if (error) throw error;

    const text =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    console.log("📝 Transcript from Deepgram:", text);

    res.json({ text });
  } catch (err) {
    console.error("❌ STT Error:", err);

    // Graceful fallback
    res.status(200).json({
      text: "",
      error: "stt_failed",
      details: err?.message || String(err),
    });
  }
});

// --------------------------------------
// RULE-BASED NLU PARSER
// --------------------------------------
app.post("/assistant/parse", (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required" });
  }

  const lower = text.toLowerCase();
  let intent = "unknown";
  let entities = {};
  let replyText = "I didn't understand that.";
  let actionSuggested = "none";

  // Simple intents
  if (
    lower.includes("send") ||
    lower.includes("pay") ||
    lower.includes("transfer")
  ) {
    intent = "send_money";
    actionSuggested = "prefill_and_navigate_upi";

    // Extract amount
    const amountMatch = lower.match(/\d+/);
    if (amountMatch) entities.amount = amountMatch[0];

    // Extract recipient name (after "to", "for", or before "@")
    // Patterns: "send 500 to rahul", "pay rahul 200", "transfer to priya"
    let recipientMatch = lower.match(/(?:to|for)\s+([a-z]+(?:\s+[a-z]+)?)/i);
    if (recipientMatch) {
      entities.recipient = recipientMatch[1].trim();
    } else {
      // Try pattern: "send rahul 500" or "pay rahul"
      recipientMatch = lower.match(/(?:send|pay|transfer)\s+([a-z]+)/i);
      if (recipientMatch && !recipientMatch[1].match(/\d+/)) {
        entities.recipient = recipientMatch[1].trim();
      }
    }

    // Extract UPI ID if present
    const upiMatch = lower.match(/([a-z0-9]+@[a-z]+)/i);
    if (upiMatch) {
      entities.recipient = upiMatch[1];
    }

    console.log("💰 Extracted entities:", entities);

    replyText = entities.recipient
      ? `Okay, sending ₹${entities.amount || "..."} to ${entities.recipient}.`
      : `Okay, sending ₹${entities.amount || ""}.`;
  }

  if (lower.includes("balance")) {
    intent = "check_balance";
    actionSuggested = "ask_pin_for_balance";
    replyText = "Let me fetch your balance.";
  }

  if (lower.includes("history")) {
    intent = "view_history";
    actionSuggested = "show_history";
    replyText = "Showing your transaction history.";
  }

  res.json({
    intent,
    entities,
    replyText,
    actionSuggested,
  });
});

// --------------------------------------
// START SERVER
// --------------------------------------
const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n============================================`);
  console.log(`✅ KAVACH Backend Running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`🎤 STT: POST /assistant/transcribe`);
  console.log(`🧠 NLU: POST /assistant/parse`);
  console.log(`============================================\n`);
});
