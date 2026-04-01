import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// --- State ---
let currentSessionData = {
  trustScore: 100,
  riskLevel: "safe",
  sessionActive: false,
  sessionStart: null,
  behaviorLogs: [],
  appliedPenalties: [],
  tapEvents: [],
  swipeEvents: [],
  screensVisited: [],
  screenDurations: {},
  deviceInfo: null,
  screenRecordingDetected: false,
  sessionInput: {
    withinBankTransferAmount: null,
    fdBroken: false,
    loanTaken: false
  }
};

let sessionHistory = [];

// --- Behavior Constants ---
const BEHAVIOR_DESCRIPTIONS = {};
const BEHAVIOR_PENALTIES = {};

// --- Router Endpoints (/api/nexasafe/*) ---

// Get current in-memory session snapshot
router.get("/session", (req, res) => {
  res.json(currentSessionData);
});

// Get simple in-memory session history
router.get("/history", (req, res) => {
  res.json(sessionHistory);
});

// Start a new NexaSafe session
router.post("/session/start", (req, res) => {
  currentSessionData = {
    trustScore: 100,
    riskLevel: "safe",
    sessionActive: true,
    sessionStart: new Date().toISOString(),
    behaviorLogs: [],
    appliedPenalties: [],
    tapEvents: [],
    swipeEvents: [],
    screensVisited: [],
    screenDurations: {},
    deviceInfo: req.body.deviceInfo || null,
    screenRecordingDetected: false,
    sessionInput: {
      withinBankTransferAmount: null,
      fdBroken: false,
      loanTaken: false
    }
  };

  res.json({ success: true });
});

// End current session and push a snapshot into history
router.post("/session/end", (req, res) => {
  if (currentSessionData.sessionActive) {
    const endedSession = {
      ...currentSessionData,
      sessionActive: false,
      sessionEnd: new Date().toISOString(),
    };

    sessionHistory.push(endedSession);
    currentSessionData.sessionActive = false;
  }

  res.json({ success: true });
});

// Lightweight sync endpoint used by mobile dashboard sync
router.post("/sync", (req, res) => {
  const {
    trustScore,
    riskLevel,
    sessionActive,
    behaviorLogs,
    appliedPenalties,
    screenRecordingDetected,
    lastSync,
  } = req.body || {};

  if (typeof trustScore === "number") currentSessionData.trustScore = trustScore;
  if (typeof riskLevel === "string") currentSessionData.riskLevel = riskLevel;
  if (typeof sessionActive === "boolean") currentSessionData.sessionActive = sessionActive;
  if (Array.isArray(behaviorLogs)) currentSessionData.behaviorLogs = behaviorLogs;
  if (Array.isArray(appliedPenalties)) currentSessionData.appliedPenalties = appliedPenalties;
  if (typeof screenRecordingDetected === "boolean") {
    currentSessionData.screenRecordingDetected = screenRecordingDetected;
  }

  // Optionally record last sync time
  if (lastSync) {
    currentSessionData.lastSync = lastSync;
  }

  res.json({ success: true });
});

router.post("/behavior", (req, res) => {
  const { behaviorId, extraData } = req.body;

  const penalty = BEHAVIOR_PENALTIES[behaviorId] || 0;
  const info = BEHAVIOR_DESCRIPTIONS[behaviorId] || {};

  currentSessionData.trustScore = Math.max(0, currentSessionData.trustScore + penalty);
  currentSessionData.behaviorLogs.push({
    id: behaviorId,
    timestamp: new Date().toISOString(),
    penalty,
    name: info.name,
    description: info.desc,
    severity: info.severity,
    extraData
  });

  res.json({ success: true });
});

router.post("/trust-score", (req, res) => {
  currentSessionData.trustScore = req.body.trustScore ?? currentSessionData.trustScore;
  res.json({ success: true });
});

router.post("/tap", (req, res) => {
  currentSessionData.tapEvents.push({ ...req.body, timestamp: new Date().toISOString() });
  res.json({ success: true });
});

router.post("/screen", (req, res) => {
  currentSessionData.screensVisited.push({
    screen: req.body.screen,
    timestamp: new Date().toISOString(),
    duration: req.body.duration
  });
  res.json({ success: true });
});

export default router;
