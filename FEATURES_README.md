# KAVACH - Complete Unified Banking & Security Application

> **Major Merge Complete**: All features from NexaVault integrated into KAVACH with Expo compatibility

## 🎉 New Features Added

### 🤖 ML-Powered Security
- **OTP Fraud Scanner** - Hugging Face BERT-based ML detection for fraudulent OTP messages
- **Real-time Fraud Detection** - ML algorithms analyze transactions in real-time
- **Spam Detection** - Intelligent SMS and call spam filtering
- **Behavioral Analysis** - Track user behavior patterns for anomaly detection

### 🏦 Complete Loan Management
- **Loan Application System** - Apply for personal, business, education, home, and vehicle loans
- **EMI Calculator** - Calculate monthly installments with detailed amortization
- **Loan Dashboard** - Track all active, pending, and completed loans
- **EMI Payment System** - Pay EMIs directly from wallet balance
- **Early Payment Calculator** - Calculate interest savings

### 📲 Enhanced Payment Features
- **QR Code Payments** - Generate and scan UPI QR codes for instant payments
- **Offline OTP** - TOTP-based offline OTP generation for areas without network
- **Multi-language Support** - 22+ Indian languages with i18next
- **Biometric Authentication** - Fingerprint and Face ID support via Expo

### 🔒 Advanced Security
- **Fraud Alert System** - Real-time fraud alerts with ML analysis
- **Activity Logging** - Complete audit trail of all user activities
- **Security Dashboard** - Monitor all security events
- **Smart Notifications** - Priority-based notification system

## 📁 Project Structure

```
KAVACH/
├── backend/                    # Complete Node.js + Express backend
│   ├── models/                # MongoDB models (8 files)
│   │   ├── User.js
│   │   ├── Transaction.js
│   │   ├── FraudAlert.js
│   │   ├── Loan.js
│   │   ├── EMI.js
│   │   ├── Notification.js
│   │   ├── ActivityLog.js
│   │   └── Account.js
│   ├── routes/                # API routes (12 files)
│   │   ├── authRoutes.js
│   │   ├── transactionRoutes.js
│   │   ├── mlRoutes.js
│   │   ├── fraudRoutes.js
│   │   ├── loanRoutes.js
│   │   ├── emiRoutes.js
│   │   ├── qrRoutes.js
│   │   ├── offlineOtpRoutes.js
│   │   ├── spamRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── activityRoutes.js
│   │   └── userRoutes.js
│   ├── services/              # Business logic (8 files)
│   │   ├── realMlApiService.js    # Hugging Face ML integration
│   │   ├── mlFraudDetection.js    # ML-based fraud detection
│   │   ├── emiCalculator.js       # EMI calculations
│   │   ├── qrService.js           # QR code generation
│   │   ├── offlineOtpService.js   # TOTP implementation
│   │   ├── spamDetectionService.js # Spam detection logic
│   │   ├── notificationService.js # Notification management
│   │   └── activityLogger.js      # Activity tracking
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── server.js              # Main Express server
│   ├── package.json
│   └── .env.example
│
├── screens/                   # React Native screens (40+ screens)
│   ├── OtpFraudScannerScreen.tsx   ⭐ NEW
│   ├── LoanDashboardScreen.tsx     ⭐ NEW
│   ├── LoanApplicationScreen.tsx   ⭐ NEW
│   ├── QrScreen.tsx                ⭐ NEW
│   ├── GenerateQRScreen.tsx        ⭐ NEW
│   ├── BiometricAuthScreen.tsx     ⭐ NEW
│   ├── SpamDetectionScreen.tsx     ⭐ NEW
│   └── ... (existing screens)
│
├── services/
│   └── api.ts                 ⭐ NEW - Centralized API service
│
├── MERGE_PLAN.md              # Complete merge documentation
├── README.md                  # This file
└── package.json               # Updated with i18next, react-native-svg

```

## 🚀 Setup Instructions

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/kavach
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   NODE_ENV=development
   HUGGING_FACE_TOKEN=your_optional_huggingface_token
   ```

4. **Start MongoDB:**
   Make sure MongoDB is installed and running on your system.

5. **Run the backend:**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

### Frontend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Update API URL:**
   Edit `services/api.ts` and update the backend URL:
   ```typescript
   export const API_URL = "http://your-backend-url:5000/api";
   ```

3. **Run the app:**
   ```bash
   # Development mode
   npm start
   
   # iOS
   npm run ios
   
   # Android
   npm run android
   ```

## 🔧 Configuration

### Backend API Endpoints

All APIs are available at `http://localhost:5000/api/*`

