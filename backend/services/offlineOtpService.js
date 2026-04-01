const { authenticator } = require("otplib");

/**
 * Offline OTP Service
 * Generates time-based OTPs for offline verification
 */

// Configure authenticator
authenticator.options = {
  step: 30, // 30 seconds validity
  window: 1, // Allow 1 step before/after for clock skew
};

function generateSecret() {
  return authenticator.generateSecret();
}

function generateOTP(secret) {
  try {
    const token = authenticator.generate(secret);
    return {
      success: true,
      otp: token,
      validFor: 30, // seconds
      expiresAt: new Date(Date.now() + 30000),
    };
  } catch (error) {
    console.error("OTP Generation Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function verifyOTP(token, secret) {
  try {
    const isValid = authenticator.check(token, secret);
    return {
      success: true,
      isValid: isValid,
      message: isValid ? "OTP verified successfully" : "Invalid or expired OTP",
    };
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return {
      success: false,
      isValid: false,
      error: error.message,
    };
  }
}

function getTimeRemaining() {
  const epoch = Math.floor(Date.now() / 1000);
  const timeRemaining = 30 - (epoch % 30);
  return timeRemaining;
}

// QR Code data for OTP setup (for authenticator apps)
function generateOTPAuthURL(secret, accountName, issuer = "KAVACH") {
  return authenticator.keyuri(accountName, issuer, secret);
}

module.exports = {
  generateSecret,
  generateOTP,
  verifyOTP,
  getTimeRemaining,
  generateOTPAuthURL,
};
