/**
 * Spam Detection Service
 * Detects spam calls and SMS messages
 */

// Known spam pattern database
const spamPatterns = {
  keywords: [
    "congratulations", "winner", "prize", "lottery", "claim now",
    "click here", "limited time", "expires soon", "urgent action",
    "verify account", "suspended", "blocked", "confirm details",
    "free gift", "cashback", "refund", "tax refund", "govt scheme",
    "medical insurance", "loan approved", "credit card approved",
    "debt relief", "work from home", "earn money", "investment opportunity"
  ],
  
  phonePatterns: [
    /^1800/, // Toll-free (often legitimate but used by telemarketers)
    /^140/, // Promotional codes
    /^95\d{8}$/, // Promotional numbers
    /^56789/, // Common spam patterns
  ],
  
  trustedPrefixes: [
    "SBIINB", "HDFCBK", "ICICIB", "KOTAKB", "AXISBK", "PNBSMS",
    "SBIPSG", "HDFCBK", "YESBNK", "UNIBAN", "CITIBK", "SCBANK"
  ],
};

function analyzeMessage(message, sender = "") {
  let spamScore = 0;
  const flags = [];

  const lowerMessage = message.toLowerCase();
  const upperSender = sender.toUpperCase();

  // Check for trusted bank senders
  const isTrustedSender = spamPatterns.trustedPrefixes.some(prefix =>
    upperSender.includes(prefix)
  );

  if (isTrustedSender) {
    spamScore -= 30; // Reduce spam score for trusted senders
    flags.push("Trusted bank sender");
  }

  // Keyword analysis
  let keywordMatches = 0;
  spamPatterns.keywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) {
      keywordMatches++;
      spamScore += 8;
    }
  });

  if (keywordMatches > 0) {
    flags.push(`${keywordMatches} spam keywords detected`);
  }

  // URL detection
  const urlCount = (message.match(/http|www\.|\.com|\.in|bit\.ly|tinyurl/gi) || []).length;
  if (urlCount > 0) {
    spamScore += urlCount * 15;
    flags.push(`${urlCount} URL(s) found`);
  }

  // ALL CAPS detection
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
  if (capsRatio > 0.6 && message.length > 20) {
    spamScore += 12;
    flags.push("Excessive capitalization");
  }

  // Exclamation marks
  const exclamationCount = (message.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    spamScore += exclamationCount * 5;
    flags.push("Excessive exclamation marks");
  }

  // Number sequences (fake transaction IDs, etc.)
  const longNumbers = message.match(/\d{10,}/g);
  if (longNumbers && longNumbers.length > 2) {
    spamScore += 10;
    flags.push("Multiple long number sequences");
  }

  return {
    isSpam: spamScore > 40,
    spamScore: Math.max(0, Math.min(100, spamScore)),
    riskLevel: getSpamRiskLevel(spamScore),
    flags,
    isTrustedSender,
  };
}

function analyzePhoneNumber(phoneNumber) {
  let spamScore = 0;
  const flags = [];

  // Check against spam patterns
  spamPatterns.phonePatterns.forEach(pattern => {
    if (pattern.test(phoneNumber)) {
      spamScore += 25;
      flags.push("Matches known spam pattern");
    }
  });

  // Check for promotional number patterns
  if (phoneNumber.startsWith("95") || phoneNumber.startsWith("96")) {
    spamScore += 15;
    flags.push("Promotional number prefix");
  }

  // Toll-free numbers
  if (phoneNumber.startsWith("1800")) {
    spamScore += 10;
    flags.push("Toll-free number (verify legitimacy)");
  }

  return {
    isSpam: spamScore > 30,
    spamScore: Math.min(100, spamScore),
    riskLevel: getSpamRiskLevel(spamScore),
    flags,
    recommendation: spamScore > 50
      ? "Block this number"
      : spamScore > 30
        ? "Be cautious with this number"
        : "Number appears safe",
  };
}

function getSpamRiskLevel(score) {
  if (score >= 70) return "critical";
  if (score >= 50) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function checkOTPMessageLegitimacy(message, sender) {
  const analysis = analyzeMessage(message, sender);
  
  // Extract OTP
  const otpMatch = message.match(/\b\d{4,6}\b/);
  const otp = otpMatch ? otpMatch[0] : null;

  // Additional OTP-specific checks
  const hasOTPKeyword = /otp|one time password|verification code|pin/i.test(message);
  
  if (hasOTPKeyword && analysis.isTrustedSender) {
    return {
      ...analysis,
      otp,
      isLegitimate: true,
      recommendation: "OTP from trusted source - Safe to use",
    };
  }

  if (hasOTPKeyword && analysis.isSpam) {
    return {
      ...analysis,
      otp,
      isLegitimate: false,
      recommendation: "DANGER: Potential phishing OTP - Do NOT share",
    };
  }

  return {
    ...analysis,
    otp,
    isLegitimate: !analysis.isSpam,
  };
}

module.exports = {
  analyzeMessage,
  analyzePhoneNumber,
  checkOTPMessageLegitimacy,
  getSpamRiskLevel,
};
