/**
 * Fraud Detection Routes (ES Module)
 * API endpoints for behavior analysis and fraud detection
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const router = express.Router();

// ============================================================
// DATABASE SCHEMAS (Inline for ES Module compatibility)
// ============================================================

// User Behavior Profile Schema
const userBehaviorProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  phoneNumber: { type: String, index: true },
  transactionPatterns: {
    avgTransactionAmount: { type: Number, default: 0 },
    maxTransactionAmount: { type: Number, default: 0 },
    minTransactionAmount: { type: Number, default: Infinity },
    totalTransactions: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    stdDevAmount: { type: Number, default: 0 },
    dailyAvgTransactions: { type: Number, default: 0 },
    dailyAvgAmount: { type: Number, default: 0 }
  },
  timePatterns: {
    preferredHours: [{ type: Number }],
    hourlyDistribution: { type: Map, of: Number, default: {} },
    preferredDays: [{ type: Number }],
    dayDistribution: { type: Map, of: Number, default: {} }
  },
  recipientPatterns: {
    frequentRecipients: [{
      upiId: String,
      name: String,
      transactionCount: Number,
      totalAmount: Number,
      lastTransaction: Date,
      trustScore: { type: Number, default: 0 }
    }],
    uniqueRecipientsCount: { type: Number, default: 0 },
    newRecipientFrequency: { type: Number, default: 0 }
  },
  devicePatterns: {
    trustedDevices: [{
      deviceId: String,
      deviceModel: String,
      osVersion: String,
      firstSeen: Date,
      lastSeen: Date,
      transactionCount: Number,
      trustScore: { type: Number, default: 100 }
    }],
    primaryDevice: { deviceId: String, deviceModel: String }
  },
  locationPatterns: {
    trustedLocations: [{
      latitude: Number,
      longitude: Number,
      radius: { type: Number, default: 5 },
      name: String,
      visitCount: Number,
      lastVisit: Date,
      trustScore: { type: Number, default: 100 }
    }],
    commonIPs: [{ ip: String, firstSeen: Date, lastSeen: Date, accessCount: Number, location: String }]
  },
  sessionPatterns: {
    avgSessionDuration: { type: Number, default: 0 },
    avgActionsPerSession: { type: Number, default: 0 },
    avgTimeBetweenActions: { type: Number, default: 0 }
  },
  authPatterns: {
    preferredAuthMethod: { type: String, enum: ['pin', 'biometric', 'both'], default: 'pin' },
    avgAuthAttempts: { type: Number, default: 1 },
    failedAuthAttempts: { type: Number, default: 0 },
    lastAuthMethod: String,
    biometricSuccessRate: { type: Number, default: 0 }
  },
  riskMetrics: {
    overallRiskScore: { type: Number, default: 0, min: 0, max: 100 },
    lastRiskAssessment: Date,
    riskFactors: [{ factor: String, score: Number, timestamp: Date }],
    anomalyCount: { type: Number, default: 0 },
    flaggedTransactions: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now }
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  phoneNumber: { type: String, index: true },
  type: { type: String, enum: ['send', 'receive', 'refund', 'failed', 'pending'], required: true },
  amount: { type: Number, required: true, index: true },
  status: { type: String, enum: ['initiated', 'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'], default: 'initiated' },
  recipient: { upiId: String, name: String, isNewRecipient: { type: Boolean, default: false } },
  deviceInfo: { deviceId: String, deviceModel: String, osName: String, osVersion: String },
  locationInfo: { latitude: Number, longitude: Number, city: String, ipAddress: String },
  timing: {
    initiatedAt: { type: Date, default: Date.now },
    completedAt: Date,
    hourOfDay: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    isWeekend: Boolean
  },
  sessionInfo: { sessionId: String, sessionDuration: Number, actionsBeforeTransaction: Number, authMethodUsed: String },
  riskAssessment: {
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    riskFactors: [{ factor: String, contribution: Number, description: String }],
    anomalyDetected: { type: Boolean, default: false },
    requiresReauth: { type: Boolean, default: false },
    reauthCompleted: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

// Behavior Event Schema
const behaviorEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  category: { type: String, enum: ['authentication', 'navigation', 'transaction', 'security', 'feature', 'settings', 'error', 'other'], default: 'other' },
  eventData: { screenName: String, transactionId: String, amount: Number, authMethod: String, additionalData: mongoose.Schema.Types.Mixed },
  deviceInfo: { deviceId: String, deviceModel: String, osName: String },
  locationInfo: { latitude: Number, longitude: Number, city: String, ipAddress: String },
  timestamp: { type: Date, default: Date.now, index: true },
  behavioralMetrics: { touchPressure: Number, touchDuration: Number, typingSpeed: Number },
  riskIndicators: { isUnusualTime: Boolean, isUnusualDevice: Boolean, riskScore: { type: Number, default: 0 }, flagged: { type: Boolean, default: false } },
  createdAt: { type: Date, default: Date.now }
});

// Fraud Alert Schema
const fraudAlertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  transactionId: { type: String, index: true },
  alertType: { type: String, required: true, index: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  riskScore: { type: Number, required: true, min: 0, max: 100 },
  riskFactors: [{ factor: String, score: Number, description: String }],
  transactionSnapshot: { amount: Number, recipientUpiId: String, timestamp: Date },
  action: { type: String, enum: ['allow', 'block', 'challenge', 'flag_review', 'require_reauth'], default: 'flag_review' },
  reauthRequired: { type: Boolean, default: false },
  reauthMethod: String,
  reauthAttempts: { type: Number, default: 0 },
  reauthSuccessful: Boolean,
  status: { type: String, enum: ['pending', 'investigating', 'resolved_legitimate', 'resolved_fraud', 'escalated'], default: 'pending' },
  resolution: { resolvedBy: String, resolvedAt: Date, resolution: String, isFraud: Boolean },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Create models (with check to prevent OverwriteModelError)
const UserBehaviorProfile = mongoose.models.UserBehaviorProfile || mongoose.model('UserBehaviorProfile', userBehaviorProfileSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
const BehaviorEvent = mongoose.models.BehaviorEvent || mongoose.model('BehaviorEvent', behaviorEventSchema);
const FraudAlert = mongoose.models.FraudAlert || mongoose.model('FraudAlert', fraudAlertSchema);

// ============================================================
// RISK SCORING ENGINE
// ============================================================

const RISK_THRESHOLDS = { low: 25, medium: 50, high: 75, critical: 90 };

const RISK_WEIGHTS = {
  amount_deviation: 0.15,
  time_anomaly: 0.08,
  location_anomaly: 0.12,
  device_anomaly: 0.12,
  recipient_anomaly: 0.12,
  velocity_anomaly: 0.08,
  behavioral_anomaly: 0.08,
  auth_anomaly: 0.05,
  // BBA weights
  bba_anomaly: 0.12,
  cognitive_anomaly: 0.08
};

function getRiskLevel(score) {
  if (score >= RISK_THRESHOLDS.critical) return 'critical';
  if (score >= RISK_THRESHOLDS.high) return 'high';
  if (score >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function calculateTransactionRisk(transaction, userId) {
  const riskFactors = [];
  let totalScore = 0;

  try {
    const profile = await UserBehaviorProfile.findOne({ userId });

    // 1. Amount Analysis
    const amount = transaction.amount;
    if (profile?.transactionPatterns?.avgTransactionAmount) {
      const avg = profile.transactionPatterns.avgTransactionAmount;
      const std = profile.transactionPatterns.stdDevAmount || avg * 0.5;
      const zScore = std > 0 ? Math.abs((amount - avg) / std) : 0;

      if (zScore > 3) {
        const amountScore = Math.min(100, zScore * 20);
        riskFactors.push({ factor: 'amount_deviation', score: amountScore, description: `Amount ${zScore.toFixed(1)}x from average` });
        totalScore += amountScore * RISK_WEIGHTS.amount_deviation;
      }
    } else if (amount > 10000) {
      riskFactors.push({ factor: 'high_amount_new_user', score: 40, description: 'High amount from new user' });
      totalScore += 40 * RISK_WEIGHTS.amount_deviation;
    }

    // 2. Time Analysis
    const hour = transaction.timing?.hourOfDay ?? new Date().getHours();
    if (hour >= 0 && hour < 6) {
      riskFactors.push({ factor: 'unusual_time', score: 50, description: `Late night transaction (${hour}:00)` });
      totalScore += 50 * RISK_WEIGHTS.time_anomaly;
    } else if (profile?.timePatterns?.preferredHours?.length > 0) {
      if (!profile.timePatterns.preferredHours.includes(hour)) {
        riskFactors.push({ factor: 'unusual_time', score: 30, description: 'Outside preferred hours' });
        totalScore += 30 * RISK_WEIGHTS.time_anomaly;
      }
    }

    // 3. Location Analysis
    if (transaction.locationInfo?.latitude && profile?.locationPatterns?.trustedLocations?.length > 0) {
      let minDist = Infinity;
      for (const loc of profile.locationPatterns.trustedLocations) {
        const dist = calculateDistance(transaction.locationInfo.latitude, transaction.locationInfo.longitude, loc.latitude, loc.longitude);
        minDist = Math.min(minDist, dist);
      }
      if (minDist > 50) {
        const locScore = Math.min(100, minDist);
        riskFactors.push({ factor: 'unusual_location', score: locScore, description: `${minDist.toFixed(0)}km from trusted location` });
        totalScore += locScore * RISK_WEIGHTS.location_anomaly;
      }
    }

    // 4. Device Analysis
    if (transaction.deviceInfo?.deviceId && profile?.devicePatterns?.trustedDevices?.length > 0) {
      const trusted = profile.devicePatterns.trustedDevices.find(d => d.deviceId === transaction.deviceInfo.deviceId);
      if (!trusted) {
        riskFactors.push({ factor: 'unknown_device', score: 60, description: 'Transaction from new device' });
        totalScore += 60 * RISK_WEIGHTS.device_anomaly;
      }
    }

    // 5. Recipient Analysis
    if (transaction.recipient?.upiId && profile?.recipientPatterns?.frequentRecipients?.length > 0) {
      const known = profile.recipientPatterns.frequentRecipients.find(r => r.upiId === transaction.recipient.upiId);
      if (!known) {
        const recScore = amount > (profile.transactionPatterns?.avgTransactionAmount || 1000) * 2 ? 70 : 40;
        riskFactors.push({ factor: 'new_recipient', score: recScore, description: 'Transaction to new recipient' });
        totalScore += recScore * RISK_WEIGHTS.recipient_anomaly;
      }
    }

    // 6. Velocity Analysis
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentTxCount = await Transaction.countDocuments({ userId, 'timing.initiatedAt': { $gte: oneHourAgo } });
    if (recentTxCount > 5) {
      const velScore = Math.min(100, recentTxCount * 15);
      riskFactors.push({ factor: 'high_velocity', score: velScore, description: `${recentTxCount} transactions in last hour` });
      totalScore += velScore * RISK_WEIGHTS.velocity_anomaly;
    }

    // 7. Session Analysis
    if (transaction.sessionInfo?.sessionDuration && transaction.sessionInfo.sessionDuration < 10) {
      riskFactors.push({ factor: 'short_session', score: 50, description: 'Very short session' });
      totalScore += 50 * RISK_WEIGHTS.behavioral_anomaly;
    }

    // 8. Auth Analysis
    if (profile?.authPatterns?.failedAuthAttempts > 3) {
      riskFactors.push({ factor: 'auth_failures', score: 60, description: 'Multiple failed auth attempts' });
      totalScore += 60 * RISK_WEIGHTS.auth_anomaly;
    }

    totalScore = Math.min(100, Math.max(0, totalScore));

    return {
      riskScore: Math.round(totalScore),
      riskLevel: getRiskLevel(totalScore),
      riskFactors: riskFactors.filter(f => f.score > 10),
      requiresReauth: totalScore >= RISK_THRESHOLDS.high,
      requiresBlock: totalScore >= RISK_THRESHOLDS.critical
    };

  } catch (error) {
    console.error('[RiskScorer] Error:', error);
    return { riskScore: 0, riskLevel: 'low', riskFactors: [], requiresReauth: false, requiresBlock: false };
  }
}

// ============================================================
// API ROUTES
// ============================================================

/**
 * POST /api/fraud/analyze-transaction
 * Enhanced with BBA (Behavioral Biometric Analysis) support
 */
