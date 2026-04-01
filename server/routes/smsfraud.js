/**
 * SMS Fraud Detection Routes
 * API endpoints for SMS fraud analysis
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const router = express.Router();

// ============================================================
// SMS FRAUD ALERT SCHEMA
// ============================================================

const smsFraudAlertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  phoneNumber: String,

  // SMS Details
  smsContent: { type: String, required: true },
  sender: String,
  receivedAt: { type: Date, default: Date.now },

  // Analysis Results
  fraudScore: { type: Number, required: true, min: 0, max: 100 },
  riskLevel: {
    type: String,
    enum: ['safe', 'low', 'medium', 'high', 'critical'],
    default: 'safe'
  },
  isFraud: { type: Boolean, default: false },
  categories: [{
    name: String,
    score: Number
  }],
  riskFactors: [{
    category: String,
    description: String,
    weight: Number
  }],

  // Extracted Data
  urlsFound: [String],
  phoneNumbersFound: [String],
  otpDetected: Boolean,
  amountMentioned: String,
  senderTrusted: Boolean,

  // Recommendation
  recommendation: String,

  // User Action
  userAction: {
    type: String,
    enum: ['pending', 'dismissed', 'reported', 'blocked_sender'],
    default: 'pending'
  },
  userActionAt: Date,
  userFeedback: String,

  // Status
  notificationSent: { type: Boolean, default: false },
  notificationSentAt: Date,

  createdAt: { type: Date, default: Date.now, index: true }
});

// Create model
const SMSFraudAlert = mongoose.models.SMSFraudAlert ||
  mongoose.model('SMSFraudAlert', smsFraudAlertSchema);

// ============================================================
// SMS FRAUD DETECTION ENGINE
// ============================================================

class SMSFraudEngine {
  constructor() {
    this.fraudPatterns = this._loadFraudPatterns();
    this.suspiciousKeywords = this._loadSuspiciousKeywords();
    this.trustedSenders = this._loadTrustedSenders();
  }

  _loadFraudPatterns() {
    return {
      urgency: [
        { pattern: /\b(urgent|immediately|right now|asap|expires? today|last chance|act now|hurry)\b/gi, weight: 0.3 },
        { pattern: /\b(within \d+ (hours?|minutes?|days?))\b/gi, weight: 0.2 },
        { pattern: /\b(limited time|offer ends|deadline)\b/gi, weight: 0.25 },
      ],
      account_threat: [
        { pattern: /\b(account.*(blocked|suspended|locked|closed|deactivated|compromised))\b/gi, weight: 0.5 },
        { pattern: /\b(verify your (account|identity|details))\b/gi, weight: 0.4 },
        { pattern: /\b(unauthorized (access|transaction|activity))\b/gi, weight: 0.5 },
        { pattern: /\b(security (alert|warning|notice))\b/gi, weight: 0.3 },
      ],
      otp_phishing: [
        { pattern: /\b(share|send|tell|give).{0,20}(otp|pin|password|cvv)\b/gi, weight: 0.8 },
        { pattern: /\b(otp|pin).{0,20}(share|send|tell|give)\b/gi, weight: 0.8 },
        { pattern: /\b(do not share|never share).{0,30}(otp|pin)\b/gi, weight: -0.3 },
      ],
      money_request: [
        { pattern: /\b(send|transfer|pay).{0,30}(money|amount|rs\.?|inr|₹)\b/gi, weight: 0.3 },
        { pattern: /\b(won|winner|lottery|prize|reward|cashback|refund)\b/gi, weight: 0.5 },
        { pattern: /\b(claim your|collect your|receive your).{0,20}(prize|reward|money|cashback)\b/gi, weight: 0.6 },
      ],
      kyc_fraud: [
        { pattern: /\b(kyc|pan|aadhaar|aadhar).{0,30}(update|verify|expire|suspend|link)\b/gi, weight: 0.5 },
        { pattern: /\b(update.{0,20}kyc|kyc.{0,20}update)\b/gi, weight: 0.5 },
        { pattern: /\b(pan.{0,10}link|link.{0,10}pan)\b/gi, weight: 0.4 },
      ],
      impersonation: [
        { pattern: /\b(rbi|reserve bank|income tax|it department|govt|government)\b/gi, weight: 0.3 },
        { pattern: /\b(sbi|hdfc|icici|axis|kotak|paytm|phonepe|gpay).{0,30}(customer care|support|helpline)\b/gi, weight: 0.4 },
      ],
      suspicious_links: [
        { pattern: /(bit\.ly|tinyurl|goo\.gl|t\.co|shorturl|cutt\.ly|rb\.gy)/gi, weight: 0.4 },
        { pattern: /(click here|click below|click now|tap here|open link)/gi, weight: 0.3 },
        { pattern: /https?:\/\/[^\s]+\.(xyz|tk|ml|ga|cf|pw|top|club|online|site|website)/gi, weight: 0.5 },
      ],
      job_scam: [
        { pattern: /\b(work from home|wfh|part.?time job|earn.{0,20}daily|earn.{0,20}weekly)\b/gi, weight: 0.4 },
        { pattern: /\b(earn.{0,10}(₹|rs\.?|inr).{0,10}\d+.{0,10}(daily|weekly|monthly))\b/gi, weight: 0.5 },
        { pattern: /\b(no investment|zero investment|free registration)\b/gi, weight: 0.3 },
      ],
      loan_fraud: [
        { pattern: /\b(instant loan|easy loan|quick loan|personal loan approved)\b/gi, weight: 0.4 },
        { pattern: /\b(loan.{0,20}(approved|sanctioned|disbursed))\b/gi, weight: 0.3 },
        { pattern: /\b(low interest|0%.{0,10}interest|no.{0,10}interest)\b/gi, weight: 0.3 },
      ],
    };
  }

  _loadSuspiciousKeywords() {
    return {
      high_risk: [
        ['otp', 0.3], ['pin', 0.3], ['cvv', 0.5], ['password', 0.4],
        ['blocked', 0.4], ['suspended', 0.4], ['expired', 0.3],
        ['urgent', 0.3], ['immediately', 0.3], ['verify', 0.2],
        ['lottery', 0.6], ['winner', 0.5], ['prize', 0.4],
      ],
      medium_risk: [
        ['click', 0.15], ['link', 0.1], ['update', 0.15],
        ['confirm', 0.1], ['account', 0.1], ['bank', 0.1],
        ['credit', 0.1], ['debit', 0.1], ['transfer', 0.1],
      ],
      negative_indicators: [
        ['do not share', -0.3], ['never share', -0.3],
        ['bank never asks', -0.4],
      ],
    };
  }

  _loadTrustedSenders() {
    return [
      'SBIINB', 'SBIPSG', 'HDFCBK', 'ICICIB', 'AXISBK', 'KOTAKB',
      'PAYTMB', 'PHONPE', 'GPAYIN', 'AMAZIN', 'FLIPKT', 'ZOMATO',
      'SWIGGY', 'OLACAB', 'UBERIN', 'AIRTEL', 'JIOMNY', 'IRCTCW',
      'GOVTIN', 'UIDAIH', 'HABORB', 'INDUIB', 'PNBSMS', 'BOIIND',
    ];
  }

  analyze(message, sender = null) {
    const messageLower = message.toLowerCase();
    const results = {
      isFraud: false,
      fraudScore: 0,
      riskLevel: 'safe',
      categories: [],
      riskFactors: [],
      urlsFound: [],
      phoneNumbersFound: [],
      otpDetected: false,
      amountMentioned: null,
      senderTrusted: false,
      recommendation: '',
    };

    // Check trusted sender
    if (sender) {
      const senderUpper = sender.toUpperCase();
      results.senderTrusted = this.trustedSenders.some(
        trusted => senderUpper.includes(trusted)
      );
    }

    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/gi;
    results.urlsFound = message.match(urlRegex) || [];

    // Extract phone numbers
    const phoneRegex = /[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}/g;
    const phones = message.match(phoneRegex) || [];
    results.phoneNumbersFound = phones.filter(p => p.replace(/\D/g, '').length >= 10);

    // Detect OTP
    const otpRegex = /\b(\d{4,8})\b.{0,30}(otp|code|pin)|otp.{0,10}(\d{4,8})/gi;
    results.otpDetected = otpRegex.test(messageLower);

    // Extract amount
    const amountRegex = /(?:rs\.?|₹|inr)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi;
    const amountMatch = amountRegex.exec(messageLower);
    if (amountMatch) {
      results.amountMentioned = amountMatch[1].replace(/,/g, '');
    }

    // Pattern analysis
    let totalScore = 0;
    for (const [category, patterns] of Object.entries(this.fraudPatterns)) {
      let categoryScore = 0;
      for (const { pattern, weight } of patterns) {
        const matches = message.match(pattern);
        if (matches) {
          categoryScore += weight * matches.length;
          if (weight > 0) {
            results.riskFactors.push({
              category,
              description: `Pattern detected: ${matches[0]}`,
              weight,
            });
          }
        }
      }
      if (categoryScore > 0) {
        results.categories.push({ name: category, score: Math.min(categoryScore, 1.0) });
        totalScore += categoryScore;
      }
    }

    // Keyword analysis
    let keywordScore = 0;
    for (const [riskLevel, keywords] of Object.entries(this.suspiciousKeywords)) {
      for (const [keyword, weight] of keywords) {
        if (messageLower.includes(keyword)) {
          keywordScore += weight;
          if (weight > 0.1) {
            results.riskFactors.push({
              category: 'keyword',
              description: `Suspicious keyword: "${keyword}"`,
              weight,
            });
          }
        }
      }
    }

    // URL analysis
    let urlScore = 0;
    for (const url of results.urlsFound) {
      const urlRisk = this._analyzeUrl(url);
      urlScore += urlRisk.score;
      if (urlRisk.score > 0.2) {
        results.riskFactors.push({
          category: 'suspicious_url',
          description: urlRisk.reasons.join(', '),
          weight: urlRisk.score,
        });
      }
    }

    // Calculate final score
    let baseScore = totalScore + keywordScore + urlScore;

    // Adjust for trusted sender
    if (results.senderTrusted) {
      baseScore *= 0.5;
    }

    // Adjust for OTP phishing
    if (results.otpDetected) {
      const sharingPatterns = messageLower.match(/(share|send|tell|give|forward)/g);
      if (sharingPatterns) {
        baseScore += 0.5;
      }
    }

    // Normalize score
    results.fraudScore = Math.min(100, Math.max(0, baseScore * 50));

    // Determine risk level
    if (results.fraudScore >= 70) {
      results.riskLevel = 'critical';
      results.isFraud = true;
    } else if (results.fraudScore >= 50) {
      results.riskLevel = 'high';
      results.isFraud = true;
    } else if (results.fraudScore >= 30) {
      results.riskLevel = 'medium';
    } else if (results.fraudScore >= 15) {
      results.riskLevel = 'low';
    } else {
      results.riskLevel = 'safe';
    }

    // Generate recommendation
    results.recommendation = this._getRecommendation(results);

    return results;
  }

  _analyzeUrl(url) {
    const reasons = [];
    let score = 0;
    const urlLower = url.toLowerCase();

    // URL shorteners
    const shorteners = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'cutt.ly', 'rb.gy'];
    if (shorteners.some(s => urlLower.includes(s))) {
      reasons.push('URL shortener detected');
      score += 0.3;
    }

    // Suspicious TLDs
    const suspiciousTlds = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.pw', '.top', '.club', '.online'];
    if (suspiciousTlds.some(tld => urlLower.includes(tld))) {
      reasons.push('Suspicious domain extension');
      score += 0.4;
    }

    // IP address
    if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
      reasons.push('IP address instead of domain');
      score += 0.5;
    }

    return { score, reasons };
  }

  _getRecommendation(results) {
    if (results.riskLevel === 'critical') {
      return 'DANGER: This message is likely a scam. Do NOT click any links, share OTP/PIN, or call any numbers. Delete immediately.';
    } else if (results.riskLevel === 'high') {
      return 'WARNING: This message shows fraud indicators. Do not share personal information. Verify directly with your bank.';
    } else if (results.riskLevel === 'medium') {
      return 'CAUTION: This message has suspicious elements. Verify the sender before taking any action.';
    } else if (results.riskLevel === 'low') {
      return 'This message has minor suspicious elements. Exercise normal caution.';
    } else {
      return 'This message appears safe, but always verify before sharing sensitive information.';
    }
  }
}

// Create engine instance
const smsEngine = new SMSFraudEngine();

// ============================================================
// API ROUTES
// ============================================================

/**
 * POST /api/sms/analyze
 * Analyze an SMS message for fraud
 */
