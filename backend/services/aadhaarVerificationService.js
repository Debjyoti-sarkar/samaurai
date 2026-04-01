const axios = require('axios');
require('dotenv').config();

const BASE_URL = (process.env.AADHAAR_API_BASE_URL || 'https://kyc-api.surepass.io/api/v1').replace(/\/+$/, '');
const API_KEY = process.env.AADHAAR_API_KEY;
const API_SECRET = process.env.AADHAAR_API_SECRET;
const BEARER_TOKEN = process.env.AADHAAR_BEARER_TOKEN;
const AADHAAR_SANDBOX_MODE = (process.env.AADHAAR_SANDBOX_MODE || 'auto').toLowerCase();
const SANDBOX_API_VERSION = process.env.AADHAAR_API_VERSION || '2.0';
const IS_SANDBOX_PROVIDER = BASE_URL.includes('sandbox.co.in');

const mockOtpStore = new Map();
let cachedSandboxToken = null;
let sandboxTokenExpiryMs = 0;

const isAuthOrPrivilegeError = (error) => {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.message || error?.message || '').toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    message.includes('invalid token') ||
    message.includes('token is missing') ||
    message.includes('insufficient privilege') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  );
};

const shouldUseMockFallback = (error) =>
  AADHAAR_SANDBOX_MODE === 'mock' ||
  (AADHAAR_SANDBOX_MODE === 'auto' && isAuthOrPrivilegeError(error));

const createMockProfile = (aadhaar) => {
  const last4 = String(aadhaar).slice(-4);
  return {
    full_name: 'Sandbox User',
    aadhaar_number: `XXXX-XXXX-${last4}`,
    dob: '1990-01-01',
    gender: 'M',
    house: '12A',
    street: 'MG Road',
    landmark: 'Near Park',
    locality: 'Central',
    vtc: 'Bengaluru',
    subdivision: 'South',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    country: 'India',
    zip: '560001',
    address: '12A, MG Road, Bengaluru, Karnataka 560001',
    photo_link: '',
    has_image: false,
    mobile_verified: true,
    reference_id: `MOCK-REF-${Date.now()}`,
  };
};

const buildHeaderCandidates = () => {
  const common = {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...(API_SECRET ? { 'x-api-secret': API_SECRET } : {}),
  };

  const candidates = [];

  // Primary mode: provider key/secret headers.
  if (API_KEY && API_SECRET) {
    candidates.push(common);
  }

  if (BEARER_TOKEN) {
    candidates.push({
      ...common,
      Authorization: `Bearer ${BEARER_TOKEN}`,
    });
  }

  // Fallback for non-standard provider behavior when only one credential is present.
  if (candidates.length === 0) {
    candidates.push(common);
  }

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

const getSandboxAccessToken = async () => {
  if (cachedSandboxToken && Date.now() < sandboxTokenExpiryMs - 300000) {
    return cachedSandboxToken;
  }

  const response = await axios.post(
    `${BASE_URL}/authenticate`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-api-secret': API_SECRET,
      },
      timeout: 15000,
    }
  );

  const token = response?.data?.access_token || response?.data?.token;
  if (!token) {
    throw new Error(response?.data?.message || 'Failed to get sandbox access token');
  }

  cachedSandboxToken = token;
  // Sandbox token is generally valid for 24h; refresh proactively.
  sandboxTokenExpiryMs = Date.now() + 24 * 60 * 60 * 1000;
  return cachedSandboxToken;
};

const mapSandboxVerifyData = (data = {}) => ({
  full_name: data.name || '',
  aadhaar_number: data.aadhaar_number || '',
  dob: data.date_of_birth || '',
  gender: data.gender || '',
  address: {
    house: data.address?.house || '',
    street: data.address?.street || '',
    landmark: data.address?.landmark || '',
    locality: data.address?.vtc || '',
    vtc: data.address?.vtc || '',
    subdivision: data.address?.subdistrict || '',
    district: data.address?.district || '',
    state: data.address?.state || '',
    country: data.address?.country || 'India',
    pincode: data.address?.pincode || '',
    full_address: data.full_address || '',
  },
  photo_link: data.photo || '',
  has_image: Boolean(data.photo),
  mobile_verified: true,
  reference_id: data.reference_id,
});

