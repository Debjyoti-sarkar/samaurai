const natural = require("natural");
const Transaction = require("../models/Transaction");

class MLFraudDetection {
  constructor() {
    this.classifier = new natural.BayesClassifier();
    this.trainModel();
  }

  trainModel() {
    // Training data for fraud patterns
    this.classifier.addDocument("urgent payment required immediately", "fraud");
    this.classifier.addDocument("verify your account now", "fraud");
    this.classifier.addDocument("winner of lottery prize", "fraud");
    this.classifier.addDocument("click this link to claim", "fraud");
    this.classifier.addDocument("account will be suspended", "fraud");
    this.classifier.addDocument("confirm your card details", "fraud");
    
    this.classifier.addDocument("payment received successfully", "legitimate");
    this.classifier.addDocument("monthly bill payment", "legitimate");
    this.classifier.addDocument("salary credited to account", "legitimate");
    this.classifier.addDocument("grocery store purchase", "legitimate");
    
    this.classifier.train();
  }

  async analyzeTransaction(transactionData) {
    const {
      amount,
      recipientPhone,
      description,
      userId,
      type
    } = transactionData;

    let fraudScore = 0;
    const flags = [];

    // Amount-based analysis
    if (amount > 50000) {
      fraudScore += 25;
      flags.push("High amount transaction");
    } else if (amount > 25000) {
      fraudScore += 15;
      flags.push("Medium-high amount");
    }

    // Round number (common in scams)
    if (amount % 1000 === 0 && amount > 5000) {
      fraudScore += 10;
      flags.push("Suspiciously round amount");
    }

    // Description analysis
    if (description) {
      const classification = this.classifier.classify(description);
      if (classification === "fraud") {
        fraudScore += 30;
        flags.push("Fraudulent description pattern");
      }

      // Check for urgency keywords
      const urgencyWords = ["urgent", "immediately", "now", "hurry"];
      if (urgencyWords.some(word => description.toLowerCase().includes(word))) {
        fraudScore += 15;
        flags.push("Urgency indicators");
      }
    }

    // Transaction frequency check
    if (userId) {
      const recentTransactions = await this.checkTransactionFrequency(userId);
      if (recentTransactions.count > 5) {
        fraudScore += 20;
        flags.push("High transaction frequency");
      }
    }

    // New recipient check
    if (recipientPhone && userId) {
      const isNewRecipient = await this.isNewRecipient(userId, recipientPhone);
      if (isNewRecipient && amount > 10000) {
        fraudScore += 15;
        flags.push("Large payment to new recipient");
      }
    }

    return {
      fraudScore: Math.min(fraudScore, 100),
      isFraud: fraudScore > 60,
      flags,
      riskLevel: this.getRiskLevel(fraudScore),
      recommendation: this.getRecommendation(fraudScore),
    };
  }

  async checkTransactionFrequency(userId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    try {
      const count = await Transaction.countDocuments({
        userId,
        timestamp: { $gte: oneHourAgo },
      });

      return { count, timeWindow: "1 hour" };
    } catch (error) {
      console.error("Error checking transaction frequency:", error);
      return { count: 0 };
    }
  }

  async isNewRecipient(userId, recipientPhone) {
    try {
      const existingTransaction = await Transaction.findOne({
        userId,
        recipientPhone,
      });

      return !existingTransaction;
    } catch (error) {
      console.error("Error checking recipient:", error);
      return false;
    }
  }

  getRiskLevel(score) {
    if (score >= 75) return "critical";
    if (score >= 60) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  getRecommendation(score) {
    if (score >= 75) {
      return "BLOCK: This transaction shows critical fraud indicators. Do not proceed.";
    }
    if (score >= 60) {
      return "HIGH RISK: Multiple fraud indicators detected. Verify recipient carefully.";
    }
    if (score >= 40) {
      return "CAUTION: Some suspicious patterns detected. Double-check details.";
    }
    return "LOW RISK: Transaction appears normal.";
  }

  analyzeBehaviorPattern(behaviorData) {
    const {
      typingSpeed,
      clickPattern,
      navigationFlow,
      timeOfDay,
    } = behaviorData;

    let anomalyScore = 0;

    // Typing speed analysis (too fast might be bot)
    if (typingSpeed > 500) {
      anomalyScore += 20;
    }

    // Unusual time of day (2 AM - 5 AM)
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) {
      anomalyScore += 15;
    }

    return {
      anomalyScore,
      isAnomaly: anomalyScore > 30,
      details: "Behavioral analysis complete",
    };
  }
}

module.exports = new MLFraudDetection();