router.post('/analyze-transaction', async (req, res) => {
  try {
    const { userId, phoneNumber, amount, recipientUpiId, recipientName, deviceInfo, locationInfo, sessionInfo, bbaData } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, error: 'userId and amount are required' });
    }

    const transaction = {
      transactionId: uuidv4(),
      userId,
      phoneNumber,
      amount: parseFloat(amount),
      recipient: { upiId: recipientUpiId, name: recipientName },
      deviceInfo: deviceInfo || {},
      locationInfo: locationInfo || {},
      sessionInfo: sessionInfo || {},
      timing: { initiatedAt: new Date(), hourOfDay: new Date().getHours(), dayOfWeek: new Date().getDay() },
      bbaData: bbaData || null
    };

    const riskResult = await calculateTransactionRisk(transaction, userId);

    // Add BBA risk factors if BBA data is provided
    if (bbaData) {
      const bbaRiskScore = calculateBBARisk(bbaData);
      if (bbaRiskScore > 0) {
        riskResult.riskFactors.push({
          factor: 'bba_anomaly',
          score: bbaRiskScore,
          description: `Behavioral biometric anomaly detected (${bbaData.anomalies?.length || 0} anomalies)`
        });
        riskResult.riskScore = Math.min(100, riskResult.riskScore + (bbaRiskScore * RISK_WEIGHTS.bba_anomaly));
        riskResult.riskLevel = getRiskLevel(riskResult.riskScore);
        riskResult.requiresReauth = riskResult.riskScore >= RISK_THRESHOLDS.high;
        riskResult.requiresBlock = riskResult.riskScore >= RISK_THRESHOLDS.critical;
      }

      // Add cognitive analysis risk
      if (bbaData.cognitiveScore && bbaData.cognitiveScore > 50) {
        riskResult.riskFactors.push({
          factor: 'cognitive_anomaly',
          score: bbaData.cognitiveScore,
          description: 'Cognitive pattern anomalies detected'
        });
        riskResult.riskScore = Math.min(100, riskResult.riskScore + (bbaData.cognitiveScore * RISK_WEIGHTS.cognitive_anomaly));
      }
    }

    // Create fraud alert if risk is medium or higher
    if (riskResult.riskScore >= RISK_THRESHOLDS.medium) {
      const alert = new FraudAlert({
        alertId: uuidv4(),
        userId,
        transactionId: transaction.transactionId,
        alertType: riskResult.riskFactors[0]?.factor || 'pattern_anomaly',
        severity: riskResult.riskLevel,
        riskScore: riskResult.riskScore,
        riskFactors: riskResult.riskFactors,
        transactionSnapshot: { amount: transaction.amount, recipientUpiId, timestamp: new Date() },
        action: riskResult.requiresBlock ? 'block' : (riskResult.requiresReauth ? 'require_reauth' : 'flag_review'),
        reauthRequired: riskResult.requiresReauth,
        status: 'pending'
      });
      await alert.save();
    }

    res.json({
      success: true,
      transactionId: transaction.transactionId,
      riskAssessment: {
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        requiresReauth: riskResult.requiresReauth,
        requiresBlock: riskResult.requiresBlock,
        riskFactors: riskResult.riskFactors
      },
      recommendation: getRecommendation(riskResult)
    });

  } catch (error) {
    console.error('[FraudDetection] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze transaction', details: error.message });
  }
});

