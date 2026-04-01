/**
 * Payment Gateway Integration - Cashfree API
 * 
 * This module handles payment order creation and verification with Cashfree
 */

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Helper function to get Cashfree config at runtime
function getCashfreeConfig() {
  return {
    baseUrl: process.env.CASHFREE_ENV === 'production' 
      ? 'https://api.cashfree.com/pg' 
      : 'https://sandbox.cashfree.com/pg',
    appId: process.env.CASHFREE_APP_ID,
    secretKey: process.env.CASHFREE_SECRET_KEY
  };
}

/**
 * Generate signature for Cashfree API authentication
 */
function generateSignature(orderId, orderAmount, orderCurrency = 'INR') {
  const { secretKey } = getCashfreeConfig();
  const data = `${orderId}${orderAmount}${orderCurrency}`;
  return crypto
    .createHmac('sha256', secretKey)
    .update(data)
    .digest('base64');
}

/**
 * POST /api/payment/create-order
 * Create a payment order with Cashfree using Payment Links API
 * This generates a hosted payment page URL that works reliably
 * 
 * Request Body:
 * {
 *   amount: number,
 *   recipient: string,
 *   note?: string,
 *   customerPhone: string,
 *   customerName: string
 * }
 */
router.post('/create-order', async (req, res) => {
  try {
    const { amount, recipient, note, customerPhone, customerName } = req.body;
    const { baseUrl, appId, secretKey } = getCashfreeConfig();

    // Log for debugging
    console.log('📝 Payment order request:', { amount, recipient, customerPhone, customerName });
    console.log('🔑 Cashfree Config:', { 
      env: process.env.CASHFREE_ENV,
      appId: appId ? 'Set ✅' : 'Missing ❌',
      secretKey: secretKey ? 'Set ✅' : 'Missing ❌',
      baseUrl: baseUrl
    });

    // Validate Cashfree credentials
    if (!appId || !secretKey) {
      return res.status(500).json({
        success: false,
        message: 'Cashfree credentials not configured. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in .env file'
      });
    }

    // Validate required fields
    if (!amount || !recipient || !customerPhone || !customerName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, recipient, customerPhone, customerName'
      });
    }

    // Generate unique link ID
    const linkId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Use Payment Links API - generates a hosted checkout page
    const isSandbox = baseUrl.includes('sandbox');
    const linksUrl = isSandbox 
      ? 'https://sandbox.cashfree.com/pg/links'
      : 'https://api.cashfree.com/pg/links';

    // Prepare Payment Link payload
    const linkData = {
      link_id: linkId,
      link_amount: parseFloat(amount),
      link_currency: 'INR',
      link_purpose: note || `Payment to ${recipient}`,
      customer_details: {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: `${customerPhone}@securepayflow.app`
      },
      link_notify: {
        send_sms: false,
        send_email: false
      },
      link_meta: {
        upi_intent: true
      },
      link_notes: {
        recipient: recipient,
        app: 'SecurePayFlow'
      },
      link_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };

    console.log('📤 Calling Cashfree Payment Links API:', linksUrl);

    // Call Cashfree Payment Links API
    const response = await fetch(linksUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01'
      },
      body: JSON.stringify(linkData)
    });

    const result = await response.json();

    console.log('📥 Cashfree Response:', { status: response.status, result });

    if (!response.ok) {
      console.error('❌ Cashfree API Error:', result);
      return res.status(response.status).json({
        success: false,
        message: 'Failed to create payment link',
        error: result
      });
    }

    // Get the payment URL directly from Cashfree
    const paymentUrl = result.link_url;

    console.log('🔗 Payment URL:', paymentUrl);
    console.log('📋 Link ID:', linkId);
    console.log('📊 Link Status:', result.link_status);

    // Return order details to client
    res.json({
      success: true,
      orderId: linkId,
      cfOrderId: result.cf_link_id,
      amount: amount,
      recipient: recipient,
      note: note,
      merchantId: appId,
      timestamp: new Date().toISOString(),
      orderStatus: result.link_status,
      paymentUrl: paymentUrl
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/payment/callback
 * Callback endpoint - Cashfree redirects here after payment
 * Shows a success/failure page to the user
 */
router.get('/callback', async (req, res) => {
  try {
    const { link_id, cf_link_id, status } = req.query;
    
    console.log('📥 Payment Callback:', { link_id, cf_link_id, status });
    
    // Check payment status from Cashfree
    const { baseUrl, appId, secretKey } = getCashfreeConfig();
    const isSandbox = baseUrl.includes('sandbox');
    const statusUrl = isSandbox 
      ? `https://sandbox.cashfree.com/pg/links/${link_id}`
      : `https://api.cashfree.com/pg/links/${link_id}`;
    
    let paymentStatus = 'PENDING';
    let linkDetails = null;
    
    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01'
        }
      });
      linkDetails = await response.json();
      paymentStatus = linkDetails.link_status || 'UNKNOWN';
      console.log('📊 Link Status:', linkDetails);
    } catch (err) {
      console.error('Error fetching link status:', err);
    }
    
    const isSuccess = paymentStatus === 'PAID';
    
    // Return a nice HTML page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment ${isSuccess ? 'Successful' : 'Status'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, ${isSuccess ? '#10B981' : '#6366F1'} 0%, ${isSuccess ? '#059669' : '#4F46E5'} 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .card {
            background: white;
            border-radius: 24px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }
          .icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: ${isSuccess ? '#10B981' : '#F59E0B'}20;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-size: 40px;
          }
          h1 {
            color: #1F2937;
            font-size: 24px;
            margin-bottom: 8px;
          }
          p {
            color: #6B7280;
            margin-bottom: 24px;
          }
          .status {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 14px;
            background: ${isSuccess ? '#10B981' : '#F59E0B'}20;
            color: ${isSuccess ? '#059669' : '#D97706'};
            margin-bottom: 24px;
          }
          .details {
            background: #F9FAFB;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: left;
          }
          .details-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #E5E7EB;
          }
          .details-row:last-child { border-bottom: none; }
          .details-label { color: #6B7280; font-size: 14px; }
          .details-value { color: #1F2937; font-weight: 500; font-size: 14px; }
          .btn {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #6366F1, #4F46E5);
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            transition: transform 0.2s;
          }
          .btn:hover { transform: scale(1.02); }
          .note {
            margin-top: 20px;
            font-size: 12px;
            color: #9CA3AF;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">${isSuccess ? '✅' : '⏳'}</div>
          <h1>${isSuccess ? 'Payment Successful!' : 'Payment ' + paymentStatus}</h1>
          <p>${isSuccess ? 'Your transaction has been completed.' : 'Please check your payment status.'}</p>
          <div class="status">${paymentStatus}</div>
          <div class="details">
            <div class="details-row">
              <span class="details-label">Reference ID</span>
              <span class="details-value">${link_id || 'N/A'}</span>
            </div>
            ${linkDetails?.link_amount ? `
            <div class="details-row">
              <span class="details-label">Amount</span>
              <span class="details-value">₹${linkDetails.link_amount}</span>
            </div>` : ''}
          </div>
          <a href="securepayflow://callback?status=${paymentStatus}&link_id=${link_id}" class="btn">
            Return to App
          </a>
          <p class="note">You can close this window and return to the app.</p>
        </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Callback Error:', error);
    res.status(500).send(`
      <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>❌ Error</h1>
        <p>Something went wrong. Please return to the app.</p>
        <a href="securepayflow://callback?status=ERROR">Return to App</a>
      </body>
      </html>
    `);
  }
});

