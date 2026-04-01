/**
 * Payment Gateway Service
 * Connects to backend server which communicates with Cashfree
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

const USE_MOCK_PAYMENTS = false;

function normalizeUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

function getExpoHostPaymentBaseUrl(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost;

  if (!hostUri || typeof hostUri !== "string") return null;

  const host = hostUri.split(":")[0];
  if (!host) return null;

  return `http://${host}:3001/api/payment`;
}

function resolvePaymentBaseUrl(): string {
  const configuredUrl = normalizeUrl(process.env.EXPO_PUBLIC_PAYMENT_BASE_URL);
  if (configuredUrl) return configuredUrl;

  const expoHostUrl = normalizeUrl(getExpoHostPaymentBaseUrl());
  if (expoHostUrl) return expoHostUrl;

  if (Platform.OS === "android") return "http://10.0.2.2:3001/api/payment";
  return "http://localhost:3001/api/payment";
}

const API_BASE_URL = resolvePaymentBaseUrl();
const PAYMENT_WEBHOOK_SECRET = process.env.EXPO_PUBLIC_PAYMENT_WEBHOOK_SECRET;

export interface PaymentOrder {
  orderId: string;
  amount: number;
  recipient: string;
  contactName?: string;
  note?: string;
  merchantId: string;
  timestamp: string; // ISO string for navigation serialization
  paymentSessionId?: string;
  orderToken?: string;
  paymentUrl?: string;
  isMock?: boolean;
}

export interface PaymentResult {
  success: boolean;
  referenceId: string;
  orderId: string;
  amount: number;
  recipient: string;
  timestamp: string; // ISO string
  status: "SUCCESS" | "FAILED" | "PENDING";
  failureReason?: string;
}

export function isValidUpiId(value: string): boolean {
  return /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i.test(value.trim());
}

export function buildUpiPaymentUrl(order: PaymentOrder): string {
  const params = new URLSearchParams({
    pa: order.recipient.trim(),
    pn: order.contactName?.trim() || order.recipient.trim(),
    am: order.amount.toFixed(2),
    cu: "INR",
  });

  if (order.note?.trim()) {
    params.set("tn", order.note.trim());
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Create a mock payment order for testing without backend
 */
function createMockPaymentOrder(
  amount: number,
  recipient: string,
  note?: string,
): PaymentOrder {
  const orderId = `MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  console.log("🎭 Creating MOCK payment order:", {
    orderId,
    amount,
    recipient,
  });

  return {
    orderId,
    amount,
    recipient,
    note,
    merchantId: "MOCK_MERCHANT",
    timestamp: new Date().toISOString(),
    paymentSessionId: `session_${orderId}`,
    orderToken: `token_${orderId}`,
    isMock: true,
  };
}

/**
 * Initialize a backend-tracked payment order before handing off to UPI.
 */
export async function createPaymentOrder(
  amount: number,
  recipient: string,
  note?: string,
  customerPhone: string = "9999999999", // Reserved for future gateway use
  customerName: string = "User", // Reserved for future gateway use
): Promise<PaymentOrder> {
  // Use mock payments if enabled (for testing without backend)
  if (USE_MOCK_PAYMENTS) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return createMockPaymentOrder(amount, recipient, note);
  }

  try {
    console.log("🔄 Creating payment order:", {
      amount,
      recipient,
      customerPhone,
      customerName,
    });

    const response = await fetch(`${API_BASE_URL}/payments/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true", // Skip ngrok warning page
      },
      body: JSON.stringify({
        amount,
        upiId: recipient,
        note,
        customerPhone,
        customerName,
      }),
    });

    console.log("📡 Response status:", response.status);

    // Handle non-JSON responses (like ngrok error pages)
    const text = await response.text();
    console.log("📦 Response text:", text.substring(0, 200));

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error(
        "❌ Failed to parse response as JSON:",
        text.substring(0, 500),
      );
      throw new Error(
        `Server returned non-JSON response: ${text.substring(0, 100)}`,
      );
    }

    console.log("📦 Response data:", data);

    if (!data.success) {
      const errorMsg = data.message || "Failed to create payment order";
      console.error("❌ Backend error:", errorMsg, data);
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
      isMock: false,
    };
  } catch (error) {
    console.error("❌ Create Payment Order Error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
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
  upiApp: "gpay" | "phonepe" | "paytm" | "other",
): Promise<PaymentResult> {
  // Simulate payment processing time
  await new Promise((resolve) => setTimeout(resolve, 2000));

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
    status: isSuccess ? "SUCCESS" : "FAILED",
    failureReason: isSuccess ? undefined : "Transaction declined by bank",
  };
}

/**
 * Verify payment status from backend
 * Queries the backend payment store, updated by webhook events.
 */
export async function verifyPaymentStatus(
  orderId: string,
): Promise<PaymentResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/payments/status/${orderId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to verify payment");
    }

    return {
      success: data.status === "SUCCESS",
      referenceId: data.referenceId,
      orderId: data.orderId,
      amount: data.amount,
      recipient: data.recipient || "",
      timestamp: data.timestamp,
      status: data.status,
      failureReason: data.failureReason,
    };
  } catch (error) {
    console.error("Verify Payment Error:", error);
    throw error;
  }
}

export async function triggerDemoPaymentConfirmation(
  orderId: string,
  status: "SUCCESS" | "FAILED",
): Promise<PaymentResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (PAYMENT_WEBHOOK_SECRET) {
    headers["x-payment-webhook-secret"] = PAYMENT_WEBHOOK_SECRET;
  }

  const response = await fetch(`${API_BASE_URL}/payments/test-confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      orderId,
      status,
      failureReason: status === "FAILED" ? "Demo payment failed" : undefined,
    }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "Failed to trigger demo payment update");
  }

  return {
    success: data.status === "SUCCESS",
    referenceId: data.referenceId,
    orderId: data.orderId,
    amount: data.amount,
    recipient: data.recipient || "",
    timestamp: data.timestamp,
    status: data.status,
    failureReason: data.failureReason,
  };
}

/**
 * Get payment gateway redirect URL
 * Returns the URL to open in WebView or external browser
 */
export function getPaymentGatewayUrl(order: PaymentOrder): string {
  return (
    order.paymentUrl || `https://payments.cashfree.com/order/${order.orderId}`
  );
}