/**
 * POST /api/fraud/track-event
 */
router.post('/track-event', async (req, res) => {
  try {
    const { userId, eventType, eventData, deviceInfo, locationInfo, sessionId } = req.body;

    if (!userId || !eventType) {
      return res.status(400).json({ success: false, error: 'userId and eventType are required' });
    }

    const event = new BehaviorEvent({
      eventId: uuidv4(),
      userId,
      eventType,
      category: getCategoryForEvent(eventType),
      eventData: eventData || {},
      deviceInfo: deviceInfo || {},
      locationInfo: locationInfo || {},
      sessionId,
      timestamp: new Date()
    });

    await event.save();

    res.json({ success: true, eventId: event.eventId });

  } catch (error) {
    console.error('[FraudDetection] Error tracking event:', error);
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
});

/**
 * POST /api/fraud/track-transaction
 */
router.post('/track-transaction', async (req, res) => {
  try {
    const { userId, phoneNumber, transactionId, orderId, amount, status, recipient, deviceInfo, locationInfo, sessionInfo, riskAssessment } = req.body;

    if (!userId || !transactionId || !amount) {
      return res.status(400).json({ success: false, error: 'userId, transactionId, and amount are required' });
    }

    const transaction = new Transaction({
      transactionId,
      orderId,
      userId,
      phoneNumber,
      type: 'send',
      amount: parseFloat(amount),
      status: status || 'success',
      recipient: recipient || {},
      deviceInfo: deviceInfo || {},
      locationInfo: locationInfo || {},
      sessionInfo: sessionInfo || {},
      timing: { initiatedAt: new Date(), completedAt: new Date(), hourOfDay: new Date().getHours(), dayOfWeek: new Date().getDay() },
      riskAssessment: riskAssessment || {}
    });

    await transaction.save();

    // Update user profile
    await updateUserProfile(userId, phoneNumber, transaction);

    res.json({ success: true, transactionId, message: 'Transaction tracked' });

  } catch (error) {
    console.error('[FraudDetection] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to track transaction' });
  }
});