/**
 * POST /api/payment/webhook
 * Webhook endpoint to receive payment status updates from Cashfree
 * 
 * Cashfree will POST to this endpoint when payment status changes
 */
router.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    const { secretKey } = getCashfreeConfig();

    console.log('Payment Webhook Received:', webhookData);

    // Verify webhook signature (important for security)
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    
    if (signature && timestamp) {
      const computedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(`${timestamp}${JSON.stringify(webhookData)}`)
        .digest('base64');
      
      if (signature !== computedSignature) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    // Extract payment details
    const {
      order_id,
      order_amount,
      order_status,
      payment_time,
      cf_payment_id, // Reference ID from Cashfree
      payment_method,
      payment_group // UPI
    } = webhookData.data || webhookData;

    // TODO: Update your database with payment status
    // Example: await db.updatePaymentStatus(order_id, order_status, cf_payment_id);

    console.log(`Payment ${order_id}: ${order_status}`);

    // Send success response to Cashfree
    res.json({ success: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payment/verify/:orderId
 * Verify payment status by querying Cashfree API
 */
router.get('/verify/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { baseUrl, appId, secretKey } = getCashfreeConfig();

    // Query Cashfree API for order status
    const response = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01'
      }
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: 'Failed to verify payment',
        error: result
      });
    }

    // Map Cashfree status to our app status
    const statusMap = {
      'PAID': 'SUCCESS',
      'ACTIVE': 'PENDING',
      'EXPIRED': 'FAILED',
      'CANCELLED': 'FAILED',
      'FAILED': 'FAILED'
    };

    res.json({
      success: true,
      orderId: result.order_id,
      amount: result.order_amount,
      status: statusMap[result.order_status] || 'PENDING',
      referenceId: result.cf_order_id,
      paymentMethod: result.payment_method,
      timestamp: result.payment_completion_time || result.created_at
    });

  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * POST /api/payment/process-upi
 * Process UPI payment (alternative flow if using SDK)
 */
