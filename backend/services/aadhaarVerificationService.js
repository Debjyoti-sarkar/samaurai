const axios = require('axios');
require('dotenv').config();

const BASE_URL = (process.env.AADHAAR_API_BASE_URL || 'https://kyc-api.surepass.io/api/v1').replace(/\/+$/, '');
const API_KEY = process.env.AADHAAR_API_KEY;
const API_SECRET = process.env.AADHAAR_API_SECRET;
const BEARER_TOKEN = process.env.AADHAAR_BEARER_TOKEN;

const buildHeaderCandidates = () => {
  const common = {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...(API_SECRET ? { 'x-api-secret': API_SECRET } : {}),
  };

  const candidates = [];

  if (BEARER_TOKEN) {
    candidates.push({
      ...common,
      Authorization: `Bearer ${BEARER_TOKEN}`,
    });
  }

  if (API_KEY) {
    candidates.push({
      ...common,
      Authorization: `Bearer ${API_KEY}`,
    });
  }

  // Some providers accept x-api headers without Authorization.
  candidates.push(common);

  return candidates;
};

const callProviderWithAuthFallback = async (endpoint, payload) => {
  const headerCandidates = buildHeaderCandidates();
  let lastError;
  let firstAuthError;

  for (const headers of headerCandidates) {
    try {
      return await axios.post(`${BASE_URL}${endpoint}`, payload, { headers, timeout: 15000 });
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (!firstAuthError && (status === 401 || status === 403)) {
        firstAuthError = error;
      }
      if (status && status < 500 && status !== 401 && status !== 403) {
        throw error;
      }
    }
  }

  throw firstAuthError || lastError;
};

const mapProviderError = (error, fallbackMessage) => {
  const providerData = error?.response?.data;
  const providerMessage =
    providerData?.message ||
    providerData?.reason ||
    error?.message ||
    fallbackMessage;

  const reference = providerData?.transaction_id || providerData?.message_code;
  const message = reference ? `${providerMessage} (ref: ${reference})` : providerMessage;

  return {
    message,
    errorCode: providerData?.error_code || providerData?.code,
  };
};

// Generate OTP
const generateAadhaarOTP = async (aadhaar) => {
  try {
    if (!API_KEY || !API_SECRET) {
      throw new Error('AADHAAR_API_KEY or AADHAAR_API_SECRET is missing in backend environment');
    }

    const response = await callProviderWithAuthFallback('/aadhaar-v2/generate-otp', {
      id_number: aadhaar,
    });

    if (response.data?.success === false) {
      return {
        success: false,
        message: response.data?.message || 'Failed to generate OTP',
        error: response.data?.error_code || response.data?.code || 'GENERATION_FAILED',
      };
    }

    return {
      success: true,
      message: response.data?.message || 'OTP sent successfully',
      client_id: response.data?.data?.client_id,
      reference_id: response.data?.data?.reference_id,
      message_code: response.data?.data?.message_code,
      if_number: response.data?.data?.if_number || false,
      valid_aadhaar: response.data?.data?.valid_aadhaar !== false,
    };
  } catch (error) {
    console.error('Generate OTP Error:', error.response?.data || error.message);
    const mapped = mapProviderError(error, 'Failed to generate OTP');
    return {
      success: false,
      message: mapped.message,
      error: mapped.errorCode || 'GENERATION_FAILED',
    };
  }
};

// Verify OTP
const verifyAadhaarOTP = async (client_id, otp) => {
  try {
    if (!API_KEY || !API_SECRET) {
      throw new Error('AADHAAR_API_KEY or AADHAAR_API_SECRET is missing in backend environment');
    }

    const response = await callProviderWithAuthFallback('/aadhaar-v2/submit-otp', {
      client_id,
      otp,
    });

    if (response.data?.success === false) {
      return {
        success: false,
        verified: false,
        message: response.data?.message || 'OTP verification failed',
        error: response.data?.error_code || response.data?.code || 'VERIFICATION_FAILED',
      };
    }

    const data = response.data?.data || {};

    return {
      success: true,
      verified: true,
      message: response.data?.message || 'Aadhaar verified successfully',
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
  } catch (error) {
    console.error('Verify OTP Error:', error.response?.data || error.message);
    const mapped = mapProviderError(error, 'OTP verification failed');
    return {
      success: false,
      verified: false,
      message: mapped.message,
      error: mapped.errorCode || 'VERIFICATION_FAILED',
    };
  }
};

// Optional (offline)
const verifyAadhaarOffline = async () => {
  return {
    success: false,
    message: 'Offline verification not implemented',
  };
};

module.exports = {
  generateAadhaarOTP,
  verifyAadhaarOTP,
  verifyAadhaarOffline,
};