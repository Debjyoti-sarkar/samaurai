# Backend Setup Guide - Confirmed UPI Payments

This backend now uses:
- MongoDB-backed payment orders
- backend status polling from the app
- webhook-driven payment confirmation
- optional demo/test confirmation for local hackathon use

## Prerequisites

1. Node.js 18+
2. MongoDB running locally or remotely
3. Optional PSP webhook source for production confirmation

## 1. Configure Environment

Create `.env` from `.env.example`:

```bash
cd server
copy .env.example .env
```

Recommended values:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/kavach

PAYMENT_WEBHOOK_SECRET=change-me
ALLOW_PAYMENT_TEST_CONFIRM=true

DEEPGRAM_API_KEY=your_key_here
```

Optional older Cashfree fields can remain if you still use those routes:

```env
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
```

## 2. Start MongoDB and Backend

Start MongoDB, then:

```bash
cd server
npm run start
```

The server should connect to MongoDB and start on port `3001`.

## 3. Backend Endpoints

Create order:

```http
POST /api/payment/payments/create
```

Body:

```json
{
  "amount": 100,
  "upiId": "test@upi",
  "note": "Demo payment"
}
```

Check status:

```http
GET /api/payment/payments/status/:orderId
```

Real webhook:

```http
POST /api/payment/payments/webhook
Header: x-payment-webhook-secret: <PAYMENT_WEBHOOK_SECRET>
```

Demo/test confirmation:

```http
POST /api/payment/payments/test-confirm
Header: x-payment-webhook-secret: <PAYMENT_WEBHOOK_SECRET>
```

The demo/test-confirm route only works when:

```env
ALLOW_PAYMENT_TEST_CONFIRM=true
```

## 4. Local Test Flow

1. Start backend.
2. Start Expo app.
3. Create a send-money request in the app.
4. Open UPI app from `PaymentProcessingScreen`.
5. Confirm the order either:
   - through your real webhook source, or
   - with the demo/test-confirm flow
6. Let the app poll backend status every 3 seconds until it becomes `SUCCESS` or `FAILED`.

## 5. Demo Confirmation Options

From terminal:

```bash
cd server
npm run payment:test-confirm -- UPI_ORDER_ID SUCCESS
```

Or:

```bash
cd server
npm run payment:test-confirm -- UPI_ORDER_ID FAILED
```

From the app:

Set these Expo env vars for demo controls:

```env
EXPO_PUBLIC_ENABLE_PAYMENT_DEMO=true
EXPO_PUBLIC_PAYMENT_WEBHOOK_SECRET=change-me
```

This enables `Demo Success` and `Demo Fail` buttons on the waiting screen. Those buttons do not mark success locally. They call the backend demo endpoint, and the app still waits for backend status polling.

## 6. Example Webhook Payload

```json
{
  "orderId": "UPI_1234567890_ABCD1234",
  "status": "SUCCESS",
  "referenceId": "PSP_REF_123456"
}
```

For failure:

```json
{
  "orderId": "UPI_1234567890_ABCD1234",
  "status": "FAILED",
  "failureReason": "Payment declined"
}
```

## 7. Troubleshooting

If orders do not persist:
- check `MONGODB_URI`
- confirm MongoDB is running

If webhook calls are rejected:
- verify `x-payment-webhook-secret`
- verify `PAYMENT_WEBHOOK_SECRET` matches

If demo buttons do not work:
- set `ALLOW_PAYMENT_TEST_CONFIRM=true` in the backend
- set `EXPO_PUBLIC_ENABLE_PAYMENT_DEMO=true` in the app
- set matching webhook secret values in backend and Expo env

If the app stays stuck on waiting:
- inspect `/api/payment/payments/status/:orderId`
- check backend logs for webhook/test-confirm updates

## 8. Production Notes

- Keep `PAYMENT_WEBHOOK_SECRET` server-only in production.
- Disable `ALLOW_PAYMENT_TEST_CONFIRM` in production.
- Remove or disable demo UI by leaving `EXPO_PUBLIC_ENABLE_PAYMENT_DEMO` unset.
- Use your PSP to call `/api/payment/payments/webhook` after real payment completion.
