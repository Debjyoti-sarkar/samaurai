const axios = require("axios");

const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/bert-base-uncased";

async function analyzeTextWithML(text) {
  try {
    // If no HF token, use fallback scoring
    if (!process.env.HUGGING_FACE_TOKEN) {
      console.warn("No Hugging Face token found. Using fallback analysis.");
      return fallbackAnalysis(text);
    }

    const response = await axios.post(
      HUGGING_FACE_API_URL,
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGING_FACE_TOKEN}`,
        },
        timeout: 10000,
      }
    );

    return {
      success: true,
      analysis: response.data,
      fraudScore: calculateFraudScore(text, response.data),
    };
  } catch (error) {
    console.error("Hugging Face API Error:", error.message);
    return fallbackAnalysis(text);
  }
}

function calculateFraudScore(text, mlData) {
  let score = 0;
  const lowerText = text.toLowerCase();

  // Keyword-based scoring
  const fraudKeywords = [
    "urgent", "winner", "prize", "congratulations", "click here",
    "verify", "suspended", "locked", "confirm", "account blocked",
    "refund", "cashback", "lottery", "claim", "expires", "limited time",
    "bank details", "card number", "cvv", "pin", "password", "otp",
    "update kyc", "pan card", "aadhaar", "debit card", "credit card"
  ];

  fraudKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      score += 10;
    }
  });

  // URL presence
  if (lowerText.match(/http|www\.|\.com|\.in|bit\.ly/)) {
    score += 15;
  }

  // Phone number patterns
  if (lowerText.match(/\d{10}/)) {
    score += 5;
  }

  // ALL CAPS (suspicious)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.5) {
    score += 10;
  }

  return Math.min(score, 100);
}

function fallbackAnalysis(text) {
  const fraudScore = calculateFraudScore(text, null);
  
  return {
    success: true,
    analysis: {
      method: "rule-based",
      message: "Using fallback analysis (no ML API)",
    },
    fraudScore,
    isFraud: fraudScore > 50,
  };
}

async function analyzeOTPMessage(message) {
  const analysis = await analyzeTextWithML(message);
  
  // Extract OTP code
  const otpMatch = message.match(/\b\d{4,6}\b/);
  const otp = otpMatch ? otpMatch[0] : null;

  // Check for sender verification
  const trustedSenders = ["SBIINB", "HDFCBK", "ICICIB", "KOTAKB", "AXISBK"];
  const hasTrustedSender = trustedSenders.some(sender => 
    message.toUpperCase().includes(sender)
  );

  return {
    ...analysis,
    otp,
    hasTrustedSender,
    recommendation: analysis.fraudScore > 60 
      ? "High risk - Do not share this OTP" 
      : analysis.fraudScore > 30 
        ? "Medium risk - Verify sender before using" 
        : "Low risk - Appears legitimate",
  };
}

module.exports = {
  analyzeTextWithML,
  analyzeOTPMessage,
  calculateFraudScore,
};