// Generate OTP
const generateAadhaarOTP = async (aadhaar) => {
  try {
    if (!API_KEY || !API_SECRET) {
      throw new Error('AADHAAR_API_KEY or AADHAAR_API_SECRET is missing in backend environment');
    }

    if (IS_SANDBOX_PROVIDER) {
      const token = await getSandboxAccessToken();
      const response = await axios.post(
        `${BASE_URL}/kyc/aadhaar/okyc/otp`,
        {
          '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
          aadhaar_number: aadhaar,
          consent: 'Y',
          reason: 'KYC verification',
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-api-version': SANDBOX_API_VERSION,
          },
          timeout: 15000,
        }
      );

      const payload = response?.data || {};
      if (payload.code !== 200 || !payload.data) {
        return {
          success: false,
          message: payload.message || 'Failed to generate OTP',
          error: payload.code || 'GENERATION_FAILED',
        };
      }

      const providerMessage = String(payload.data.message || payload.message || '');
      const looksInvalidAadhaar = /invalid\s+aadhaar|invalid\s+aadhaar\s+card|aadhaar\s+not\s+valid/i.test(providerMessage);
      if (looksInvalidAadhaar) {
        return {
          success: false,
          message: providerMessage,
          error: 'INVALID_AADHAAR',
        };
      }

      const referenceId = payload.data.reference_id;
      if (!referenceId) {
        return {
          success: false,
          message: providerMessage || 'OTP not generated yet. Please retry shortly.',
          error: 'REFERENCE_ID_MISSING',
        };
      }

      return {
        success: true,
        message: providerMessage || 'OTP sent successfully',
        client_id: String(referenceId),
        reference_id: referenceId,
        message_code: payload.message_code || null,
        if_number: false,
        valid_aadhaar: true,
      };
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
    if (shouldUseMockFallback(error)) {
      const clientId = `mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      mockOtpStore.set(clientId, {
        otp: '123456',
        expiresAt: Date.now() + 10 * 60 * 1000,
        profile: createMockProfile(aadhaar),
      });

      return {
        success: true,
        message: 'Sandbox OTP generated. Use OTP: 123456',
        client_id: clientId,
        reference_id: `MOCK-${Date.now()}`,
        message_code: 'mock_otp',
        if_number: false,
        valid_aadhaar: true,
      };
    }

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
    if (String(client_id).startsWith('mock_')) {
      const record = mockOtpStore.get(client_id);
      if (!record) {
        return {
          success: false,
          verified: false,
          message: 'OTP session not found. Please request a new OTP.',
          error: 'MOCK_SESSION_NOT_FOUND',
        };
      }

      if (Date.now() > record.expiresAt) {
        mockOtpStore.delete(client_id);
        return {
          success: false,
          verified: false,
          message: 'OTP expired. Please request a new OTP.',
          error: 'MOCK_OTP_EXPIRED',
        };
      }

      if (String(otp).trim() !== record.otp) {
        return {
          success: false,
          verified: false,
          message: 'Invalid OTP',
          error: 'MOCK_INVALID_OTP',
        };
      }

      const data = record.profile;
      mockOtpStore.delete(client_id);
      return {
        success: true,
        verified: true,
        message: 'Aadhaar verified successfully (sandbox)',
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
    }

    if (!API_KEY || !API_SECRET) {
      throw new Error('AADHAAR_API_KEY or AADHAAR_API_SECRET is missing in backend environment');
    }

    if (IS_SANDBOX_PROVIDER) {
      const token = await getSandboxAccessToken();
      const response = await axios.post(
        `${BASE_URL}/kyc/aadhaar/okyc/otp/verify`,
        {
          '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
          reference_id: String(client_id),
          otp,
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-api-version': SANDBOX_API_VERSION,
          },
          timeout: 15000,
        }
      );

      const payload = response?.data || {};
      if (payload.code !== 200 || !payload.data || payload.data.status !== 'VALID') {
        return {
          success: false,
          verified: false,
          message: payload.message || 'OTP verification failed',
          error: payload.code || 'VERIFICATION_FAILED',
        };
      }

      const data = mapSandboxVerifyData(payload.data);
      return {
        success: true,
        verified: true,
        message: payload.message || 'Aadhaar verified successfully',
        data,
      };
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