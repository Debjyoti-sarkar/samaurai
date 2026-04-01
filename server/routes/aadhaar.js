/**
 * Aadhaar Verification API Routes
 * Handles REAL Aadhaar verification via Sandbox.co.in OKYC API
 *
 * Sandbox.co.in is a licensed Aadhaar verification provider
 * API Documentation: https://developer.sandbox.co.in/reference/aadhaar-okyc-generate-otp-api
 *
 * Flow:
 * 1. Generate OTP - Sends OTP to Aadhaar-linked mobile
 * 2. Verify OTP - Returns verified Aadhaar data (name, DOB, address, photo)
 */

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// ==================== SANDBOX.CO.IN API CONFIGURATION ====================
// Get your API credentials from: https://developer.sandbox.co.in/
// Free 14-day trial available for testing

// Read config dynamically to ensure env vars are loaded
const getConfig = () => ({
  baseUrl: 'https://api.sandbox.co.in',
  apiKey: process.env.SANDBOX_API_KEY || '',
  apiSecret: process.env.SANDBOX_API_SECRET || '',
  apiVersion: '2.0',
});

// Check if credentials are configured
const isConfigured = () => {
  const config = getConfig();
  return Boolean(config.apiKey && config.apiSecret);
};

// In-memory token cache
let accessToken = null;
let tokenExpiry = 0;

// In-memory storage for verification sessions
const verificationSessions = new Map();

// ==================== HELPER FUNCTIONS ====================

/**
 * Get JWT access token from Sandbox API
 * Token is valid for 24 hours
 */
async function getAccessToken() {
  // Return cached token if still valid (with 5 min buffer)
  if (accessToken && Date.now() < tokenExpiry - 300000) {
    return accessToken;
  }

  const config = getConfig();
  try {
    const response = await fetch(`${config.baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'x-api-secret': config.apiSecret,
      },
    });

    const data = await response.json();

    if (data.access_token) {
      accessToken = data.access_token;
      // Token valid for 24 hours
      tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
      console.log('[Aadhaar] Sandbox access token obtained successfully');
      return accessToken;
    }

    throw new Error(data.message || 'Failed to get access token');
  } catch (error) {
    console.error('[Aadhaar] Token error:', error);
    throw error;
  }
}

/**
 * Mask Aadhaar number (show only last 4 digits)
 */
function maskAadhaar(aadhaar) {
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length !== 12) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${digits.slice(-4)}`;
}

/**
 * Validate Aadhaar using Verhoeff algorithm
 */
function validateAadhaar(aadhaar) {
  const d = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  ];

  const p = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
  ];

  let c = 0;
  const reversedAadhaar = aadhaar.split('').reverse().join('');

  for (let i = 0; i < reversedAadhaar.length; i++) {
    c = d[c][p[i % 8][parseInt(reversedAadhaar[i])]];
  }

  return c === 0;
}

// ==================== API ENDPOINTS ====================

/**
 * Check API configuration status
 * GET /api/aadhaar/config-status
 */
router.get('/config-status', (req, res) => {
  res.json({
    configured: isConfigured(),
    provider: 'Sandbox.co.in',
    message: isConfigured()
      ? 'Aadhaar API is configured and ready'
      : 'API credentials not configured. Set SANDBOX_API_KEY and SANDBOX_API_SECRET environment variables.',
  });
});

/**
 * Request OTP for Aadhaar verification
 * POST /api/aadhaar/request-otp
 *
 * Request Body:
 * {
 *   "aadhaarNumber": "123456789012"
 * }
 */
router.post('/request-otp', async (req, res) => {
  try {
    const { aadhaarNumber } = req.body;

    // Validate Aadhaar number format
    const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');
    if (cleanAadhaar.length !== 12 || !/^\d+$/.test(cleanAadhaar)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number format. Must be 12 digits.',
      });
    }

    // Validate using Verhoeff algorithm
    if (!validateAadhaar(cleanAadhaar)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number. Checksum validation failed.',
      });
    }

    // Check if API is configured
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Aadhaar API not configured. Please contact administrator.',
        setupRequired: true,
      });
    }

    // Get access token
    const token = await getAccessToken();
    const config = getConfig();

    // Call Sandbox OKYC Generate OTP API
    const response = await fetch(`${config.baseUrl}/kyc/aadhaar/okyc/otp`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'x-api-version': config.apiVersion,
      },
      body: JSON.stringify({
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
        'aadhaar_number': cleanAadhaar,
        'consent': 'Y',
        'reason': 'KYC verification for KAVACH banking app',
      }),
    });

    const data = await response.json();
    console.log('[Aadhaar] OTP Response:', JSON.stringify(data, null, 2));

    if (data.code === 200 && data.data) {
      // Store session for verification
      const sessionId = crypto.randomUUID();
      verificationSessions.set(sessionId, {
        referenceId: data.data.reference_id,
        aadhaar: cleanAadhaar,
        createdAt: Date.now(),
        transactionId: data.transaction_id,
      });

      res.json({
        success: true,
        sessionId,
        referenceId: data.data.reference_id,
        message: data.data.message || 'OTP sent to registered mobile number',
        transactionId: data.transaction_id,
      });
    } else {
      // Handle specific error codes
      let errorMessage = 'Failed to send OTP';

      if (data.code === 422) {
        errorMessage = 'Invalid Aadhaar number or service temporarily unavailable';
      } else if (data.code === 429) {
        errorMessage = 'Too many requests. Please try again later';
      } else if (data.message) {
        errorMessage = data.message;
      }

      res.status(data.code || 400).json({
        success: false,
        error: errorMessage,
        code: data.code,
      });
    }
  } catch (error) {
    console.error('[Aadhaar] OTP request error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to request OTP',
    });
  }
});

