// server/kyc.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_BASE = process.env.API_BASE || 'https://api.sandbox.co.in';
const API_KEY = process.env.SANDBOX_API_KEY;
const API_SECRET = process.env.SANDBOX_API_SECRET;

// Replace AUTH_PATH with the provider's authenticate path e.g. /auth/token
const AUTH_PATH = process.env.AUTH_PATH || '/authenticate';

let cachedJwt = null;
let jwtExpiry = 0;

async function getJwt() {
  // reuse cached jwt
  if (cachedJwt && Date.now() < jwtExpiry - 60 * 1000) return cachedJwt;

  try {
    const resp = await axios.post(`${API_BASE}${AUTH_PATH}`, {
      api_key: API_KEY,
      api_secret: API_SECRET
    }, { headers: { 'Content-Type': 'application/json' } });

    // Adjust these fields if the provider returns different names
    cachedJwt = resp.data.access_token || resp.data.token;
    const expiresIn = resp.data.expires_in || 3600;
    jwtExpiry = Date.now() + expiresIn * 1000;
    return cachedJwt;
  } catch (err) {
    console.error('Auth error', err.response?.data || err.message);
    throw new Error('Failed to authenticate with KYC provider');
  }
}

// POST /server/generate-otp
router.post('/generate-otp', async (req, res) => {
  try {
    const { aadhaar, reason } = req.body;
    if (!aadhaar || aadhaar.length !== 12) {
      return res.status(400).json({ error: 'Aadhaar must be 12 digits' });
    }

    const jwt = await getJwt();
    const body = {
      "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
      aadhaar_number: aadhaar,
      consent: "Y",
      reason: reason || "KYC"
    };

    const r = await axios.post(`${API_BASE}/kyc/aadhaar/okyc/otp`, body, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    // store reference_id on your DB or return to client (not the full aadhaar)
    return res.json(r.data);
  } catch (err) {
    console.error('generate-otp error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({ error: 'Failed to generate OTP', details: err.response?.data || err.message });
  }
});

// POST /server/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { reference_id, otp } = req.body;
    if (!reference_id || !otp) return res.status(400).json({ error: 'reference_id and otp required' });

    const jwt = await getJwt();
    const body = {
      "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
      reference_id,
      otp
    };

    const r = await axios.post(`${API_BASE}/kyc/aadhaar/okyc/otp/verify`, body, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return res.json(r.data);
  } catch (err) {
    console.error('verify-otp error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({ error: 'Failed to verify OTP', details: err.response?.data || err.message });
  }
});

module.exports = router;