router.post('/analyze', async (req, res) => {
  try {
    const { message, sender, userId, phoneNumber, saveAlert = true } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Analyze SMS
    const analysis = smsEngine.analyze(message, sender);

    // Save alert if fraud detected and userId provided
    let alertId = null;
    if (saveAlert && userId && analysis.fraudScore >= 15) {
      const alert = new SMSFraudAlert({
        alertId: uuidv4(),
        userId,
        phoneNumber,
        smsContent: message,
        sender,
        receivedAt: new Date(),
        fraudScore: analysis.fraudScore,
        riskLevel: analysis.riskLevel,
        isFraud: analysis.isFraud,
        categories: analysis.categories,
        riskFactors: analysis.riskFactors,
        urlsFound: analysis.urlsFound,
        phoneNumbersFound: analysis.phoneNumbersFound,
        otpDetected: analysis.otpDetected,
        amountMentioned: analysis.amountMentioned,
        senderTrusted: analysis.senderTrusted,
        recommendation: analysis.recommendation,
      });

      await alert.save();
      alertId = alert.alertId;
    }

    res.json({
      success: true,
      alertId,
      analysis: {
        isFraud: analysis.isFraud,
        fraudScore: Math.round(analysis.fraudScore),
        riskLevel: analysis.riskLevel,
        categories: analysis.categories.slice(0, 5),
        riskFactors: analysis.riskFactors.slice(0, 5),
        urlsFound: analysis.urlsFound,
        phoneNumbersFound: analysis.phoneNumbersFound,
        otpDetected: analysis.otpDetected,
        amountMentioned: analysis.amountMentioned,
        senderTrusted: analysis.senderTrusted,
        recommendation: analysis.recommendation,
      },
      shouldShowAlert: analysis.fraudScore >= 30,
      alertType: analysis.riskLevel === 'critical' ? 'danger' :
                 analysis.riskLevel === 'high' ? 'warning' :
                 analysis.riskLevel === 'medium' ? 'caution' : 'info',
    });

  } catch (error) {
    console.error('[SMSFraud] Error analyzing SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze SMS',
      details: error.message
    });
  }
});

