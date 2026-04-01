/**
 * Aadhaar Verification Routes
 * Routes for Aadhaar OTP generation and verification
 */

const express = require('express');
const router = express.Router();
const {
  generateAadhaarOTP,
  verifyAadhaarOTP,
  verifyAadhaarOffline,
} = require('../services/aadhaarVerificationService');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/aadhaar/generate-otp
 * @desc    Generate OTP for Aadhaar verification
 * @access  Public
 * @body    { aadhaarNumber: string }
 */
router.post('/generate-otp', async (req, res) => {
  try {
    const { aadhaarNumber, aadhaar_number } = req.body;
    
    // Accept both formats
    const aadhaar = aadhaarNumber || aadhaar_number;

    if (!aadhaar) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar number is required',
      });
    }

    // Remove any spaces or dashes
    const cleanAadhaar = aadhaar.toString().replace(/[\s-]/g, '');

    if (cleanAadhaar.length !== 12 || !/^\d{12}$/.test(cleanAadhaar)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Aadhaar number. Must be 12 digits.',
      });
    }

    const result = await generateAadhaarOTP(cleanAadhaar);

    if (result.success) {
      // Store client_id in session or return to client for next step
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Aadhaar OTP Generation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating OTP',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/aadhaar/verify-otp
 * @desc    Verify Aadhaar OTP and get details
 * @access  Public
 * @body    { client_id: string, otp: string }
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { client_id, clientId, otp } = req.body;
    
    // Accept both formats
    const id = client_id || clientId;

    if (!id || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Client ID and OTP are required',
      });
    }

    const cleanOTP = otp.toString().replace(/\s/g, '');

    if (cleanOTP.length !== 6 || !/^\d{6}$/.test(cleanOTP)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Must be 6 digits.',
      });
    }

    const result = await verifyAadhaarOTP(id, cleanOTP);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Aadhaar OTP Verification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying OTP',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/aadhaar/verify-offline
 * @desc    Verify Aadhaar using offline XML
 * @access  Public
 * @body    { xmlData: Object }
 */
router.post('/verify-offline', async (req, res) => {
  try {
    const { xmlData, xml_data } = req.body;
    
    const data = xmlData || xml_data;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'XML data is required',
      });
    }

    const result = await verifyAadhaarOffline(data);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Aadhaar Offline Verification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying Aadhaar XML',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/aadhaar/test
 * @desc    Test Aadhaar API credentials
 * @access  Public
 */
router.get('/test', async (req, res) => {
  try {
    const apiKey = process.env.AADHAAR_API_KEY;
    const apiSecret = process.env.AADHAAR_API_SECRET;

    res.json({
      success: true,
      message: 'Aadhaar API configuration check',
      configured: !!(apiKey && apiSecret),
      api_key_set: !!apiKey,
      api_secret_set: !!apiSecret,
      base_url: process.env.AADHAAR_API_BASE_URL || 'https://kyc-api.surepass.io/api/v1',
    });
  } catch (error) {
    console.error('Aadhaar Test Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

module.exports = router;
