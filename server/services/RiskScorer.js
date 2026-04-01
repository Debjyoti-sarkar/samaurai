/**
 * Risk Scorer Service
 * Real-time risk assessment for transactions and user behavior
 */

const { spawn } = require('child_process');
const path = require('path');
const UserBehaviorProfile = require('../models/UserBehavior');
const Transaction = require('../models/Transaction');
const FraudAlert = require('../models/FraudAlert');
const { v4: uuidv4 } = require('uuid');

class RiskScorer {
  constructor() {
    this.mlModelPath = path.join(__dirname, '../ml');
    this.riskThresholds = {
      low: 25,
      medium: 50,
      high: 75,
      critical: 90
    };

    // Risk factor weights
    this.weights = {
      amount_deviation: 0.20,
      time_anomaly: 0.10,
      location_anomaly: 0.15,
      device_anomaly: 0.15,
      recipient_anomaly: 0.15,
      velocity_anomaly: 0.10,
      behavioral_anomaly: 0.10,
      auth_anomaly: 0.05
    };
  }

  /**
   * Calculate comprehensive risk score for a transaction
   */
  async calculateTransactionRisk(transaction, userId) {
    const riskFactors = [];
    let totalScore = 0;

    try {
      // Get user profile
      const profile = await UserBehaviorProfile.findOne({ userId });

      // 1. Amount Analysis
      const amountRisk = await this.analyzeAmount(transaction, profile);
      riskFactors.push(...amountRisk.factors);
      totalScore += amountRisk.score * this.weights.amount_deviation;

      // 2. Time Analysis
      const timeRisk = this.analyzeTime(transaction, profile);
      riskFactors.push(...timeRisk.factors);
      totalScore += timeRisk.score * this.weights.time_anomaly;

      // 3. Location Analysis
      const locationRisk = await this.analyzeLocation(transaction, profile);
      riskFactors.push(...locationRisk.factors);
      totalScore += locationRisk.score * this.weights.location_anomaly;

      // 4. Device Analysis
      const deviceRisk = await this.analyzeDevice(transaction, profile);
      riskFactors.push(...deviceRisk.factors);
      totalScore += deviceRisk.score * this.weights.device_anomaly;

      // 5. Recipient Analysis
      const recipientRisk = await this.analyzeRecipient(transaction, profile);
      riskFactors.push(...recipientRisk.factors);
      totalScore += recipientRisk.score * this.weights.recipient_anomaly;

      // 6. Velocity Analysis
      const velocityRisk = await this.analyzeVelocity(userId);
      riskFactors.push(...velocityRisk.factors);
      totalScore += velocityRisk.score * this.weights.velocity_anomaly;

      // 7. Behavioral Analysis
      const behavioralRisk = await this.analyzeBehavior(transaction, profile);
      riskFactors.push(...behavioralRisk.factors);
      totalScore += behavioralRisk.score * this.weights.behavioral_anomaly;

      // 8. Auth Pattern Analysis
      const authRisk = this.analyzeAuthPattern(transaction, profile);
      riskFactors.push(...authRisk.factors);
      totalScore += authRisk.score * this.weights.auth_anomaly;

      // 9. ML Model Score (if available)
      const mlScore = await this.getMLScore(transaction, profile);
      if (mlScore !== null) {
        // Blend ML score with rule-based score
        totalScore = totalScore * 0.6 + mlScore * 0.4;
        riskFactors.push({
          factor: 'ml_model',
          score: mlScore,
          description: 'Machine learning anomaly detection score'
        });
      }

      // Normalize score to 0-100
      totalScore = Math.min(100, Math.max(0, totalScore));

      const result = {
        riskScore: Math.round(totalScore),
        riskLevel: this.getRiskLevel(totalScore),
        riskFactors: riskFactors.filter(f => f.score > 10),
        requiresReauth: totalScore >= this.riskThresholds.high,
        requiresBlock: totalScore >= this.riskThresholds.critical,
        timestamp: new Date().toISOString()
      };

      // Create fraud alert if needed
      if (totalScore >= this.riskThresholds.medium) {
        await this.createFraudAlert(transaction, userId, result);
      }

      return result;

    } catch (error) {
      console.error('[RiskScorer] Error calculating risk:', error);
      // Return safe default on error
      return {
        riskScore: 0,
        riskLevel: 'low',
        riskFactors: [],
        requiresReauth: false,
        requiresBlock: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze transaction amount
   */
  async analyzeAmount(transaction, profile) {
    const factors = [];
    let score = 0;

    const amount = transaction.amount;

    if (!profile || !profile.transactionPatterns) {
      // New user - moderate risk for any amount over threshold
      if (amount > 10000) {
        score = 40;
        factors.push({
          factor: 'amount_deviation',
          score: 40,
          description: 'High amount transaction from new user'
        });
      }
      return { score, factors };
    }

    const avg = profile.transactionPatterns.avgTransactionAmount || 0;
    const std = profile.transactionPatterns.stdDevAmount || avg * 0.5;
    const max = profile.transactionPatterns.maxTransactionAmount || avg * 2;

    // Z-score calculation
    const zScore = std > 0 ? Math.abs((amount - avg) / std) : 0;

    if (zScore > 4) {
      score = 90;
      factors.push({
        factor: 'amount_deviation',
        score: 90,
        description: `Amount is ${zScore.toFixed(1)} std deviations from average`,
        expectedValue: avg,
        actualValue: amount
      });
    } else if (zScore > 3) {
      score = 70;
      factors.push({
        factor: 'amount_deviation',
        score: 70,
        description: `Amount significantly higher than usual (${zScore.toFixed(1)}σ)`,
        expectedValue: avg,
        actualValue: amount
      });
    } else if (zScore > 2) {
      score = 40;
      factors.push({
        factor: 'amount_deviation',
        score: 40,
        description: `Amount above normal range (${zScore.toFixed(1)}σ)`,
        expectedValue: avg,
        actualValue: amount
      });
    }

    // Check if exceeds historical max
    if (amount > max * 1.5) {
      score = Math.max(score, 60);
      factors.push({
        factor: 'amount_exceeds_max',
        score: 60,
        description: `Amount exceeds historical maximum by ${((amount / max - 1) * 100).toFixed(0)}%`,
        expectedValue: max,
        actualValue: amount
      });
    }

    return { score, factors };
  }

  /**
   * Analyze transaction time
   */
  analyzeTime(transaction, profile) {
    const factors = [];
    let score = 0;

    const hour = transaction.timing?.hourOfDay ?? new Date().getHours();
    const day = transaction.timing?.dayOfWeek ?? new Date().getDay();

    // Late night / early morning transactions
    if (hour >= 0 && hour < 6) {
      score = 50;
      factors.push({
        factor: 'time_anomaly',
        score: 50,
        description: `Transaction at unusual hour (${hour}:00)`
      });
    }

    if (profile && profile.timePatterns?.preferredHours?.length > 0) {
      const preferredHours = profile.timePatterns.preferredHours;

      if (!preferredHours.includes(hour)) {
        // Check if any preferred hour is within 2 hours
        const nearPreferred = preferredHours.some(h =>
          Math.abs(h - hour) <= 2 || Math.abs(h - hour) >= 22
        );

        if (!nearPreferred) {
          score = Math.max(score, 40);
          factors.push({
            factor: 'unusual_time_pattern',
            score: 40,
            description: `Transaction outside usual hours (preferred: ${preferredHours.join(', ')})`
          });
        }
      }
    }

    return { score, factors };
  }

  /**
   * Analyze location
   */
  async analyzeLocation(transaction, profile) {
    const factors = [];
    let score = 0;

    const loc = transaction.locationInfo;
    if (!loc || !loc.latitude || !loc.longitude) {
      return { score: 0, factors: [] };
    }

    if (!profile || !profile.locationPatterns?.trustedLocations?.length) {
      // New user location
      score = 20;
      factors.push({
        factor: 'location_new_user',
        score: 20,
        description: 'First transaction location recorded'
      });
      return { score, factors };
    }

    // Check against trusted locations
    let minDistance = Infinity;
    for (const trustedLoc of profile.locationPatterns.trustedLocations) {
      const distance = this.calculateDistance(
        loc.latitude, loc.longitude,
        trustedLoc.latitude, trustedLoc.longitude
      );
      minDistance = Math.min(minDistance, distance);
    }

    if (minDistance > 100) { // More than 100km
      score = 80;
      factors.push({
        factor: 'location_anomaly',
        score: 80,
        description: `Transaction ${minDistance.toFixed(0)}km from any trusted location`
      });
    } else if (minDistance > 50) {
      score = 50;
      factors.push({
        factor: 'location_anomaly',
        score: 50,
        description: `Transaction ${minDistance.toFixed(0)}km from nearest trusted location`
      });
    } else if (minDistance > 20) {
      score = 30;
      factors.push({
        factor: 'location_anomaly',
        score: 30,
        description: `Transaction from unfamiliar area (${minDistance.toFixed(0)}km away)`
      });
    }

    // VPN detection
    if (loc.vpnDetected) {
      score = Math.max(score, 60);
      factors.push({
        factor: 'vpn_detected',
        score: 60,
        description: 'VPN or proxy detected'
      });
    }

    return { score, factors };
  }

  /**
   * Analyze device
   */
  async analyzeDevice(transaction, profile) {
    const factors = [];
    let score = 0;

    const device = transaction.deviceInfo;
    if (!device || !device.deviceId) {
      return { score: 30, factors: [{ factor: 'no_device_info', score: 30, description: 'Device information unavailable' }] };
    }

    if (!profile || !profile.devicePatterns?.trustedDevices?.length) {
      score = 30;
      factors.push({
        factor: 'device_new_user',
        score: 30,
        description: 'First device registered for user'
      });
      return { score, factors };
    }

    // Check if device is trusted
    const trustedDevice = profile.devicePatterns.trustedDevices.find(
      d => d.deviceId === device.deviceId
    );

    if (!trustedDevice) {
      score = 60;
      factors.push({
        factor: 'device_anomaly',
        score: 60,
        description: 'Transaction from unrecognized device'
      });

      // Check if it's a different model than usual
      const knownModels = profile.devicePatterns.trustedDevices.map(d => d.deviceModel);
      if (!knownModels.includes(device.deviceModel)) {
        score = 70;
        factors.push({
          factor: 'new_device_model',
          score: 70,
          description: `New device type: ${device.deviceModel}`
        });
      }
    } else if (trustedDevice.trustScore < 50) {
      score = 40;
      factors.push({
        factor: 'low_trust_device',
        score: 40,
        description: `Device trust score is low (${trustedDevice.trustScore})`
      });
    }

    // Check for rooted/jailbroken device
    if (device.isRooted) {
      score = Math.max(score, 70);
      factors.push({
        factor: 'rooted_device',
        score: 70,
        description: 'Rooted or jailbroken device detected'
      });
    }

    // Check for emulator
    if (device.isEmulator) {
      score = Math.max(score, 80);
      factors.push({
        factor: 'emulator_detected',
        score: 80,
        description: 'Emulator detected'
      });
    }

    return { score, factors };
  }

  /**
   * Analyze recipient
   */
  async analyzeRecipient(transaction, profile) {
    const factors = [];
    let score = 0;

    const recipient = transaction.recipient;
    if (!recipient || !recipient.upiId) {
      return { score: 0, factors: [] };
    }

    if (!profile || !profile.recipientPatterns?.frequentRecipients?.length) {
      // New user - any recipient is fine
      return { score: 10, factors: [{ factor: 'new_user_recipient', score: 10, description: 'First recipient for new user' }] };
    }

    // Check if recipient is in frequent list
    const knownRecipient = profile.recipientPatterns.frequentRecipients.find(
      r => r.upiId === recipient.upiId
    );

    if (!knownRecipient) {
      score = 40;
      factors.push({
        factor: 'recipient_anomaly',
        score: 40,
        description: 'Transaction to new recipient'
      });

      // Higher risk for large amounts to new recipients
      if (transaction.amount > (profile.transactionPatterns.avgTransactionAmount || 1000) * 2) {
        score = 70;
        factors.push({
          factor: 'new_recipient_high_amount',
          score: 70,
          description: 'Large amount to new recipient'
        });
      }
    } else if (knownRecipient.trustScore < 30) {
      score = 35;
      factors.push({
        factor: 'low_trust_recipient',
        score: 35,
        description: `Recipient trust score is low (${knownRecipient.trustScore})`
      });
    }

    return { score, factors };
  }

  /**
   * Analyze transaction velocity
   */
  async analyzeVelocity(userId) {
    const factors = [];
    let score = 0;

    try {
      // Transactions in last hour
      const oneHourAgo = new Date(Date.now() - 3600000);
      const hourlyCount = await Transaction.countDocuments({
        userId,
        'timing.initiatedAt': { $gte: oneHourAgo }
      });

      // Transactions in last 24 hours
      const oneDayAgo = new Date(Date.now() - 86400000);
      const dailyCount = await Transaction.countDocuments({
        userId,
        'timing.initiatedAt': { $gte: oneDayAgo }
      });

      // Total amount in last 24 hours
      const dailyStats = await Transaction.aggregate([
        {
          $match: {
            userId,
            'timing.initiatedAt': { $gte: oneDayAgo },
            status: { $in: ['success', 'pending', 'processing'] }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const dailyAmount = dailyStats[0]?.totalAmount || 0;

      // Velocity thresholds
      if (hourlyCount > 5) {
        score = Math.min(100, hourlyCount * 15);
        factors.push({
          factor: 'velocity_anomaly',
          score: score,
          description: `${hourlyCount} transactions in last hour`
        });
      }

      if (dailyCount > 20) {
        score = Math.max(score, 60);
        factors.push({
          factor: 'daily_velocity',
          score: 60,
          description: `${dailyCount} transactions in last 24 hours`
        });
      }

      if (dailyAmount > 100000) { // 1 lakh
        score = Math.max(score, 70);
        factors.push({
          factor: 'daily_amount_velocity',
          score: 70,
          description: `₹${dailyAmount.toLocaleString()} transferred today`
        });
      }

    } catch (error) {
      console.error('[RiskScorer] Velocity analysis error:', error);
    }

    return { score, factors };
  }

  /**
   * Analyze behavioral patterns
   */
  async analyzeBehavior(transaction, profile) {
    const factors = [];
    let score = 0;

    const session = transaction.sessionInfo;
    if (!session) {
      return { score: 0, factors: [] };
    }

    // Very short session
    if (session.sessionDuration && session.sessionDuration < 10) {
      score = 50;
      factors.push({
        factor: 'behavioral_anomaly',
        score: 50,
        description: 'Very short session before transaction'
      });
    }

    // Few actions before transaction
    if (session.actionsBeforeTransaction && session.actionsBeforeTransaction < 3) {
      score = Math.max(score, 40);
      factors.push({
        factor: 'few_actions',
        score: 40,
        description: 'Unusually direct path to transaction'
      });
    }

    // Compare with profile patterns
    if (profile && profile.sessionPatterns) {
      const avgDuration = profile.sessionPatterns.avgSessionDuration;
      const avgActions = profile.sessionPatterns.avgActionsPerSession;

      if (avgDuration && session.sessionDuration < avgDuration * 0.2) {
        score = Math.max(score, 60);
        factors.push({
          factor: 'session_deviation',
          score: 60,
          description: 'Session significantly shorter than usual'
        });
      }
    }

    return { score, factors };
  }

  /**
   * Analyze authentication patterns
   */
  analyzeAuthPattern(transaction, profile) {
    const factors = [];
    let score = 0;

    if (!profile || !profile.authPatterns) {
      return { score: 0, factors: [] };
    }

    const auth = profile.authPatterns;

    // Recent failed attempts
    if (auth.failedAuthAttempts > 3) {
      score = 60;
      factors.push({
        factor: 'auth_anomaly',
        score: 60,
        description: `${auth.failedAuthAttempts} failed authentication attempts recently`
      });
    }

    // Changed auth method
    if (transaction.sessionInfo?.authMethodUsed &&
        auth.preferredAuthMethod &&
        transaction.sessionInfo.authMethodUsed !== auth.preferredAuthMethod) {
      score = Math.max(score, 25);
      factors.push({
        factor: 'auth_method_change',
        score: 25,
        description: `Used ${transaction.sessionInfo.authMethodUsed} instead of usual ${auth.preferredAuthMethod}`
      });
    }

    return { score, factors };
  }

  /**
   * Get ML model prediction score
   */
  async getMLScore(transaction, profile) {
    return new Promise((resolve) => {
      try {
        // Prepare features for ML model
        const features = this.prepareMLFeatures(transaction, profile);

        // Call Python ML model
        const pythonProcess = spawn('python', [
          path.join(this.mlModelPath, 'predict.py'),
          JSON.stringify(features)
        ]);

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0 && result) {
            try {
              const prediction = JSON.parse(result.trim());
              resolve(prediction.risk_score || null);
            } catch (e) {
              console.error('[RiskScorer] ML parse error:', e);
              resolve(null);
            }
          } else {
            if (error) {
              console.error('[RiskScorer] ML error:', error);
            }
            resolve(null);
          }
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          pythonProcess.kill();
          resolve(null);
        }, 5000);

      } catch (error) {
        console.error('[RiskScorer] ML score error:', error);
        resolve(null);
      }
    });
  }

  /**
   * Prepare features for ML model
   */
  prepareMLFeatures(transaction, profile) {
    const avgAmount = profile?.transactionPatterns?.avgTransactionAmount || 500;
    const stdAmount = profile?.transactionPatterns?.stdDevAmount || 200;

    return {
      amount: transaction.amount || 0,
      amount_zscore: stdAmount > 0 ? (transaction.amount - avgAmount) / stdAmount : 0,
      hour_of_day: transaction.timing?.hourOfDay || new Date().getHours(),
      day_of_week: transaction.timing?.dayOfWeek || new Date().getDay(),
      is_weekend: transaction.timing?.isWeekend ? 1 : 0,
      is_new_recipient: transaction.recipient?.isNewRecipient ? 1 : 0,
      recipient_trust_score: transaction.behavioralFeatures?.recipientTrustScore || 50,
      device_trust_score: transaction.behavioralFeatures?.deviceTrustScore || 50,
      location_trust_score: transaction.behavioralFeatures?.locationTrustScore || 50,
      is_unusual_time: transaction.behavioralFeatures?.isUnusualTime ? 1 : 0,
      is_unusual_location: transaction.behavioralFeatures?.isUnusualLocation ? 1 : 0,
      is_unusual_device: transaction.behavioralFeatures?.isUnusualDevice ? 1 : 0,
      transaction_velocity_1h: transaction.behavioralFeatures?.velocityScore || 0,
      transaction_velocity_24h: 0,
      amount_velocity_24h: 0,
      session_duration: transaction.sessionInfo?.sessionDuration || 60,
      actions_before_transaction: transaction.sessionInfo?.actionsBeforeTransaction || 5,
      time_since_last_transaction: 3600,
      failed_auth_count_24h: profile?.authPatterns?.failedAuthAttempts || 0,
      device_age_days: 30
    };
  }

  /**
   * Create fraud alert
   */
  async createFraudAlert(transaction, userId, riskResult) {
    try {
      const alert = new FraudAlert({
        alertId: uuidv4(),
        userId,
        transactionId: transaction.transactionId,
        alertType: this.determineAlertType(riskResult.riskFactors),
        severity: riskResult.riskLevel,
        riskScore: riskResult.riskScore,
        riskFactors: riskResult.riskFactors.map(f => ({
          factor: f.factor,
          score: f.score,
          description: f.description
        })),
        transactionSnapshot: {
          amount: transaction.amount,
          recipientUpiId: transaction.recipient?.upiId,
          recipientName: transaction.recipient?.name,
          timestamp: new Date()
        },
        action: riskResult.requiresBlock ? 'block' :
                riskResult.requiresReauth ? 'require_reauth' : 'flag_review',
        reauthRequired: riskResult.requiresReauth,
        status: 'pending'
      });

      await alert.save();
      console.log(`[RiskScorer] Created fraud alert: ${alert.alertId}`);

      return alert;
    } catch (error) {
      console.error('[RiskScorer] Error creating fraud alert:', error);
      return null;
    }
  }

  /**
   * Determine alert type from risk factors
   */
  determineAlertType(riskFactors) {
    if (!riskFactors || riskFactors.length === 0) {
      return 'pattern_anomaly';
    }

    // Find highest scoring factor
    const topFactor = riskFactors.reduce((max, f) =>
      f.score > max.score ? f : max,
      { score: 0, factor: 'pattern_anomaly' }
    );

    const factorMapping = {
      'amount_deviation': 'unusual_amount',
      'time_anomaly': 'unusual_time',
      'location_anomaly': 'unusual_location',
      'device_anomaly': 'unusual_device',
      'recipient_anomaly': 'unusual_recipient',
      'velocity_anomaly': 'high_velocity',
      'auth_anomaly': 'multiple_auth_failures',
      'behavioral_anomaly': 'suspicious_behavior',
      'ml_model': 'ml_anomaly'
    };

    return factorMapping[topFactor.factor] || 'pattern_anomaly';
  }

  /**
   * Get risk level from score
   */
  getRiskLevel(score) {
    if (score >= this.riskThresholds.critical) return 'critical';
    if (score >= this.riskThresholds.high) return 'high';
    if (score >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculate distance between coordinates (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Check if transaction requires re-authentication
   */
  async requiresReauthentication(transaction, userId) {
    const riskResult = await this.calculateTransactionRisk(transaction, userId);
    return {
      required: riskResult.requiresReauth,
      reason: riskResult.riskFactors[0]?.description || 'Risk threshold exceeded',
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel
    };
  }
}

// Singleton instance
const riskScorer = new RiskScorer();

module.exports = riskScorer;
