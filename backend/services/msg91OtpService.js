/**
 * MSG91 OTP Service
 * Handles real OTP sending and verification using MSG91 v5 API
 */

const axios = require('axios');

const getAuthKey = () => process.env.MSG91_AUTH_KEY;
const getTemplateId = () => process.env.MSG91_TEMPLATE_ID;

const formatMobile = (phoneNumber) => {
  // MSG91 requires mobile number with country code, but usually without the '+' sign
  // e.g., 919876543210
  let mobile = phoneNumber.replace(/[^0-9]/g, '');
  if (mobile.length === 10) {
    mobile = '91' + mobile; // Default to India if no country code provided
  }
  return mobile;
};

/**
 * Send OTP to a phone number
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<Object>} - Result object
 */
async function sendOTP(phoneNumber) {
  try {
    const authKey = getAuthKey();
    const templateId = getTemplateId();
    
    if (!authKey || authKey === 'YOUR_AUTH_KEY_HERE') {
      throw new Error('MSG91_AUTH_KEY is missing or invalid in .env!');
    }

    const mobile = formatMobile(phoneNumber);
    const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${mobile}&authkey=${authKey}`;

    const response = await axios.post(url, {}, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.data.type === 'success') {
      console.log('MSG91 OTP sent successfully to', mobile);
      return { success: true, to: phoneNumber, message: 'OTP sent successfully' };
    } else {
      throw new Error(response.data.message || 'Failed to send OTP');
    }

  } catch (error) {
    console.error('Error sending MSG91 OTP:', error.message);
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
    const url = `https://control.msg91.com/api/v5/otp/verify?otp=${code}&authkey=${authKey}&mobile=${mobile}`;

    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.data.type === 'success' || response.data.message === 'OTP verified success') {
      console.log('MSG91 OTP verification result: approved');
      return { success: true, valid: true, to: phoneNumber, message: 'OTP verified successfully' };
    } else {
      return { success: false, valid: false, to: phoneNumber, message: 'Invalid or expired OTP' };
    }

  } catch (error) {
    console.error('Error verifying MSG91 OTP:', error.message);
    // If msg91 returns 400 for wrong OTP or expiry
    if (error.response && error.response.data && error.response.data.type === 'error') {
       return { success: false, message: error.response.data.message || 'Invalid OTP' };
    }
    return { success: false, error: error.message, message: 'Failed to verify OTP' };
  }
}

module.exports = { sendOTP, verifyOTP };
