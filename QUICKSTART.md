# 🚀 Quick Start - Payment Integration

Get your payment system running in 5 minutes!

## Step 1: Get Cashfree Credentials (2 minutes)

1. Go to https://www.cashfree.com/
2. Sign up (free sandbox account)
3. Navigate to **Developers** → **API Keys**
4. Copy your **App ID** and **Secret Key**

## Step 2: Configure Backend (1 minute)

```bash
# Navigate to server folder
cd server

# Create .env file
cp .env.example .env
```

Edit `.env` file:
```env
CASHFREE_APP_ID=paste_your_app_id_here
CASHFREE_SECRET_KEY=paste_your_secret_key_here
CASHFREE_ENV=sandbox
```

## Step 3: Start Backend (30 seconds)

```bash
# Make sure you're in the server folder
npm run start
```

You should see: `Server listening on 3001`

## Step 4: Start Mobile App (30 seconds)

Open a NEW terminal:
```bash
# Go back to root folder
cd ..

# Start Expo
npx expo start
```

## Step 5: Test Payment Flow (1 minute)

1. Open app on emulator/device
2. Go to **Send Money**
3. Select a recipient (e.g., "Rahul Sharma")
4. Enter amount: `100`
5. Click **Review Payment**
6. Click **Confirm**
7. Select **Google Pay** (or any UPI app)
8. Choose **Success** in simulator
9. See success screen with Reference ID!

## ✅ Done!

Your payment system is now running with:
- ✅ Real Cashfree API integration
- ✅ Backend server handling orders
- ✅ Secure payment flow
- ✅ Transaction tracking

---

## 🔍 Verify It's Working

### Test backend API directly:
```bash
curl -X POST http://localhost:3001/api/payment/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "recipient": "test@upi",
    "customerPhone": "9999999999",
    "customerName": "Test User"
  }'
```

Should return:
```json
{
  "success": true,
  "orderId": "ORD_...",
  "paymentUrl": "https://sandbox.cashfree.com/..."
}
```

---

## 🐛 Troubleshooting

### Backend won't start
- ✅ Check if you're in `server` folder
- ✅ Run `npm install` first
- ✅ Verify `.env` file exists

### "Connection Refused" in app
- ✅ Check backend is running (should see "Server listening on 3001")
- ✅ For Android emulator, update URL to `http://10.0.2.2:3001` in `services/paymentGateway.ts`
- ✅ For physical device, use your computer's IP address

### "Invalid API Credentials"
- ✅ Verify Cashfree App ID and Secret Key in `.env`
- ✅ No extra spaces or quotes
- ✅ Make sure `CASHFREE_ENV=sandbox`

---

## 📚 Documentation

- **Complete Setup**: `server/BACKEND_SETUP.md`
- **Integration Guide**: `BACKEND_INTEGRATION.md`
- **Payment Flow**: `PAYMENT_INTEGRATION.md`

---

## 🎉 Next Steps

### For Testing
Keep using simulator mode (current setup)

### For Production
1. Complete Cashfree KYC
2. Get production credentials
3. Deploy backend to production
4. Update mobile app URLs
5. Set `CASHFREE_ENV=production`

---

**Need help?** Check the detailed guides or Cashfree documentation!
