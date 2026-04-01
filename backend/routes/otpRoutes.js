/**
 * OTP Routes
 * Routes for sending and verifying OTP using Fast2SMS
 */

const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../services/fast2smsOtpService');

/**
 * @route   POST /api/otp/send
 * @desc    Send OTP to phone number
 * @access  Public
 * @body    { phoneNumber: string }
 */
router.post('/send', async (req, res) => {
  try {
    const { phoneNumber, identifier } = req.body;
    
    // Use either phoneNumber or identifier
    const phone = phoneNumber || identifier;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    const result = await sendOTP(phone);

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.providerStatus || 400).json(result);
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending OTP',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP code
 * @access  Public
 * @body    { phoneNumber: string, code: string }
 */
router.post('/verify', async (req, res) => {
  try {
    const { phoneNumber, code, identifier } = req.body;
    
    // Use either phoneNumber or identifier
    const phone = phoneNumber || identifier;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP code are required',
      });
    }

    const result = await verifyOTP(phone, code);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying OTP',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/otp/resend
 * @desc    Resend OTP to phone number
 * @access  Public
 * @body    { phoneNumber: string }
 */
router.post('/resend', async (req, res) => {
  try {
    const { phoneNumber, identifier } = req.body;
    
    // Use either phoneNumber or identifier
    const phone = phoneNumber || identifier;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    const result = await sendOTP(phone);

    if (result.success) {
      res.json({
        ...result,
        message: 'OTP resent successfully',
      });
    } else {
      res.status(result.providerStatus || 400).json(result);
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resending OTP',
      error: error.message,
    });
  }
});

module.exports = router;
