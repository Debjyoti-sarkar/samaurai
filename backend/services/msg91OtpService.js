/**
 * MSG91 OTP Service
 * Handles real OTP sending and verification using MSG91 v5 API
 */

const axios = require('axios');

const getAuthKey = () => process.env.MSG91_AUTH_KEY;
const getTemplateId = () => process.env.MSG91_TEMPLATE_ID;
const getOtpExpiry = () => Number(process.env.MSG91_OTP_EXPIRY || 5);
const getOtpLength = () => Number(process.env.MSG91_OTP_LENGTH || 6);

const formatMobile = (phoneNumber) => {
  // MSG91 requires mobile number with country code
  // e.g., 919876543210 (without + sign)
  let mobile = phoneNumber.replace(/[^0-9]/g, '');
  if (mobile.length === 10) {
    mobile = '91' + mobile; // Add India country code if only 10 digits
  }
  return mobile;
};

const buildSendOtpUrl = (mobile, authKey) => {
  const params = new URLSearchParams({
    mobile,
    authkey: authKey,
    otp_expiry: String(getOtpExpiry()),
    otp_length: String(getOtpLength()),
    realTimeResponse: '1',
  });

  const templateId = getTemplateId();
  if (templateId) {
    params.set('template_id', templateId);
  }

  return `https://control.msg91.com/api/v5/otp?${params.toString()}`;
};

const sendOtpRequest = async (url) => {
  return axios.post(url, {}, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    timeout: 10000
  });
};

/**
 * Send OTP to a phone number
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<Object>} - Result object
 */
async function sendOTP(phoneNumber) {
  try {
    const authKey = getAuthKey();
    
    if (!authKey || authKey === 'YOUR_AUTH_KEY_HERE') {
      throw new Error('MSG91_AUTH_KEY is missing or invalid in .env!');
    }

    const mobile = formatMobile(phoneNumber);
    const url = buildSendOtpUrl(mobile, authKey);

    console.log('[MSG91] Sending OTP Request:');
    console.log('  Phone:', phoneNumber);
    console.log('  Formatted Mobile:', mobile);
    console.log('  Auth Key (first 10 chars):', authKey ? authKey.substring(0, 10) + '...' : 'MISSING');
    if (!getTemplateId()) {
      console.warn('[MSG91] MSG91_TEMPLATE_ID not set. Delivery may be delayed/blocked on some routes.');
    }

    let response;
    try {
      response = await sendOtpRequest(url);
    } catch (firstError) {
      console.warn('[MSG91] First OTP attempt failed, retrying once...');
      response = await sendOtpRequest(url);
    }

    console.log('[MSG91] Response:', JSON.stringify(response.data, null, 2));

    if (response.data.type === 'success') {
      console.log('✅ MSG91 OTP sent successfully to', mobile);
      return { success: true, to: phoneNumber, message: 'OTP sent successfully' };
    } else {
      console.log('❌ MSG91 returned non-success status:', response.data.type);
      throw new Error(response.data.message || 'Failed to send OTP');
    }

  } catch (error) {
    console.error('❌ Error sending MSG91 OTP:', error.message);
    if (error.response) {
      console.error('   Response Status:', error.response.status);
      console.error('   Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message, message: 'Failed to send OTP' };
  }
}

/**
 * Verify OTP entered by user
 * @param {string} phoneNumber - Phone number
 * @param {string} code - OTP code
 * @returns {Promise<Object>} - Verification status
 */
async function verifyOTP(phoneNumber, code) {
  try {
    const authKey = getAuthKey();
    
    if (!authKey || authKey === 'YOUR_AUTH_KEY_HERE') {
      throw new Error('MSG91_AUTH_KEY is missing or invalid in .env!');
    }

    const mobile = formatMobile(phoneNumber);
    const verifyParams = new URLSearchParams({
      otp: code,
      authkey: authKey,
      mobile,
    });
    const url = `https://control.msg91.com/api/v5/otp/verify?${verifyParams.toString()}`;

    console.log('[MSG91] Verifying OTP Request:');
    console.log('  Phone:', phoneNumber);
    console.log('  Formatted Mobile:', mobile);
    console.log('  Code:', code);

    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' }
    });

    console.log('[MSG91] Verify Response:', JSON.stringify(response.data, null, 2));

    if (response.data.type === 'success' || response.data.message === 'OTP verified success') {
      console.log('✅ MSG91 OTP verification result: approved');
      return { success: true, valid: true, to: phoneNumber, message: 'OTP verified successfully' };
    } else {
      console.log('❌ MSG91 verification returned non-success status:', response.data.type);
      return { success: false, valid: false, to: phoneNumber, message: 'Invalid or expired OTP' };
    }

  } catch (error) {
    console.error('❌ Error verifying MSG91 OTP:', error.message);
    if (error.response) {
      console.error('   Response Status:', error.response.status);
      console.error('   Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    // If msg91 returns 400 for wrong OTP or expiry
    if (error.response && error.response.data && error.response.data.type === 'error') {
       return { success: false, message: error.response.data.message || 'Invalid OTP' };
    }
    return { success: false, error: error.message, message: 'Failed to verify OTP' };
  }
}

module.exports = { sendOTP, verifyOTP };
