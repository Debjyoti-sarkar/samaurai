/**
 * Twilio OTP Service
 * Handles real OTP sending and verification using Twilio Verify API
 */

const twilio = require('twilio');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client;

try {
  client = twilio(accountSid, authToken);
} catch (error) {
  console.error('Error initializing Twilio client:', error.message);
}

/**
 * Send OTP to a phone number
 * @param {string} phoneNumber - Phone number with country code (e.g., +917209799940)
 * @returns {Promise<Object>} - Result object with success status and message
 */
async function sendOTP(phoneNumber) {
  try {
    if (!client) {
      throw new Error('Twilio client not initialized. Check your credentials.');
    }

    // Validate phone number format
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+91' + phoneNumber.replace(/^0+/, ''); // Add +91 for Indian numbers
    }

    const verification = await client.verify.v2
      .services(verifySid)
      .verifications.create({
        to: phoneNumber,
        channel: 'sms',
      });

    console.log('OTP sent successfully:', verification.status);

    return {
      success: true,
      status: verification.status,
      to: phoneNumber,
      message: 'OTP sent successfully',
      valid: verification.valid,
    };
  } catch (error) {
    console.error('Error sending OTP:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send OTP',
    };
  }
}

/**
 * Verify OTP entered by user
 * @param {string} phoneNumber - Phone number with country code
 * @param {string} code - OTP code entered by user
 * @returns {Promise<Object>} - Result object with verification status
 */
async function verifyOTP(phoneNumber, code) {
  try {
    if (!client) {
      throw new Error('Twilio client not initialized. Check your credentials.');
    }

    // Validate phone number format
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+91' + phoneNumber.replace(/^0+/, ''); // Add +91 for Indian numbers
    }

    const verificationCheck = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({
        to: phoneNumber,
        code: code,
      });

    console.log('OTP verification result:', verificationCheck.status);

    return {
      success: verificationCheck.status === 'approved',
      status: verificationCheck.status,
      valid: verificationCheck.valid,
      to: phoneNumber,
      message:
        verificationCheck.status === 'approved'
          ? 'OTP verified successfully'
          : 'Invalid or expired OTP',
    };
  } catch (error) {
    console.error('Error verifying OTP:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to verify OTP',
    };
  }
}

module.exports = {
  sendOTP,
  verifyOTP,
};
