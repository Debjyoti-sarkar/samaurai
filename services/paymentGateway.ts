/**
 * Payment Gateway Service
 * Connects to backend server which communicates with Cashfree
 */

import { Platform } from 'react-native';

// Backend server URL - using local IP for development
// For testing without payment backend, use mock mode
const USE_MOCK_PAYMENTS = true; // Set to false when payment backend is running

const API_BASE_URL = Platform.select({
  android: 'http://172.16.20.46:3000/api/payment',
  ios: 'http://172.16.20.46:3000/api/payment',
  default: 'http://localhost:3000/api/payment'
});

export interface PaymentOrder {
  orderId: string;
  amount: number;
  recipient: string;
  note?: string;
  merchantId: string;
  timestamp: string; // ISO string for navigation serialization
  paymentSessionId?: string;
  orderToken?: string;
  paymentUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  referenceId: string;
  orderId: string;
  amount: number;
  recipient: string;
  timestamp: string; // ISO string
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  failureReason?: string;
}

/**
 * Create a mock payment order for testing without backend
 */
function createMockPaymentOrder(
  amount: number,
  recipient: string,
  note?: string
): PaymentOrder {
  const orderId = `MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  console.log('🎭 Creating MOCK payment order:', { orderId, amount, recipient });

  return {
    orderId,
    amount,
    recipient,
    note,
    merchantId: 'MOCK_MERCHANT',
    timestamp: new Date().toISOString(),
    paymentSessionId: `session_${orderId}`,
    orderToken: `token_${orderId}`,
    paymentUrl: `https://mock-payment.example.com/${orderId}`,
  };
}

/**
 * Initialize payment order with gateway via backend
 * Calls your backend server which then calls Cashfree API
 */
export async function createPaymentOrder(
  amount: number,
  recipient: string,
  note?: string,
  customerPhone: string = '9999999999', // Get from user's profile
  customerName: string = 'User' // Get from user's profile
): Promise<PaymentOrder> {
  // Use mock payments if enabled (for testing without backend)
  if (USE_MOCK_PAYMENTS) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return createMockPaymentOrder(amount, recipient, note);
  }

  try {
    console.log('🔄 Creating payment order:', { amount, recipient, customerPhone, customerName });

    const response = await fetch(`${API_BASE_URL}/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
      },
      body: JSON.stringify({
        amount,
        recipient,
        note,
        customerPhone,
        customerName,
      }),
    });

    console.log('📡 Response status:', response.status);

    // Handle non-JSON responses (like ngrok error pages)
    const text = await response.text();
    console.log('📦 Response text:', text.substring(0, 200));

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', text.substring(0, 500));
      throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
    }

    console.log('📦 Response data:', data);

    if (!data.success) {
      const errorMsg = data.message || 'Failed to create payment order';
      console.error('❌ Backend error:', errorMsg, data);
      throw new Error(errorMsg);
    }

    return {
      orderId: data.orderId,
      amount: data.amount,
      recipient: data.recipient,
      note: data.note,
      merchantId: data.merchantId,
      timestamp: data.timestamp, // Keep as ISO string
      paymentSessionId: data.paymentSessionId,
      orderToken: data.orderToken,
      paymentUrl: data.paymentUrl,
    };
  } catch (error) {
    console.error('❌ Create Payment Order Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Simulate UPI payment flow
 * In production, this would redirect to the actual payment gateway
 */
export async function processUPIPayment(
  order: PaymentOrder,
  upiApp: 'gpay' | 'phonepe' | 'paytm' | 'other'
): Promise<PaymentResult> {
  // Simulate payment processing time
  await new Promise(resolve => setTimeout(resolve, 2000));

  // In simulator/testing mode, we randomly succeed/fail
  // In production, this would be handled by the actual payment gateway
  const isSuccess = Math.random() > 0.1; // 90% success rate for testing

  const referenceId = `REF${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  return {
    success: isSuccess,
    referenceId,
    orderId: order.orderId,
    amount: order.amount,
    recipient: order.recipient,
    timestamp: new Date().toISOString(),
    status: isSuccess ? 'SUCCESS' : 'FAILED',
    failureReason: isSuccess ? undefined : 'Transaction declined by bank',
  };
}

/**
 * Verify payment status from backend
 * Queries your backend which checks Cashfree API
 */
export async function verifyPaymentStatus(orderId: string): Promise<PaymentResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/verify/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to verify payment');
    }

    return {
      success: data.status === 'SUCCESS',
      referenceId: data.referenceId,
      orderId: data.orderId,
      amount: data.amount,
      recipient: '', // Not returned from verify endpoint
      timestamp: data.timestamp,
      status: data.status,
    };
  } catch (error) {
    console.error('Verify Payment Error:', error);
    throw error;
  }
}

/**
 * Get payment gateway redirect URL
 * Returns the URL to open in WebView or external browser
 */
export function getPaymentGatewayUrl(order: PaymentOrder): string {
  return order.paymentUrl || `https://payments.cashfree.com/order/${order.orderId}`;
}
