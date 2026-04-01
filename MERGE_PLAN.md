# NexaVault to KAVACH Merge Plan

## Overview
Merging all features from NexaVault into KAVACH while maintaining Expo compatibility.

## Phase 1: Backend Infrastructure ✅ IN PROGRESS

### 1.1 Database Models
- [x] Directory created
- [ ] Transaction.js - Enhanced transaction model with fraud fields
- [ ] FraudAlert.js - Fraud detection alerts
- [ ] ActivityLog.js - Activity tracking
- [ ] Loan.js - Loan management
- [ ] EMI.js - EMI schedule
- [ ] Notification.js - Notifications
- [ ] Account.js - Bank accounts
- [ ] User.js - User model (enhanced)

### 1.2 Backend Services
- [x] Directory created
- [ ] realMlApiService.js - Hugging Face ML API integration
- [ ] mlFraudDetection.js - ML-based fraud detection
- [ ] mlSmsClassifier.js - SMS spam classification
- [ ] fraudDetection.js - Rule-based fraud detection
- [ ] offlineOtp.js - Offline OTP generation
- [ ] emiCalculator.js - EMI calculations
- [ ] smsClassifier.js - SMS classification
- [ ] BiometricService.js - Biometric authentication
- [ ] VoiceService.js - Voice commands
- [ ] OtpService.js - OTP management

### 1.3 API Routes
- [x] Directory created  
- [ ] authRoutes.js - Authentication
- [ ] fraudRoutes.js - Fraud alerts & stats
- [ ] mlRoutes.js - ML classification & analysis
- [ ] otpFraudRoutes.js - OTP fraud detection (Hugging Face)
- [ ] loanRoutes.js - Loan management
- [ ] activityRoutes.js - Activity logs
- [ ] spamRoutes.js - Spam detection
- [ ] offlineOtpRoutes.js - Offline OTP
- [ ] voiceRoutes.js - Voice commands
- [ ] notificationRoutes.js - Notifications
- [ ] qrRoutes.js - QR code payments
- [ ] verificationRoutes.js - Aadhaar/Face verification
- [ ] accountRoutes.js - Account management
- [ ] transactionRoutes.js - Transactions

### 1.4 Middleware & Config
- [x] Directories created
- [ ] auth.js - JWT authentication middleware
- [ ] db.js - MongoDB connection

### 1.5 Backend Server
- [ ] server.js - Express server with all routes

## Phase 2: Frontend Screens (Expo-compatible)

### 2.1 Loan Management
- [ ] LoanDashboardScreen.tsx
- [ ] LoanApplicationScreen.tsx
- [ ] EMICalculatorScreen.tsx

### 2.2 OTP & Fraud Detection
- [ ] OtpFraudScannerScreen.tsx - ML-powered OTP fraud scanner
- [ ] UnknownNumberScannerScreen.tsx - Spam number checker
- [ ] OfflineOtpScreen.tsx - Offline OTP generator

### 2.3 QR Payments
- [ ] QrScreen.tsx - Display user QR code
- [ ] QrScannerScreen.tsx - Scan QR codes
- [ ] QrPaymentScreen.tsx - Process QR payments

### 2.4 Verification
- [ ] BiometricAuthScreen.tsx - Biometric setup/auth
- [ ] FaceVerificationScreen.tsx - Face recognition
- [ ] (AadhaarVerificationScreen.tsx exists ✓)

### 2.5 Enhanced Screens
- [ ] AccountsScreen.tsx - Enhanced accounts view
- [ ] TransactionsScreen.tsx - Enhanced transactions
- [ ] NotificationsScreen.tsx - Notifications
- [ ] SettingsScreen.tsx - Enhanced settings
- [ ] ProfileScreen.tsx - Enhanced profile
- [ ] HelpScreen.tsx - Help & support
- [ ] SplashScreen.tsx - Splash screen
- [ ] VoiceAssistantScreen.tsx - Voice assistant

## Phase 3: Services & Utilities

### 3.1 Frontend Services
- [ ] BiometricService.ts - Expo biometric integration
- [ ] VoiceService.ts - Voice recognition/TTS
- [ ] OtpService.ts - OTP utilities

