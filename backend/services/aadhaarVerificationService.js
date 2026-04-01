/**
 * Aadhaar Verification Service
 * Sandbox API integration for Aadhaar verification
 */

const axios = require('axios');

// Sandbox API Configuration
const SANDBOX_API_KEY = process.env.AADHAAR_API_KEY;
const SANDBOX_API_SECRET = process.env.AADHAAR_API_SECRET;
const SANDBOX_BASE_URL = process.env.AADHAAR_API_BASE_URL || 'https://kyc-api.surepass.io/api/v1';

/**
 * Generate OTP for Aadhaar verification
 * @param {string} aadhaarNumber - 12-digit Aadhaar number
 * @returns {Promise<Object>} - OTP generation result
 */
async function generateAadhaarOTP(aadhaarNumber) {
  try {
    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      throw new Error('Aadhaar API credentials not configured');
    }

    // Validate Aadhaar number
    if (!aadhaarNumber || aadhaarNumber.length !== 12 || !/^\d{12}$/.test(aadhaarNumber)) {
      throw new Error('Invalid Aadhaar number. Must be 12 digits.');
    }

    const response = await axios.post(
      `${SANDBOX_BASE_URL}/aadhaar-v2/generate-otp`,
      {
        id_number: aadhaarNumber,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SANDBOX_API_KEY}`,
          'x-api-key': SANDBOX_API_KEY,
          'x-api-secret': SANDBOX_API_SECRET,
        },
      }
    );

    console.log('Aadhaar OTP Generation Response:', response.data);

    if (response.data.success) {
      return {
        success: true,
        message: 'OTP sent to Aadhaar registered mobile number',
        client_id: response.data.data?.client_id,
        reference_id: response.data.data?.reference_id,
        message_code: response.data.data?.message_code,
        if_number: response.data.data?.if_number || false,
        valid_aadhaar: response.data.data?.valid_aadhaar !== false,
      };
    } else {
      throw new Error(response.data.message || 'Failed to generate OTP');
    }
  } catch (error) {
    console.error('Aadhaar OTP Generation Error:', error.response?.data || error.message);
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to generate OTP',
      error: error.response?.data?.error_code || 'GENERATION_FAILED',
    };
  }
}

/**
 * Verify Aadhaar OTP and get details
 * @param {string} client_id - Client ID from OTP generation
 * @param {string} otp - OTP received on Aadhaar registered mobile
 * @returns {Promise<Object>} - Verification result with Aadhaar details
 */
async function verifyAadhaarOTP(client_id, otp) {
  try {
    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      throw new Error('Aadhaar API credentials not configured');
    }

    if (!client_id) {
      throw new Error('Client ID is required');
    }

    if (!otp || otp.length !== 6) {
      throw new Error('Invalid OTP. Must be 6 digits.');
    }

    const response = await axios.post(
      `${SANDBOX_BASE_URL}/aadhaar-v2/submit-otp`,
      {
        client_id: client_id,
        otp: otp,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SANDBOX_API_KEY}`,
          'x-api-key': SANDBOX_API_KEY,
          'x-api-secret': SANDBOX_API_SECRET,
        },
      }
    );

    console.log('Aadhaar OTP Verification Response:', response.data);

    if (response.data.success) {
      const data = response.data.data;
      
      return {
        success: true,
        message: 'Aadhaar verified successfully',
        verified: true,
        data: {
          full_name: data.full_name,
          aadhaar_number: data.aadhaar_number,
          dob: data.dob,
          gender: data.gender,
          address: {
            house: data.house,
            street: data.street,
            landmark: data.landmark,
            locality: data.locality,
            vtc: data.vtc,
            subdivision: data.subdivision,
            district: data.district,
            state: data.state,
            country: data.country,
            pincode: data.zip,
            full_address: data.address,
          },
          photo_link: data.photo_link,
          has_image: data.has_image,
          mobile_verified: data.mobile_verified,
          reference_id: data.reference_id,
        },
      };
    } else {
      throw new Error(response.data.message || 'OTP verification failed');
    }
  } catch (error) {
    console.error('Aadhaar OTP Verification Error:', error.response?.data || error.message);
    
    return {
      success: false,
      verified: false,
      message: error.response?.data?.message || error.message || 'OTP verification failed',
      error: error.response?.data?.error_code || 'VERIFICATION_FAILED',
    };
  }
}

/**
 * Verify Aadhaar without OTP (offline verification using XML)
 * This is for cases where you have the Aadhaar XML file
 * @param {Object} xmlData - Aadhaar XML data
 * @returns {Promise<Object>} - Verification result
 */
async function verifyAadhaarOffline(xmlData) {
  try {
    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      throw new Error('Aadhaar API credentials not configured');
    }

    const response = await axios.post(
      `${SANDBOX_BASE_URL}/aadhaar/offline-xml`,
      xmlData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SANDBOX_API_KEY}`,
          'x-api-key': SANDBOX_API_KEY,
          'x-api-secret': SANDBOX_API_SECRET,
        },
      }
    );

    if (response.data.success) {
      return {
        success: true,
        verified: true,
        message: 'Aadhaar XML verified successfully',
        data: response.data.data,
      };
    } else {
      throw new Error(response.data.message || 'XML verification failed');
    }
  } catch (error) {
    console.error('Aadhaar Offline Verification Error:', error.response?.data || error.message);
    
    return {
      success: false,
      verified: false,
      message: error.response?.data?.message || error.message || 'XML verification failed',
      error: error.response?.data?.error_code || 'OFFLINE_VERIFICATION_FAILED',
    };
  }
}

module.exports = {
  generateAadhaarOTP,
  verifyAadhaarOTP,
  verifyAadhaarOffline,
};
