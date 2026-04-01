/**
 * Fast2SMS OTP Service
 * Sends OTP via Fast2SMS and verifies using server-side OTP store.
 */

const axios = require('axios');
const crypto = require('crypto');

const FAST2SMS_API_URL = 'https://www.fast2sms.com/dev/bulkV2';
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const FAST2SMS_ROUTE = process.env.FAST2SMS_ROUTE || 'q';
const FAST2SMS_SENDER_ID = process.env.FAST2SMS_SENDER_ID || '';
const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);
const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS || 300);
const OTP_SMS_TEMPLATE = 'Your KAVACH OTP is {OTP}. Valid for {EXPIRY_MIN} minutes. Do not share it with anyone.';

const otpStore = new Map();

function normalizePhone(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  const tenDigit = digits.slice(-10);

  if (tenDigit.length !== 10) {
    throw new Error('Invalid phone number format');
  }

  return {
    local: tenDigit,
    international: `+91${tenDigit}`,
  };
}

function generateOtp() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH;
  return String(crypto.randomInt(min, max));
}

function buildMessage(otp) {
  return OTP_SMS_TEMPLATE
    .replace('{OTP}', otp)
    .replace('{EXPIRY_MIN}', String(Math.max(1, Math.floor(OTP_EXPIRY_SECONDS / 60))));
}

async function sendSMS(localPhone, message) {
  if (!FAST2SMS_API_KEY) {
    throw new Error('FAST2SMS_API_KEY is missing in backend environment');
  }

  const payload = {
    route: FAST2SMS_ROUTE,
    language: 'english',
    flash: 0,
    numbers: localPhone,
    message,
  };

  if (FAST2SMS_SENDER_ID) {
    payload.sender_id = FAST2SMS_SENDER_ID;
  }

  const response = await axios.post(FAST2SMS_API_URL, payload, {
    headers: {
      authorization: FAST2SMS_API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  return response.data;
}

async function sendOTP(phoneNumber) {
  try {
    const normalized = normalizePhone(phoneNumber);
    const otp = generateOtp();
    const message = buildMessage(otp);

    const providerResponse = await sendSMS(normalized.local, message);
    const providerSuccess =
      providerResponse?.return === true ||
      providerResponse?.status_code === 200;

    if (!providerSuccess) {
      return {
        success: false,
        message: providerResponse?.message?.[0] || providerResponse?.message || 'Failed to send OTP',
      };
    }

    otpStore.set(normalized.international, {
      otp,
      expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000,
      createdAt: Date.now(),
    });

    return {
      success: true,
      to: normalized.international,
      status: 'pending',
      message: 'OTP sent successfully',
    };
  } catch (error) {
    const providerStatus = error?.response?.status;
    const providerData = error?.response?.data;
    console.error('Error sending OTP with Fast2SMS:', {
      message: error.message,
      providerStatus,
      providerData,
    });

    const providerMessage = Array.isArray(providerData?.message)
      ? providerData.message[0]
      : providerData?.message || providerData?.reason || error.message;

    return {
      success: false,
      error: providerMessage,
      providerStatus,
      providerResponse: providerData,
      message: 'Failed to send OTP',
    };
  }
}

async function verifyOTP(phoneNumber, code) {
  try {
    const normalized = normalizePhone(phoneNumber);
    const record = otpStore.get(normalized.international);

    if (!record) {
      return {
        success: false,
        valid: false,
        status: 'not_found',
        to: normalized.international,
        message: 'OTP not found. Please request a new OTP.',
      };
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalized.international);
      return {
        success: false,
        valid: false,
        status: 'expired',
        to: normalized.international,
        message: 'OTP expired. Please request a new OTP.',
      };
    }

    if (String(code).trim() !== String(record.otp)) {
      return {
        success: false,
        valid: false,
        status: 'invalid',
        to: normalized.international,
        message: 'Invalid OTP',
      };
    }

    otpStore.delete(normalized.international);
    return {
      success: true,
      valid: true,
      status: 'approved',
      to: normalized.international,
      message: 'OTP verified successfully',
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
