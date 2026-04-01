/**
 * Risk Engine - Evaluates risk for users, transactions, devices, sessions
 * Uses configurable rules and factors to assign risk scores
 */

const RiskAssessment = require("../../models/RiskAssessment");
const Transaction = require("../../models/Transaction");
const Event = require("../../models/Event");
const User = require("../../models/User");
const { v4: uuidv4 } = require("uuid");

class RiskScoringEngine {
  constructor() {
    // Base risk factors with default weights
    this.riskFactors = {
      // Transaction factors
      transaction_amount: {
        weight: 0.15,
        thresholds: {
          low: 5000,
          medium: 25000,
          high: 100000,
        },
        scoring: (value, thresholds) => {
          if (value >= thresholds.high) return 100;
          if (value >= thresholds.medium) return 50;
          if (value >= thresholds.low) return 20;
          return 0;
        },
      },

      // Device factors
      new_device: {
        weight: 0.12,
        scoring: (isNewDevice) => (isNewDevice ? 40 : 0),
      },

      unusual_location: {
        weight: 0.15,
        scoring: (isUnusual) => (isUnusual ? 50 : 0),
      },

      // User behavior factors
      failed_login_attempts: {
        weight: 0.1,
        thresholds: { low: 1, medium: 3, high: 5 },
        scoring: (attempts, thresholds) => {
          if (attempts >= thresholds.high) return 80;
          if (attempts >= thresholds.medium) return 40;
          if (attempts >= thresholds.low) return 10;
          return 0;
        },
      },

      // Recipient factors
      recipient_unknown: {
        weight: 0.1,
        scoring: (isUnknown) => (isUnknown ? 30 : 0),
      },

      // User account factors
      account_age_days: {
        weight: 0.08,
        thresholds: { new: 30, young: 90 },
        scoring: (ageDays, thresholds) => {
          if (ageDays <= thresholds.new) return 50;
          if (ageDays <= thresholds.young) return 20;
          return 0;
        },
      },

      // Behavioral anomalies
      transaction_frequency_anomaly: {
        weight: 0.1,
        scoring: (isAnomalous) => (isAnomalous ? 35 : 0),
      },

      // Device sharing
      device_shared_multiple_users: {
        weight: 0.1,
        scoring: (isShared) => (isShared ? 45 : 0),
      },

      // Velocity checks
      rapid_transactions: {
        weight: 0.1,
        scoring: (hasRapidTransactions) =>
          hasRapidTransactions ? 60 : 0,
      },
    };
  }