### 3.2 Components
- [ ] TransactionItem.tsx - Transaction list item
- [ ] Card.tsx - Generic card component
- [ ] GradientCard.tsx - Gradient card
- [ ] AnimatedButton.tsx - Animated button
- [ ] InputField.tsx - Enhanced input
- [ ] QuickActionButton.tsx - Quick action button
- [ ] Header.tsx - Header component
- [ ] PrimaryButton.tsx - Primary button
- [ ] VoiceAssistantButton.tsx - Voice button

### 3.3 API Integration
- [ ] api.ts - Enhanced API with all endpoints
  - Fraud APIs
  - ML APIs
  - OTP Fraud APIs  
  - Loan APIs
  - Activity APIs
  - Spam APIs
  - Offline OTP APIs
  - QR APIs

## Phase 4: i18n & Theme

### 4.1 Internationalization
- [ ] i18n/index.ts - i18next setup
- [ ] i18n/locales/ - 22+ language files
  - [ ] en.json, hi.json, bn.json, ta.json, te.json
  - [ ] mr.json, gu.json, kn.json, ml.json, pa.json
  - [ ] or.json, as.json, ur.json, sd.json, ks.json
  - [ ] ne.json, sa.json, kok.json, mai.json, doi.json
  - [ ] bho.json, sat.json

### 4.2 Theme
- [ ] theme/ThemeContext.tsx - Enhanced theme

## Phase 5: Navigation & Dependencies

### 5.1 Navigation
- [ ] Update RootNavigator.tsx
- [ ] Update AppNavigator.tsx
- [ ] Add all new screen routes

### 5.2 Dependencies
- [ ] react-native-biometrics → expo-local-authentication ✓
- [ ] react-native-voice → expo-speech ✓
- [ ] react-native-tts → expo-speech ✓
- [ ] react-native-qrcode-svg ✓
- [ ] react-native-camera-kit → expo-camera ✓
- [ ] i18next
- [ ] mongoose (backend)
- [ ] jsonwebtoken (backend)
- [ ] bcryptjs (backend)
- [ ] axios (backend)
- [ ] dotenv (backend)
- [ ] natural (backend - ML)
- [ ] otplib (backend - offline OTP)

## Phase 6: Testing & Documentation

- [ ] Test all new endpoints
- [ ] Test all new screens
- [ ] Update README.md
- [ ] Create API documentation
- [ ] Test biometric authentication
- [ ] Test QR code scanning
- [ ] Test voice commands
- [ ] Test fraud detection
- [ ] Test loan calculations
- [ ] Test multilingual support

## Key Features Being Added

1. ✅ **ML-Powered OTP Fraud Detection** - Hugging Face BERT API
2. ✅ **Biometric Authentication** - Fingerprint/Face ID  
3. ✅ **Offline OTP System** - TOTP-based
4. ✅ **Loan Management** - Full loan lifecycle with EMI
5. ✅ **QR Code Payments** - Generate & scan
6. ✅ **Spam Detection** - Phone & SMS spam checker
7. ✅ **22+ Languages** - Full i18n support
8. ✅ **Voice Assistant** - Voice commands & TTS
9. ✅ **Fraud Detection** - ML + Rule-based
10. ✅ **Activity Tracking** - Complete audit trail
11. ✅ **Enhanced Notifications** - Rich notifications
12. ✅ **Face Verification** - Face recognition

## Notes

- **React Native vs Expo**: NexaVault uses React Native CLI, KAVACH uses Expo
  - Using Expo-compatible alternatives for native modules
  - Some features may need adaptation
  
- **Backend**: Complete Node.js/Express backend with MongoDB
  - All routes and services being copied
  - ML services using Hugging Face API
  
- **Database Models**: MongoDB models for all features
  - Transaction tracking with fraud scores
  - Loan and EMI management
  - Activity logging
  - Fraud alerts

## Implementation Order

1. Backend models & services (CURRENT)
2. Backend routes & controllers
3. Core frontend screens
4. Enhanced components
5. i18n setup
6. Theme integration
7. Navigation updates
8. Testing & refinement

---

**Status**: Phase 1 - Backend Infrastructure IN PROGRESS
**Last Updated**: February 11, 2026