/**
 * GET /api/fraud/user-profile/:userId
 */
router.get('/user-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await UserBehaviorProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    res.json({
      success: true,
      profile: {
        userId: profile.userId,
        transactionPatterns: {
          avgTransactionAmount: profile.transactionPatterns.avgTransactionAmount,
          totalTransactions: profile.transactionPatterns.totalTransactions
        },
        timePatterns: { preferredHours: profile.timePatterns.preferredHours },
        riskMetrics: { overallRiskScore: profile.riskMetrics.overallRiskScore },
        lastActivity: profile.lastActivity
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

/**
 * GET /api/fraud/alerts/:userId
 */
router.get('/alerts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const alerts = await FraudAlert.find({ userId }).sort({ createdAt: -1 }).limit(parseInt(limit));

    res.json({
      success: true,
      alerts: alerts.map(alert => ({
        alertId: alert.alertId,
        alertType: alert.alertType,
        severity: alert.severity,
        riskScore: alert.riskScore,
        status: alert.status,
        reauthRequired: alert.reauthRequired,
        createdAt: alert.createdAt
      }))
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

/**
 * POST /api/fraud/check-reauth
 */
router.post('/check-reauth', async (req, res) => {
  try {
    const { userId, amount, recipientUpiId, deviceInfo, locationInfo } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, error: 'userId and amount are required' });
    }

    const transaction = {
      amount: parseFloat(amount),
      recipient: { upiId: recipientUpiId },
      deviceInfo: deviceInfo || {},
      locationInfo: locationInfo || {},
      timing: { hourOfDay: new Date().getHours(), dayOfWeek: new Date().getDay() }
    };

    const riskResult = await calculateTransactionRisk(transaction, userId);

    res.json({
      success: true,
      requiresReauth: riskResult.requiresReauth,
      reason: riskResult.riskFactors[0]?.description || 'Risk threshold exceeded',
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      suggestedMethod: riskResult.riskLevel === 'critical' ? 'otp' : (riskResult.riskLevel === 'high' ? 'biometric' : 'pin')
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check reauth' });
  }
});

/**
 * POST /api/fraud/resolve-alert
 */
router.post('/resolve-alert', async (req, res) => {
  try {
    const { alertId, userId, reauthMethod, reauthSuccessful } = req.body;

    const alert = await FraudAlert.findOne({ alertId, userId });
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    alert.reauthMethod = reauthMethod;
    alert.reauthSuccessful = reauthSuccessful;
    alert.reauthAttempts += 1;

    if (reauthSuccessful) {
      alert.status = 'resolved_legitimate';
      alert.action = 'allow';
      alert.resolution = { resolvedBy: 'user', resolvedAt: new Date(), isFraud: false };
    } else if (alert.reauthAttempts >= 3) {
      alert.status = 'escalated';
      alert.severity = 'critical';
      alert.action = 'block';
    }

    await alert.save();

    res.json({ success: true, alertId, status: alert.status, canProceed: reauthSuccessful });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

/**
 * POST /api/fraud/update-auth-event
 */
router.post('/update-auth-event', async (req, res) => {
  try {
    const { userId, authMethod, success, deviceInfo, sessionId } = req.body;

    const eventType = success ? (authMethod === 'biometric' ? 'biometric_success' : 'pin_success') : (authMethod === 'biometric' ? 'biometric_failure' : 'pin_failure');

    const event = new BehaviorEvent({
      eventId: uuidv4(),
      userId,
      eventType,
      category: 'authentication',
      eventData: { authMethod },
      deviceInfo: deviceInfo || {},
      sessionId,
      timestamp: new Date()
    });

    await event.save();

    // Update profile auth patterns
    const profile = await UserBehaviorProfile.findOne({ userId });
    if (profile) {
      if (!success) {
        profile.authPatterns.failedAuthAttempts = (profile.authPatterns.failedAuthAttempts || 0) + 1;
      }
      profile.authPatterns.lastAuthMethod = authMethod;
      await profile.save();
    }

    res.json({ success: true, message: 'Auth event tracked' });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to track auth event' });
  }
});

/**
 * GET /api/fraud/statistics/:userId
 */
router.get('/statistics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const transactions = await Transaction.find({ userId, 'timing.initiatedAt': { $gte: startDate } });
    const alerts = await FraudAlert.find({ userId, createdAt: { $gte: startDate } });

    res.json({
      success: true,
      period: `${days} days`,
      transactions: {
        total: transactions.length,
        totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
        avgAmount: transactions.length > 0 ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length : 0
      },
      alerts: {
        total: alerts.length,
        pending: alerts.filter(a => a.status === 'pending').length,
        resolved: alerts.filter(a => a.status.startsWith('resolved')).length
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function updateUserProfile(userId, phoneNumber, transaction) {
  try {
    let profile = await UserBehaviorProfile.findOne({ userId });

    if (!profile) {
      profile = new UserBehaviorProfile({
        userId,
        phoneNumber,
        transactionPatterns: {},
        timePatterns: { hourlyDistribution: new Map(), dayDistribution: new Map() },
        recipientPatterns: { frequentRecipients: [] },
        devicePatterns: { trustedDevices: [] },
        locationPatterns: { trustedLocations: [] }
      });
    }

    // Update transaction patterns
    const tp = profile.transactionPatterns;
    tp.totalTransactions = (tp.totalTransactions || 0) + 1;
    tp.totalAmount = (tp.totalAmount || 0) + transaction.amount;
    tp.avgTransactionAmount = tp.totalAmount / tp.totalTransactions;
    tp.maxTransactionAmount = Math.max(tp.maxTransactionAmount || 0, transaction.amount);

    // Update time patterns
    const hour = transaction.timing?.hourOfDay || new Date().getHours();
    const hourlyDist = profile.timePatterns.hourlyDistribution || new Map();
    hourlyDist.set(String(hour), (hourlyDist.get(String(hour)) || 0) + 1);
    profile.timePatterns.hourlyDistribution = hourlyDist;

    // Find preferred hours
    const hourEntries = Array.from(hourlyDist.entries());
    hourEntries.sort((a, b) => b[1] - a[1]);
    profile.timePatterns.preferredHours = hourEntries.slice(0, 5).map(e => parseInt(e[0]));

    // Update recipient patterns
    if (transaction.recipient?.upiId) {
      const idx = profile.recipientPatterns.frequentRecipients.findIndex(r => r.upiId === transaction.recipient.upiId);
      if (idx >= 0) {
        profile.recipientPatterns.frequentRecipients[idx].transactionCount += 1;
        profile.recipientPatterns.frequentRecipients[idx].trustScore = Math.min(100, profile.recipientPatterns.frequentRecipients[idx].trustScore + 5);
      } else {
        profile.recipientPatterns.frequentRecipients.push({
          upiId: transaction.recipient.upiId,
          name: transaction.recipient.name,
          transactionCount: 1,
          trustScore: 10
        });
        profile.recipientPatterns.uniqueRecipientsCount += 1;
      }
    }

    // Update device patterns
    if (transaction.deviceInfo?.deviceId) {
      const didx = profile.devicePatterns.trustedDevices.findIndex(d => d.deviceId === transaction.deviceInfo.deviceId);
      if (didx >= 0) {
        profile.devicePatterns.trustedDevices[didx].lastSeen = new Date();
        profile.devicePatterns.trustedDevices[didx].transactionCount += 1;
        profile.devicePatterns.trustedDevices[didx].trustScore = Math.min(100, profile.devicePatterns.trustedDevices[didx].trustScore + 2);
      } else {
        profile.devicePatterns.trustedDevices.push({
          deviceId: transaction.deviceInfo.deviceId,
          deviceModel: transaction.deviceInfo.deviceModel,
          firstSeen: new Date(),
          lastSeen: new Date(),
          transactionCount: 1,
          trustScore: 10
        });
      }
    }

    // Update location patterns
    if (transaction.locationInfo?.latitude) {
      let foundNearby = false;
      for (const loc of profile.locationPatterns.trustedLocations) {
        const dist = calculateDistance(loc.latitude, loc.longitude, transaction.locationInfo.latitude, transaction.locationInfo.longitude);
        if (dist <= 5) {
          loc.visitCount += 1;
          loc.trustScore = Math.min(100, loc.trustScore + 3);
          foundNearby = true;
          break;
        }
      }
      if (!foundNearby) {
        profile.locationPatterns.trustedLocations.push({
          latitude: transaction.locationInfo.latitude,
          longitude: transaction.locationInfo.longitude,
          name: transaction.locationInfo.city || 'Unknown',
          visitCount: 1,
          trustScore: 10
        });
      }
    }

    profile.lastActivity = new Date();
    profile.updatedAt = new Date();
    await profile.save();

  } catch (error) {
    console.error('[UserProfiler] Error:', error);
  }
}

function getCategoryForEvent(eventType) {
  const categories = {
    authentication: ['login_attempt', 'login_success', 'login_failure', 'biometric_success', 'biometric_failure', 'pin_success', 'pin_failure'],
    transaction: ['transaction_initiate', 'transaction_confirm', 'transaction_complete', 'transaction_fail'],
    navigation: ['screen_view', 'button_click'],
    security: ['fraud_scan_complete', 'reauth_triggered', 'reauth_complete']
  };

  for (const [category, events] of Object.entries(categories)) {
    if (events.includes(eventType)) return category;
  }
  return 'other';
}

function getRecommendation(riskResult) {
  if (riskResult.requiresBlock) {
    return { action: 'block', message: 'Transaction blocked due to high risk.', displayType: 'error' };
  }
  if (riskResult.requiresReauth) {
    return { action: 'reauth', message: 'Additional verification required.', displayType: 'warning', reauthMethods: ['pin', 'biometric'] };
  }
  if (riskResult.riskLevel === 'medium') {
    return { action: 'proceed_with_caution', message: 'Please verify details before proceeding.', displayType: 'info' };
  }
  return { action: 'proceed', message: 'Transaction looks safe.', displayType: 'success' };
}

/**
 * Calculate BBA risk score from client-side BBA data
 */
function calculateBBARisk(bbaData) {
  let riskScore = 0;

  // Check BBA score (inverted - lower score = higher risk)
  if (bbaData.bbaScore !== undefined && bbaData.bbaScore !== null) {
    if (bbaData.bbaScore < 40) {
      riskScore += 60; // Very low match with profile
    } else if (bbaData.bbaScore < 60) {
      riskScore += 40; // Low match
    } else if (bbaData.bbaScore < 80) {
      riskScore += 20; // Moderate match
    }
  }

  // Check BBA risk level
  if (bbaData.bbaRiskLevel) {
    switch (bbaData.bbaRiskLevel) {
      case 'critical':
        riskScore += 50;
        break;
      case 'high':
        riskScore += 35;
        break;
      case 'medium':
        riskScore += 20;
        break;
    }
  }

  // Check cursor metrics anomalies
  if (bbaData.cursorMetrics) {
    const metrics = bbaData.cursorMetrics;

    // Very low smoothness indicates bot-like behavior
    if (metrics.smoothnessScore !== undefined && metrics.smoothnessScore < 30) {
      riskScore += 30;
    }

    // Very high velocity indicates automation
    if (metrics.averageVelocity !== undefined && metrics.averageVelocity > 2000) {
      riskScore += 25;
    }

    // Too many hesitations might indicate unfamiliarity or coercion
    if (metrics.hesitations !== undefined && metrics.hesitations > 10) {
      riskScore += 20;
    }
  }

  // Check for specific anomaly types
  if (bbaData.anomalies && Array.isArray(bbaData.anomalies)) {
    for (const anomaly of bbaData.anomalies) {
      if (typeof anomaly === 'string') {
        if (anomaly.toLowerCase().includes('coercion')) {
          riskScore += 60; // Potential coercion is critical
        } else if (anomaly.toLowerCase().includes('automation') || anomaly.toLowerCase().includes('bot')) {
          riskScore += 50;
        } else if (anomaly.toLowerCase().includes('velocity') || anomaly.toLowerCase().includes('pattern')) {
          riskScore += 25;
        }
      }
    }
  }

  // Check cognitive load indicators
  if (bbaData.cognitiveLoad) {
    const load = bbaData.cognitiveLoad;

    if (load.stressIndicator > 80) {
      riskScore += 30; // High stress
    }

    if (load.userFatigue > 70) {
      riskScore += 15; // User fatigue
    }

    if (load.attentionLevel < 40) {
      riskScore += 20; // Low attention
    }
  }

  return Math.min(100, riskScore);
}

// ============================================================
// BBA-SPECIFIC API ROUTES
// ============================================================

/**
 * POST /api/fraud/analyze-bba
 * Standalone BBA analysis endpoint
 */
router.post('/analyze-bba', async (req, res) => {
  try {
    const { userId, bbaData, transactionContext } = req.body;

    if (!userId || !bbaData) {
      return res.status(400).json({ success: false, error: 'userId and bbaData are required' });
    }

    const bbaRiskScore = calculateBBARisk(bbaData);
    const riskLevel = getRiskLevel(bbaRiskScore);

    const anomalies = [];

    // Analyze cursor metrics
    if (bbaData.cursorMetrics) {
      if (bbaData.cursorMetrics.smoothnessScore < 50) {
        anomalies.push({ type: 'cursor', description: 'Unusual cursor movement patterns' });
      }
      if (bbaData.cursorMetrics.hesitations > 5) {
        anomalies.push({ type: 'hesitation', description: 'Multiple hesitations detected' });
      }
    }

    // Analyze cognitive patterns
    if (bbaData.cognitiveLoad) {
      if (bbaData.cognitiveLoad.stressIndicator > 70) {
        anomalies.push({ type: 'cognitive', description: 'High stress indicators' });
      }
      if (bbaData.cognitiveLoad.overallCognitiveLoad > 80) {
        anomalies.push({ type: 'cognitive', description: 'High cognitive load detected' });
      }
    }

    // Check for automation
    if (bbaData.bbaScore !== undefined && bbaData.bbaScore < 30) {
      anomalies.push({ type: 'profile_mismatch', description: 'Significant deviation from behavioral profile' });
    }

    res.json({
      success: true,
      analysis: {
        riskScore: bbaRiskScore,
        riskLevel,
        anomalies,
        requiresReauth: bbaRiskScore >= RISK_THRESHOLDS.high,
        requiresBlock: bbaRiskScore >= RISK_THRESHOLDS.critical,
        recommendation: bbaRiskScore >= RISK_THRESHOLDS.critical
          ? 'BLOCK: Critical behavioral anomalies detected'
          : bbaRiskScore >= RISK_THRESHOLDS.high
          ? 'REAUTH: Significant anomalies require additional verification'
          : bbaRiskScore >= RISK_THRESHOLDS.medium
          ? 'CAUTION: Minor behavioral deviations noted'
          : 'PROCEED: Behavioral patterns are normal'
      },
      bbaMetrics: {
        bbaScore: bbaData.bbaScore,
        cognitiveScore: bbaData.cognitiveScore,
        cursorAnomalies: bbaData.anomalies?.length || 0
      }
    });

  } catch (error) {
    console.error('[BBA Analysis] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze BBA data' });
  }
});

/**
 * POST /api/fraud/store-bba-profile
 * Store or update user's BBA profile baseline
 */
router.post('/store-bba-profile', async (req, res) => {
  try {
    const { userId, profileData } = req.body;

    if (!userId || !profileData) {
      return res.status(400).json({ success: false, error: 'userId and profileData are required' });
    }

    // Get or create user profile
    let profile = await UserBehaviorProfile.findOne({ userId });

    if (!profile) {
      profile = new UserBehaviorProfile({ userId });
    }

    // Store BBA-specific data in session patterns
    profile.sessionPatterns = {
      ...profile.sessionPatterns,
      bbaBaseline: {
        averageTypingSpeed: profileData.keystrokeDynamics?.typingSpeed || 0,
        averageHoldDuration: profileData.keystrokeDynamics?.averageHoldDuration || 0,
        cursorVelocity: profileData.cursorMetrics?.averageVelocity || 0,
        cursorSmoothness: profileData.cursorMetrics?.smoothnessScore || 0,
        touchPressure: profileData.touchBehavior?.averagePressure || 0,
        cognitiveBaseline: profileData.cognitiveBaseline || {},
        sampleCount: profileData.sampleCount || 0,
        confidenceScore: profileData.confidenceScore || 0,
        lastUpdated: new Date()
      }
    };

    profile.updatedAt = new Date();
    await profile.save();

    res.json({
      success: true,
      message: 'BBA profile stored successfully',
      profileConfidence: profileData.confidenceScore || 0
    });

  } catch (error) {
    console.error('[BBA Profile] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to store BBA profile' });
  }
});

/**
 * GET /api/fraud/bba-profile/:userId
 * Get user's BBA profile
 */
router.get('/bba-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await UserBehaviorProfile.findOne({ userId });

    if (!profile || !profile.sessionPatterns?.bbaBaseline) {
      return res.status(404).json({ success: false, error: 'BBA profile not found' });
    }

    res.json({
      success: true,
      bbaProfile: profile.sessionPatterns.bbaBaseline
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch BBA profile' });
  }
});

export default router;