/**
 * POST /api/sms/analyze-batch
 * Analyze multiple SMS messages
 */
router.post('/analyze-batch', async (req, res) => {
  try {
    const { messages, userId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    const results = [];
    const fraudMessages = [];

    for (const msg of messages) {
      const analysis = smsEngine.analyze(msg.body || msg.message, msg.sender || msg.address);

      results.push({
        id: msg.id,
        sender: msg.sender || msg.address,
        fraudScore: Math.round(analysis.fraudScore),
        riskLevel: analysis.riskLevel,
        isFraud: analysis.isFraud,
      });

      if (analysis.fraudScore >= 30) {
        fraudMessages.push({
          id: msg.id,
          sender: msg.sender || msg.address,
          preview: (msg.body || msg.message).substring(0, 100),
          analysis,
        });
      }
    }

    res.json({
      success: true,
      totalAnalyzed: messages.length,
      fraudCount: fraudMessages.length,
      results,
      fraudMessages,
    });

  } catch (error) {
    console.error('[SMSFraud] Error in batch analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze messages'
    });
  }
});

/**
 * GET /api/sms/alerts/:userId
 * Get SMS fraud alerts for a user
 */
router.get('/alerts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, riskLevel, status } = req.query;

    const query = { userId };
    if (riskLevel) {
      query.riskLevel = riskLevel;
    }
    if (status) {
      query.userAction = status;
    }

    const alerts = await SMSFraudAlert.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: alerts.length,
      alerts: alerts.map(alert => ({
        alertId: alert.alertId,
        sender: alert.sender,
        preview: alert.smsContent.substring(0, 80) + '...',
        fraudScore: alert.fraudScore,
        riskLevel: alert.riskLevel,
        isFraud: alert.isFraud,
        otpDetected: alert.otpDetected,
        recommendation: alert.recommendation,
        userAction: alert.userAction,
        createdAt: alert.createdAt,
      })),
    });

  } catch (error) {
    console.error('[SMSFraud] Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * GET /api/sms/alert/:alertId
 * Get detailed alert information
 */
router.get('/alert/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;

    const alert = await SMSFraudAlert.findOne({ alertId });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      alert: {
        alertId: alert.alertId,
        smsContent: alert.smsContent,
        sender: alert.sender,
        receivedAt: alert.receivedAt,
        fraudScore: alert.fraudScore,
        riskLevel: alert.riskLevel,
        isFraud: alert.isFraud,
        categories: alert.categories,
        riskFactors: alert.riskFactors,
        urlsFound: alert.urlsFound,
        phoneNumbersFound: alert.phoneNumbersFound,
        otpDetected: alert.otpDetected,
        amountMentioned: alert.amountMentioned,
        senderTrusted: alert.senderTrusted,
        recommendation: alert.recommendation,
        userAction: alert.userAction,
        userFeedback: alert.userFeedback,
        createdAt: alert.createdAt,
      },
    });

  } catch (error) {
    console.error('[SMSFraud] Error fetching alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert'
    });
  }
});