router.post('/process-upi', async (req, res) => {
  try {
    const { orderId, upiId, upiApp } = req.body;

    // In real implementation, this would:
    // 1. Validate the order exists and is not already paid
    // 2. Initiate UPI collect request via Cashfree
    // 3. Return payment link or deep link to UPI app

    // For now, return a mock response
    res.json({
      success: true,
      message: 'UPI payment initiated',
      orderId: orderId,
      upiLink: `upi://pay?pa=${upiId}&pn=SecurePayFlow&am=${100}&cu=INR&tn=Payment`
    });

  } catch (error) {
    console.error('Process UPI Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// 🔥 NEW: Simple /api/payment/send endpoint for offline queue
// ============================================================

// Temporary in-memory idempotency store
// (Replace with Redis / DB later)
const idempotencyStore = new Map();

/**
 * POST /api/payment/send
 * Simple payment endpoint for queued transactions
 * Supports idempotency to prevent duplicate payments
 */
router.post("/send", async (req, res) => {
  try {
    const { amount, recipient, note, contactName } = req.body;
    const idempotencyKey = req.header("Idempotency-Key") || crypto.randomUUID();

    if (!amount || !recipient) {
      return res.status(400).json({ error: "Missing amount or recipient" });
    }

    // ---- Check idempotency ----
    if (idempotencyStore.has(idempotencyKey)) {
      console.log("⚠️ Duplicate send prevented:", idempotencyKey);
      return res.json(idempotencyStore.get(idempotencyKey));
    }

    // ---- Simulate payment success ----
    const response = {
      ok: true,
      txId: "tx-" + Date.now(),
      amount,
      recipient,
      contactName: contactName || "",
      note: note || "",
      status: "success",
      timestamp: new Date().toISOString()
    };

    // Save result for idempotency
    idempotencyStore.set(idempotencyKey, response);

    console.log("💸 Payment processed:", response);

    return res.json(response);

  } catch (err) {
    console.error("❌ /api/payment/send error:", err);
    return res.status(500).json({ error: "Payment failed" });
  }
});

export default router;