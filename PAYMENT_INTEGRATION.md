# Payment Gateway Integration

This implementation simulates a complete UPI payment flow similar to production payment gateways like Cashfree, Razorpay, or PayU.

## Implementation Overview

### Flow Architecture

```
User Action → Payment Order Creation → Gateway Selection → Authentication → Result
     ↓              ↓                      ↓                  ↓             ↓
SendMoney → paymentGateway.ts → PaymentProcessing → Simulator → Success/Failed
```

### Files Created

1. **`services/paymentGateway.ts`**
   - Simulates payment gateway API calls
   - Creates payment orders with unique Order IDs
   - Processes UPI payments
   - Verifies payment status
   - In production: Replace with actual API calls to your backend server

2. **`screens/PaymentProcessingScreen.tsx`**
   - Multi-stage payment UI
   - UPI app selection (Google Pay, PhonePe, Paytm, etc.)
   - Payment simulator for testing (mock success/failure)
   - Success/failure result screens with transaction details
   - Reference ID generation

### How It Works

#### 1. **User Initiates Payment**
   - User selects recipient and enters amount in `SendMoneyScreen`
   - Clicks "Confirm" button

#### 2. **Payment Order Creation**
   - `createPaymentOrder()` generates a unique Order ID
   - Order details stored: amount, recipient, merchant ID, timestamp
   - In production: This calls your backend server which then calls the PG API

#### 3. **Payment Gateway Redirect**
   - Navigate to `PaymentProcessingScreen` with payment order
   - User selects UPI app (GPay, PhonePe, Paytm, Other)

#### 4. **Testing Simulator**
   - Development/testing environment shows simulator screen
   - Developer can choose SUCCESS or FAILED outcome
   - Simulates real UPI authentication without actual debit

#### 5. **Payment Processing**
   - Shows loading state while "processing"
   - Simulates network call delay
   - In production: PG processes the payment and sends webhook to your server

#### 6. **Result Display**
   - Success screen with:
     - Reference ID (unique transaction ID)
     - Order ID
     - Amount
     - Recipient
     - Timestamp
     - Status badge
   - Failed screen with failure reason
   - Option to retry or return to dashboard

### Production Integration Steps

To integrate with a real payment gateway:

1. **Backend Server Setup**
   ```javascript
   // Replace createPaymentOrder() with API call to your server
   const response = await fetch('https://your-api.com/create-order', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ amount, recipient, note })
   });
   const paymentOrder = await response.json();
   ```

2. **Payment Gateway SDK**
   ```bash
   # Install PG SDK (example for Cashfree)
   npm install react-native-cashfree-pg-sdk
   ```

3. **Replace Simulator with WebView**
   ```tsx
   // Instead of simulator, open PG URL in WebView
   <WebView
     source={{ uri: paymentGatewayUrl }}
     onNavigationStateChange={handlePaymentRedirect}
   />
   ```

4. **Webhook Handler**
   ```javascript
   // Your backend receives webhook from PG
   app.post('/payment-webhook', (req, res) => {
     const { orderId, status, referenceId } = req.body;
     // Update database
     // Send notification to app
   });
   ```

5. **Status Verification**
   ```typescript
   // Poll or use push notification to verify payment
   const status = await verifyPaymentStatus(orderId);
   ```

### Testing the Flow

1. **Start the app and navigate to Send Money**
2. **Select a recipient or enter UPI ID**
3. **Enter amount and optional note**
4. **Click "Review Payment"**
5. **Click "Confirm" on confirmation screen**
6. **Select a UPI app** (e.g., Google Pay)
7. **Choose SUCCESS or FAILED** in simulator
8. **View the result screen** with all transaction details

### Key Features

- ✅ **Realistic Flow**: Mimics production payment gateway behavior
- ✅ **Order Management**: Unique Order IDs and Reference IDs
- ✅ **Testing Simulator**: Easy testing without real transactions
- ✅ **Complete UI**: Professional success/failure screens
- ✅ **Transaction Details**: All metadata displayed (timestamps, IDs, status)
- ✅ **Error Handling**: Graceful failure with retry option
- ✅ **Navigation**: Proper screen flow with back handling

### Security Considerations

For production deployment:

1. **Never store payment credentials** in the app
2. **Always use HTTPS** for API calls
3. **Validate on server-side** - never trust client data
4. **Implement rate limiting** to prevent abuse
5. **Use webhooks** for payment confirmation (not client-side)
6. **Store sensitive data** securely (use encrypted storage)
7. **Implement timeout** for payment sessions
8. **Add 3D Secure / OTP** for card payments
9. **Log all transactions** for audit trail
10. **Comply with PCI DSS** if handling card data

### Customization

#### Change Payment Gateway
```typescript
// In paymentGateway.ts, update the API endpoints
export async function createPaymentOrder(...) {
  const response = await fetch('YOUR_PG_API_ENDPOINT', {
    // Your PG-specific configuration
  });
}
```

#### Add More UPI Apps
```typescript
// In PaymentProcessingScreen.tsx
const UPI_APPS = [
  // Add your apps here
  { id: 'bhim' as UPIApp, name: 'BHIM', icon: '🏦' },
];
```

#### Modify Success/Failure UI
Edit the result section in `PaymentProcessingScreen.tsx` to customize the success/failure screens.

### API Reference

#### `createPaymentOrder(amount, recipient, note?)`
Creates a payment order with the payment gateway.

**Parameters:**
- `amount: number` - Payment amount
- `recipient: string` - UPI ID or phone number
- `note?: string` - Optional payment note

**Returns:** `Promise<PaymentOrder>`

#### `processUPIPayment(order, upiApp)`
Processes a UPI payment through selected app.

**Parameters:**
- `order: PaymentOrder` - The payment order to process
- `upiApp: 'gpay' | 'phonepe' | 'paytm' | 'other'` - Selected UPI app

**Returns:** `Promise<PaymentResult>`

#### `verifyPaymentStatus(orderId)`
Verifies the current status of a payment.

**Parameters:**
- `orderId: string` - The order ID to verify

**Returns:** `Promise<PaymentResult>`

---

**Note:** This is a simulator for development and testing. Replace with actual payment gateway integration before production deployment.