/**
 * Verify OTP and get Aadhaar data
 * POST /api/aadhaar/verify-otp
 *
 * Request Body:
 * {
 *   "sessionId": "uuid",
 *   "otp": "123456"
 * }
 *
 * OR (legacy support):
 * {
 *   "aadhaarNumber": "123456789012",
 *   "otp": "123456",
 *   "referenceId": "1234567"
 * }
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { sessionId, otp, aadhaarNumber, referenceId } = req.body;

    // Validate OTP format
    if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP. Must be 6 digits.',
      });
    }

    // Get reference ID either from session or direct parameter
    let refId = referenceId;
    let session = null;

    if (sessionId) {
      session = verificationSessions.get(sessionId);
      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Session expired or invalid. Please request a new OTP.',
        });
      }

      // Check session expiry (10 minutes)
      if (Date.now() - session.createdAt > 10 * 60 * 1000) {
        verificationSessions.delete(sessionId);
        return res.status(400).json({
          success: false,
          error: 'Session expired. Please request a new OTP.',
        });
      }

      refId = session.referenceId;
    }

    if (!refId) {
      return res.status(400).json({
        success: false,
        error: 'Reference ID is required',
      });
    }

    // Check if API is configured
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Aadhaar API not configured',
        setupRequired: true,
      });
    }

    // Get access token
    const token = await getAccessToken();
    const config = getConfig();

    // Call Sandbox OKYC Verify OTP API
    const response = await fetch(`${config.baseUrl}/kyc/aadhaar/okyc/otp/verify`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'x-api-version': config.apiVersion,
      },
      body: JSON.stringify({
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
        'reference_id': refId.toString(),
        'otp': otp,
      }),
    });

    const data = await response.json();
    console.log('[Aadhaar] Verify Response:', JSON.stringify(data, null, 2));

    if (data.code === 200 && data.data && data.data.status === 'VALID') {
      const aadhaarData = data.data;

      // Clean up session
      if (sessionId) {
        verificationSessions.delete(sessionId);
      }

      // Format response
      const verifiedData = {
        uid: maskAadhaar(session?.aadhaar || aadhaarNumber || ''),
        name: aadhaarData.name,
        gender: aadhaarData.gender === 'M' ? 'Male' : aadhaarData.gender === 'F' ? 'Female' : 'Other',
        dob: aadhaarData.date_of_birth,
        yearOfBirth: aadhaarData.year_of_birth,
        careOf: aadhaarData.care_of,
        address: {
          full: aadhaarData.full_address,
          house: aadhaarData.address?.house || '',
          street: aadhaarData.address?.street || '',
          landmark: aadhaarData.address?.landmark || '',
          locality: aadhaarData.address?.vtc || '',
          district: aadhaarData.address?.district || '',
          state: aadhaarData.address?.state || '',
          pincode: aadhaarData.address?.pincode || '',
          country: aadhaarData.address?.country || 'India',
          postOffice: aadhaarData.address?.post_office || '',
        },
        photo: aadhaarData.photo, // Base64 encoded photo
        emailHash: aadhaarData.email_hash,
        mobileHash: aadhaarData.mobile_hash,
        shareCode: aadhaarData.share_code,
        verifiedAt: new Date().toISOString(),
        transactionId: data.transaction_id,
        referenceId: aadhaarData.reference_id,
      };

      res.json({
        success: true,
        message: 'Aadhaar verified successfully',
        data: verifiedData,
      });
    } else {
      // Handle specific error codes
      let errorMessage = 'Verification failed';

      if (data.code === 422) {
        errorMessage = 'Invalid OTP. Please check and try again.';
      } else if (data.code === 400) {
        errorMessage = 'OTP expired. Please request a new OTP.';
      } else if (data.message) {
        errorMessage = data.message;
      }

      res.status(data.code || 400).json({
        success: false,
        error: errorMessage,
        code: data.code,
      });
    }
  } catch (error) {
    console.error('[Aadhaar] OTP verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Verification failed',
    });
  }
});

/**
 * Get verification status for a user
 * GET /api/aadhaar/status/:userId
 */
router.get('/status/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    // In production, fetch from database
    const status = verificationSessions.get(`status_${userId}`);

    if (status) {
      res.json({
        success: true,
        verified: true,
        verifiedAt: status.verifiedAt,
        maskedAadhaar: status.maskedAadhaar,
        name: status.name,
      });
    } else {
      res.json({
        success: true,
        verified: false,
      });
    }
  } catch (error) {
    console.error('[Aadhaar] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check status',
    });
  }
});

/**
 * Store verification status for a user
 * POST /api/aadhaar/status
 */
router.post('/status', (req, res) => {
  try {
    const { userId, maskedAadhaar, verifiedAt, name } = req.body;

    // In production, store in database
    verificationSessions.set(`status_${userId}`, {
      maskedAadhaar,
      verifiedAt,
      name,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Verification status saved',
    });
  } catch (error) {
    console.error('[Aadhaar] Status save error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save status',
    });
  }
});

/**
 * Unlink Aadhaar for a user
 * DELETE /api/aadhaar/unlink/:userId
 */
router.delete('/unlink/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    // In production, update database
    verificationSessions.delete(`status_${userId}`);

    res.json({
      success: true,
      message: 'Aadhaar unlinked successfully',
    });
  } catch (error) {
    console.error('[Aadhaar] Unlink error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink Aadhaar',
    });
  }
});

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  const expiryTime = 10 * 60 * 1000; // 10 minutes

  for (const [key, data] of verificationSessions.entries()) {
    if (data.createdAt && now - data.createdAt > expiryTime) {
      verificationSessions.delete(key);
    }
  }
}, 60 * 1000); // Run every minute

export default router;