/**
 * POST /api/sms/alert/:alertId/action
 * Update user action on an alert
 */
router.post('/alert/:alertId/action', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { action, feedback } = req.body;

    if (!['dismissed', 'reported', 'blocked_sender'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }

    const alert = await SMSFraudAlert.findOneAndUpdate(
      { alertId },
      {
        userAction: action,
        userActionAt: new Date(),
        userFeedback: feedback,
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      alertId,
      action,
      message: `Alert ${action} successfully`,
    });

  } catch (error) {
    console.error('[SMSFraud] Error updating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert'
    });
  }
});

/**
 * GET /api/sms/statistics/:userId
 * Get SMS fraud statistics
 */
router.get('/statistics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const alerts = await SMSFraudAlert.find({
      userId,
      createdAt: { $gte: startDate }
    });

    const stats = {
      totalAlerts: alerts.length,
      byRiskLevel: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        safe: 0,
      },
      byCategory: {},
      avgFraudScore: 0,
      fraudCount: 0,
      mostCommonCategory: null,
    };

    if (alerts.length > 0) {
      let totalScore = 0;

      alerts.forEach(alert => {
        stats.byRiskLevel[alert.riskLevel]++;
        totalScore += alert.fraudScore;

        if (alert.isFraud) {
          stats.fraudCount++;
        }

        alert.categories.forEach(cat => {
          stats.byCategory[cat.name] = (stats.byCategory[cat.name] || 0) + 1;
        });
      });

      stats.avgFraudScore = Math.round(totalScore / alerts.length);

      // Find most common category
      const categories = Object.entries(stats.byCategory);
      if (categories.length > 0) {
        categories.sort((a, b) => b[1] - a[1]);
        stats.mostCommonCategory = categories[0][0];
      }
    }

    res.json({
      success: true,
      period: `${days} days`,
      statistics: stats,
    });

  } catch (error) {
    console.error('[SMSFraud] Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * POST /api/sms/report-spam
 * Report a message as spam/fraud
 */
router.post('/report-spam', async (req, res) => {
  try {
    const { userId, message, sender, phoneNumber } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Analyze the message
    const analysis = smsEngine.analyze(message, sender);

    // Save as reported fraud
    const alert = new SMSFraudAlert({
      alertId: uuidv4(),
      userId: userId || 'anonymous',
      phoneNumber,
      smsContent: message,
      sender,
      receivedAt: new Date(),
      fraudScore: Math.max(analysis.fraudScore, 50), // Minimum 50 for reported
      riskLevel: analysis.fraudScore >= 50 ? analysis.riskLevel : 'medium',
      isFraud: true,
      categories: analysis.categories,
      riskFactors: analysis.riskFactors,
      urlsFound: analysis.urlsFound,
      phoneNumbersFound: analysis.phoneNumbersFound,
      otpDetected: analysis.otpDetected,
      amountMentioned: analysis.amountMentioned,
      senderTrusted: false,
      recommendation: 'User reported as spam/fraud',
      userAction: 'reported',
      userActionAt: new Date(),
    });

    await alert.save();

    res.json({
      success: true,
      alertId: alert.alertId,
      message: 'Thank you for reporting. This helps protect other users.',
    });

  } catch (error) {
    console.error('[SMSFraud] Error reporting spam:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to report spam'
    });
  }
});

/**
 * GET /api/sms/check-sender/:sender
 * Check if a sender is known fraudulent
 */
router.get('/check-sender/:sender', async (req, res) => {
  try {
    const { sender } = req.params;

    // Check if sender is trusted
    const isTrusted = smsEngine.trustedSenders.some(
      trusted => sender.toUpperCase().includes(trusted)
    );

    // Check fraud history
    const fraudCount = await SMSFraudAlert.countDocuments({
      sender: new RegExp(sender, 'i'),
      isFraud: true,
    });

    const reportCount = await SMSFraudAlert.countDocuments({
      sender: new RegExp(sender, 'i'),
      userAction: 'reported',
    });

    let reputation = 'unknown';
    if (isTrusted) {
      reputation = 'trusted';
    } else if (reportCount >= 10 || fraudCount >= 20) {
      reputation = 'fraudulent';
    } else if (reportCount >= 3 || fraudCount >= 5) {
      reputation = 'suspicious';
    }

    res.json({
      success: true,
      sender,
      isTrusted,
      reputation,
      fraudAlerts: fraudCount,
      userReports: reportCount,
    });

  } catch (error) {
    console.error('[SMSFraud] Error checking sender:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check sender'
    });
  }
});

export default router;