  /**
   * Evaluate transaction risk
   */
  async evaluateTransactionRisk(transactionId, transaction) {
    const assessmentId = `risk-${uuidv4()}`;
    const factors = [];

    try {
      // Fetch related data
      const user = await User.findById(transaction.userId);
      const recentTransactions = await Transaction.find({
        userId: transaction.userId,
        timestamp: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      // Transaction amount factor
      const amountScore =
        this.riskFactors.transaction_amount.scoring(
          transaction.amount,
          this.riskFactors.transaction_amount.thresholds
        ) * this.riskFactors.transaction_amount.weight;

      factors.push({
        factorName: "transaction_amount",
        weight: this.riskFactors.transaction_amount.weight,
        score: amountScore,
        threshold: this.riskFactors.transaction_amount.thresholds,
        currentValue: transaction.amount,
        reason:
          transaction.amount > 100000
            ? "Amount exceeds high threshold"
            : "Standard transaction amount",
      });

      // Device factors
      const isNewDevice =
        !user.registeredDevices || !user.registeredDevices.find((d) => d.deviceId === transaction.deviceId);
      const deviceScore =
        this.riskFactors.new_device.scoring(isNewDevice) *
        this.riskFactors.new_device.weight;

      factors.push({
        factorName: "new_device",
        weight: this.riskFactors.new_device.weight,
        score: deviceScore,
        threshold: null,
        currentValue: isNewDevice ? "new" : "registered",
        reason: isNewDevice
          ? "Device not registered for this user"
          : "Known device",
      });

      // Location factor
      const isUnusualLocation = this._isUnusualLocation(
        user,
        transaction.location
      );
      const locationScore =
        this.riskFactors.unusual_location.scoring(isUnusualLocation) *
        this.riskFactors.unusual_location.weight;

      factors.push({
        factorName: "unusual_location",
        weight: this.riskFactors.unusual_location.weight,
        score: locationScore,
        threshold: null,
        currentValue: transaction.location?.city,
        reason: isUnusualLocation
          ? "Location differs from user's typical pattern"
          : "Location matches user profile",
      });

      // Failed login attempts
      const failedLoginScore =
        this.riskFactors.failed_login_attempts.scoring(
          user.failedLoginAttempts,
          this.riskFactors.failed_login_attempts.thresholds
        ) * this.riskFactors.failed_login_attempts.weight;

      factors.push({
        factorName: "failed_login_attempts",
        weight: this.riskFactors.failed_login_attempts.weight,
        score: failedLoginScore,
        threshold: this.riskFactors.failed_login_attempts.thresholds,
        currentValue: user.failedLoginAttempts,
        reason:
          user.failedLoginAttempts > 3
            ? "Multiple failed login attempts"
            : "Normal login behavior",
      });

      // Account age factor
      const accountAgeDays = Math.floor(
        (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const accountAgeScore =
        this.riskFactors.account_age_days.scoring(
          accountAgeDays,
          this.riskFactors.account_age_days.thresholds
        ) * this.riskFactors.account_age_days.weight;

      factors.push({
        factorName: "account_age_days",
        weight: this.riskFactors.account_age_days.weight,
        score: accountAgeScore,
        threshold: this.riskFactors.account_age_days.thresholds,
        currentValue: accountAgeDays,
        reason:
          accountAgeDays < 30 ? "New account" : "Established account",
      });

      // Rapid transactions (velocity check)
      const rapidTransactions = recentTransactions.length > 5;
      const rapidTxScore =
        this.riskFactors.rapid_transactions.scoring(rapidTransactions) *
        this.riskFactors.rapid_transactions.weight;

      factors.push({
        factorName: "rapid_transactions",
        weight: this.riskFactors.rapid_transactions.weight,
        score: rapidTxScore,
        threshold: null,
        currentValue: recentTransactions.length,
        reason:
          rapidTransactions
            ? "Unusually high transaction frequency in 24h"
            : "Normal transaction frequency",
      });

      // Calculate overall score
      const overallRiskScore = Math.min(
        100,
        factors.reduce((sum, f) => sum + f.score, 0)
      );

      // Determine risk level
      let riskLevel = "low";
      if (overallRiskScore >= 70) riskLevel = "critical";
      else if (overallRiskScore >= 50) riskLevel = "high";
      else if (overallRiskScore >= 30) riskLevel = "medium";

      // Save assessment
      const assessment = new RiskAssessment({
        assessmentId,
        entityType: "transaction",
        entityId: transactionId,
        overallRiskScore,
        riskLevel,
        riskFactors: factors,
        rulesApplied: [],
        context: {
          timeWindow: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000),
            end: new Date(),
          },
          relatedEvents: [],
        },
        recommendedActions: this._getRecommendedActions(riskLevel),
      });

      await assessment.save();

      return {
        assessmentId,
        overallRiskScore,
        riskLevel,
        factors,
        recommendedActions: assessment.recommendedActions,
      };
    } catch (error) {
      console.error("Error in evaluateTransactionRisk:", error);
      throw error;
    }
  }

  /**
   * Evaluate user risk based on behavior and history
   */
  async evaluateUserRisk(userId) {
    const assessmentId = `risk-${uuidv4()}`;
    const factors = [];

    try {
      const user = await User.findById(userId);
      const recentTransactions = await Transaction.find({
        userId: userId,
        timestamp: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      });

      // Account age
      const accountAgeDays = Math.floor(
        (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const accountAgeScore =
        this.riskFactors.account_age_days.scoring(
          accountAgeDays,
          this.riskFactors.account_age_days.thresholds
        ) * this.riskFactors.account_age_days.weight;

      factors.push({
        factorName: "account_age_days",
        weight: this.riskFactors.account_age_days.weight,
        score: accountAgeScore,
        currentValue: accountAgeDays,
        threshold: this.riskFactors.account_age_days.thresholds,
        reason: `Account is ${accountAgeDays} days old`,
      });

      // Failed login attempts
      const failedLoginScore =
        this.riskFactors.failed_login_attempts.scoring(
          user.failedLoginAttempts,
          this.riskFactors.failed_login_attempts.thresholds
        ) * this.riskFactors.failed_login_attempts.weight;

      factors.push({
        factorName: "failed_login_attempts",
        weight: this.riskFactors.failed_login_attempts.weight,
        score: failedLoginScore,
        currentValue: user.failedLoginAttempts,
        threshold: this.riskFactors.failed_login_attempts.thresholds,
        reason: `${user.failedLoginAttempts} failed login attempts`,
      });

      // Device diversity
      const deviceCount = user.registeredDevices?.length || 0;
      const deviceScore =
        Math.min(deviceCount, 3) > 1 ? 20 : 0; // More devices = higher risk

      factors.push({
        factorName: "device_sharing",
        weight: 0.1,
        score: deviceScore,
        currentValue: deviceCount,
        reason: `User has ${deviceCount} registered device(s)`,
      });

      // Transaction frequency
      const transactionFrequencyScore =
        recentTransactions.length > 20 ? 25 : 0;

      factors.push({
        factorName: "transaction_frequency",
        weight: 0.1,
        score: transactionFrequencyScore,
        currentValue: recentTransactions.length,
        reason: `${recentTransactions.length} transactions in last 30 days`,
      });

      const overallRiskScore = Math.min(
        100,
        factors.reduce((sum, f) => sum + f.score, 0)
      );

      let riskLevel = "low";
      if (overallRiskScore >= 70) riskLevel = "critical";
      else if (overallRiskScore >= 50) riskLevel = "high";
      else if (overallRiskScore >= 30) riskLevel = "medium";

      const assessment = new RiskAssessment({
        assessmentId,
        entityType: "user",
        entityId: userId,
        overallRiskScore,
        riskLevel,
        riskFactors: factors,
        recommendedActions: this._getRecommendedActions(riskLevel),
      });

      await assessment.save();

      // Update user's risk score
      await User.findByIdAndUpdate(userId, {
        riskScore: overallRiskScore,
        riskLevel,
      });

      return {
        assessmentId,
        overallRiskScore,
        riskLevel,
        factors,
        recommendedActions: assessment.recommendedActions,
      };
    } catch (error) {
      console.error("Error in evaluateUserRisk:", error);
      throw error;
    }
  }

  // Helper method to detect unusual locations
  _isUnusualLocation(user, currentLocation) {
    if (!user.registeredDevices) return true;
    if (!currentLocation || !currentLocation.city) return false;

    const userLocations =
      user.registeredDevices.flatMap((d) => d.locations) || [];
    const isKnownLocation = userLocations.some(
      (loc) => loc.city === currentLocation.city
    );

    return !isKnownLocation;
  }

  // Get recommended actions based on risk level
  _getRecommendedActions(riskLevel) {
    const actions = {
      low: [{ action: "allow", confidence: 99 }],
      medium: [
        { action: "monitor", confidence: 85 },
        {
          action: "request_verification",
          confidence: 40,
        },
      ],
      high: [
        {
          action: "flag_transaction",
          confidence: 90,
        },
        {
          action: "request_verification",
          confidence: 75,
        },
        { action: "create_case", confidence: 60 },
      ],
      critical: [
        {
          action: "block_transaction",
          confidence: 95,
        },
        {
          action: "create_case",
          confidence: 95,
        },
        {
          action: "send_alert",
          confidence: 100,
        },
      ],
    };

    return actions[riskLevel] || actions.low;
  }
}

module.exports = RiskScoringEngine;