- **Authentication:** `/api/auth/*`
- **Transactions:** `/api/transactions/*`
- **ML Analysis:** `/api/ml/*`
- **Fraud Alerts:** `/api/fraud-alerts/*`
- **Loans:** `/api/loans/*`
- **EMI:** `/api/emi/*`
- **QR Codes:** `/api/qr/*`
- **Offline OTP:** `/api/offline-otp/*`
- **Spam Detection:** `/api/spam/*`
- **Notifications:** `/api/notifications/*`
- **Activity Logs:** `/api/activity/*`
- **User Profile:** `/api/user/*`

### Frontend API Service

Centralized API service in `services/api.ts`:

```typescript
import { authAPI, transactionAPI, loanAPI, mlAPI, /* ... */ } from '@/services/api';

// Example usage
const login = async () => {
  const response = await authAPI.login({ phoneNumber, pin });
  // Handle response
};
```

## 📱 Key Features

### 1. ML-Powered OTP Fraud Scanner
- Analyzes OTP messages using Hugging Face BERT model
- Detects phishing attempts and fraudulent messages
- Provides risk scores and recommendations
- Identifies trusted bank senders

### 2. Comprehensive Loan System
- Multiple loan types (Personal, Business, Education, Home, Vehicle)
- Advanced EMI calculator with amortization schedule
- Loan application workflow
- EMI payment tracking
- Early payment savings calculator

### 3. QR Code Payments
- Generate UPI-compliant QR codes
- Scan QR codes for instant payments
- Dynamic amount QR codes
- Merchant QR support

### 4. Biometric Security
- Fingerprint authentication
- Face ID support (iOS)
- Fallback to PIN
- Device-local biometric data

### 5. Spam Protection
- SMS spam detection
- Phone number spam analysis
- OTP legitimacy verification
- Trusted sender identification

### 6. Offline OTP
- TOTP (Time-based One-Time Password)
- Works without internet connection
- 30-second validity window
- QR code setup for authenticator apps

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express** - REST API server
- **MongoDB** + **Mongoose** - Database and ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Natural** - NLP for fraud detection
- **OTPLib** - TOTP implementation
- **QRCode** - QR code generation
- **Axios** - Hugging Face API integration

### Frontend
- **React Native** (via Expo)
- **Expo Router** - Navigation
- **Axios** - API communication
- **AsyncStorage** - Local storage
- **Expo Local Authentication** - Biometrics
- **Expo Camera** - QR scanning
- **i18next** - Internationalization

## 📋 Migration Notes

### From NexaVault to KAVACH

**Key Changes:**
1. **React Native CLI → Expo:** All native modules replaced with Expo equivalents
2. **react-native-biometrics → expo-local-authentication**
3. **react-native-camera-kit → expo-camera**  
4. **Unified backend:** Merged both backends into single comprehensive API

**Feature Parity:**
✅ All NexaVault features successfully ported  
✅ ML fraud detection maintained
✅ 22+ language support ready (i18n configured)
✅ Biometric auth working with Expo
✅ QR payments fully functional

## 🔐 Security Features

1. **JWT Authentication** - Secure token-based auth
2. **PIN Protection** - bcrypt-hashed PINs
3. **Biometric Lock** - Face ID/Fingerprint
4. **Activity Logging** - Complete audit trail
5. **Fraud Detection** - Real-time ML analysis
6. **Secure Storage** - Expo SecureStore for sensitive data
7. **OTP Protection** - Multi-layer OTP verification

## 🌍 Multi-Language Support

Configured for 22+ Indian languages:
- English (en)
- हिंदी (hi)
- বাংলা (bn)
- తెలుగు (te)
- मराठी (mr)
- தமிழ் (ta)
- ગુજરાતી (gu)
- ಕನ್ನಡ (kn)
- മലയാളം (ml)
- ਪੰਜਾਬੀ (pa)
- ଓଡିଆ (or)
- অসমীয়া (as)
- And more...

## 📊 Database Models

- **User** - User accounts and profiles
- **Transaction** - Payment transactions
- **FraudAlert** - Fraud detection alerts
- **Loan** - Loan applications and tracking
- **EMI** - EMI schedules and payments
- **Notification** - User notifications
- **ActivityLog** - Activity and security logs
- **Account** - Linked bank accounts

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
npm test
```

## 📝 License

MIT

## 👥 Contributors

- Original NexaVault Team
- KAVACH Development Team

## 🆘 Support

For issues and questions:
1. Check [MERGE_PLAN.md](MERGE_PLAN.md) for implementation details
2. Review backend README in `backend/README.md`
3. Check API documentation at `http://localhost:5000/` when server is running

---

**Status:** ✅ Full merge completed successfully  
**Last Updated:** February 11, 2026  
**Version:** 2.0.0 (Post-merge)
