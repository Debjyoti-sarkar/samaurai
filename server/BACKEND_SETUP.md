# Backend Setup Guide - Cashfree Payment Gateway

Complete guide to set up the payment backend server with Cashfree integration.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Cashfree Account** - Sign up at https://www.cashfree.com/
3. **API Credentials** - Get from Cashfree Merchant Dashboard

---

## Step 1: Get Cashfree API Credentials

### 1.1 Create Cashfree Account
1. Go to https://www.cashfree.com/
2. Click "Sign Up" and complete registration
3. Verify your email and mobile number

### 1.2 Get Sandbox Credentials (for testing)
1. Login to Cashfree Merchant Dashboard
2. Navigate to **Developers** → **API Keys**
3. Copy your:
   - **App ID** (Client ID)
   - **Secret Key**
4. Keep these credentials safe!

### 1.3 Production Credentials (for live deployment)
1. Complete KYC verification in Cashfree dashboard
2. Submit business documents
3. Once approved, generate Production API keys
4. Use these only in production environment

---

## Step 2: Configure Environment Variables

### 2.1 Create .env file
```bash
cd server
cp .env.example .env
```

### 2.2 Update .env with your credentials
```env
# Server Configuration
PORT=3001
SERVER_BASE_URL=http://localhost:3001
APP_BASE_URL=securepayflow://

# Cashfree Payment Gateway Configuration
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=your_actual_app_id_here
CASHFREE_SECRET_KEY=your_actual_secret_key_here

# Other services (already configured)
GEMINI_API_KEY=your_gemini_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

**Important**: 
- Replace `your_actual_app_id_here` with your Cashfree App ID
- Replace `your_actual_secret_key_here` with your Cashfree Secret Key
- Keep `CASHFREE_ENV=sandbox` for testing
- Change to `CASHFREE_ENV=production` for live deployment

---

## Step 3: Install Dependencies

```bash
cd server
npm install
```

This will install the existing dependencies. No new packages needed!

---

## Step 4: Start the Backend Server

```bash
cd server
node index.js
```

You should see:
```
Server listening on 3001
```

---

## Step 5: Test the API Endpoints

### Test Payment Order Creation
```bash
curl -X POST http://localhost:3001/api/payment/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "recipient": "test@upi",
    "note": "Test payment",
    "customerPhone": "9999999999",
    "customerName": "Test User"
  }'
```

Expected response:
```json
{
  "success": true,
  "orderId": "ORD_1234567890_ABC123",
  "amount": 100,
  "recipient": "test@upi",
  "merchantId": "your_app_id",
  "paymentSessionId": "session_xxx",
  "orderToken": "token_xxx",
  "paymentUrl": "https://sandbox.cashfree.com/pg/pay/xxx"
}
```

### Test Payment Verification
```bash
curl http://localhost:3001/api/payment/verify/ORD_1234567890_ABC123
```

---

## Step 6: Webhook Setup (Important!)

### 6.1 For Local Testing - Use ngrok
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 6.2 Configure Webhook in Cashfree Dashboard
1. Go to Cashfree Dashboard → **Developers** → **Webhooks**
2. Click **Add Webhook**
3. Enter webhook URL: `https://abc123.ngrok.io/api/payment/webhook`
4. Select events:
   - `ORDER_PAID`
   - `PAYMENT_SUCCESS_WEBHOOK`
   - `PAYMENT_FAILED_WEBHOOK`
5. Save webhook

### 6.3 For Production
Use your actual server URL:
```
https://your-domain.com/api/payment/webhook
```

---

## Step 7: Update Mobile App Configuration

### 7.1 Update API URL
Edit `services/paymentGateway.ts`:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001/api/payment'  // For Android emulator, use 10.0.2.2:3001
  : 'https://your-production-api.com/api/payment';
```

**Note for Android Emulator**:
```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:3001/api/payment'  // Android emulator
  : 'https://your-production-api.com/api/payment';
```

### 7.2 For Physical Device Testing
If testing on a real phone connected to same WiFi:
```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://YOUR_COMPUTER_IP:3001/api/payment'  // e.g., http://192.168.1.100:3001
  : 'https://your-production-api.com/api/payment';
```

Find your IP:
- **Windows**: `ipconfig` (look for IPv4 Address)
- **Mac/Linux**: `ifconfig` or `ip addr`

---

## Step 8: Test Complete Payment Flow

1. **Start backend server**:
   ```bash
   cd server
   node index.js
   ```

2. **Start Expo app**:
   ```bash
   npx expo start
   ```

3. **Test payment flow**:
   - Open app
   - Go to Send Money
   - Enter amount and recipient
   - Click Confirm
   - Should create order via backend
   - Select UPI app in simulator
   - Choose success/failed

4. **Check backend logs**:
   - Should see API calls
   - Should see webhook notifications (if using ngrok)

---

## API Endpoints Reference

### POST `/api/payment/create-order`
Creates a payment order with Cashfree

**Request Body**:
```json
{
  "amount": 100,
  "recipient": "user@upi",
  "note": "Payment note",
  "customerPhone": "9999999999",
  "customerName": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "orderId": "ORD_xxx",
  "amount": 100,
  "paymentUrl": "https://..."
}
```

### GET `/api/payment/verify/:orderId`
Verifies payment status

**Response**:
```json
{
  "success": true,
  "orderId": "ORD_xxx",
  "status": "SUCCESS",
  "referenceId": "CF_xxx"
}
```

### POST `/api/payment/webhook`
Receives payment status updates from Cashfree (webhook)

---

## Production Deployment

### Option 1: Deploy to Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd server
railway up
```

### Option 2: Deploy to Render
1. Go to https://render.com
2. Create new Web Service
3. Connect your GitHub repo
4. Set environment variables
5. Deploy

### Option 3: Deploy to AWS/Azure/GCP
Use your preferred cloud provider and deploy as a Node.js app.

**Don't forget to**:
- Set environment variables
- Update webhook URL in Cashfree dashboard
- Update `API_BASE_URL` in mobile app
- Use `CASHFREE_ENV=production` for live payments

---

## Security Checklist

✅ Never commit `.env` file to git  
✅ Never expose API keys in client-side code  
✅ Always verify webhook signatures  
✅ Use HTTPS in production  
✅ Validate all inputs on server-side  
✅ Implement rate limiting  
✅ Log all transactions  
✅ Keep dependencies updated  
✅ Use environment variables for sensitive data  
✅ Implement proper error handling  

---

## Troubleshooting

### Issue: "Connection Refused"
- Check if backend server is running
- Verify correct port (3001)
- For Android emulator, use `10.0.2.2` instead of `localhost`

### Issue: "Invalid API Credentials"
- Verify Cashfree App ID and Secret Key
- Check if using correct environment (sandbox vs production)
- Ensure no extra spaces in .env file

### Issue: "Webhook not receiving"
- Verify ngrok is running (for local testing)
- Check webhook URL in Cashfree dashboard
- Verify webhook signature validation

### Issue: "Payment status not updating"
- Check webhook logs in backend
- Verify webhook is configured correctly
- Check Cashfree dashboard for payment status

---

## Support

- **Cashfree Docs**: https://docs.cashfree.com/
- **Cashfree Support**: support@cashfree.com
- **Integration Guide**: https://docs.cashfree.com/docs/payment-gateway

---

## Next Steps

1. ✅ Set up Cashfree account
2. ✅ Get API credentials
3. ✅ Configure .env file
4. ✅ Test API endpoints
5. ✅ Set up webhooks
6. ✅ Test complete payment flow
7. 🚀 Deploy to production

Happy coding! 🎉
