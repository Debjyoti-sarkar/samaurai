# 🛡️ KAVACH - Smart UPI Payment App

<div align="center">

![KAVACH Logo](https://img.shields.io/badge/KAVACH-UPI%20Payment%20Security-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

**Next-Generation UPI Payment App with AI-Powered Fraud Detection & Multi-Language Voice Assistant**

[Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [Documentation](#-documentation) • [Architecture](#-architecture)

</div>

---

## 📱 Overview

**KAVACH** is a comprehensive UPI payment application designed for the Indian market, featuring advanced security, multi-language support, and accessibility-first design. Built with cutting-edge fraud detection using Machine Learning and Natural Language Processing, KAVACH ensures safe and secure digital transactions for everyone.

### 🎯 Key Highlights

- 🤖 **AI-Powered Fraud Detection** - Real-time ML-based transaction and OTP fraud analysis
- 🗣️ **Voice Assistant** - Voice-powered UPI transactions in 22+ Indian languages
- 🔒 **Advanced Security** - Biometric authentication, behavioral analysis, SIM binding
- 💰 **Complete Loan System** - Apply, track, and manage loans with EMI calculator
- 📱 **QR Payments** - Scan and generate UPI QR codes instantly
- 🚫 **Spam Detection** - Identify fraudulent SMS and calls
- 🌍 **Multi-Language** - Support for 22 Indian regional languages
- 📴 **Offline OTP** - TOTP-based offline OTP generation
- 📊 **Behavior Analytics** - Real-time user behavior monitoring

---

## ✨ Features

### 🔐 Security & Fraud Protection

| Feature | Description |
|---------|-------------|
| **ML Fraud Detection** | Hugging Face BERT integration for OTP and transaction fraud analysis |
| **Real-time Monitoring** | SMS and transaction monitoring with risk scoring |
| **Behavioral Biometrics** | Touch patterns, typing speed, and cursor tracking analysis |
| **Spam Detection** | AI-powered SMS and call spam identification |
| **SIM Binding** | Auto-logout and data wipe on SIM card change |
| **Screen Security** | Screenshot and screen recording prevention |

### 💳 Payment Features

| Feature | Description |
|---------|-------------|
| **Voice Transactions** | Voice-powered UPI payments with speech-to-text |
| **QR Code Payments** | Scan merchant QR codes or generate personal QR codes |
| **Contact Picker** | Send money to contacts directly |
| **Transaction History** | Complete payment history with fraud scores |
| **Offline OTP** | TOTP-based OTP generation without internet |
| **Balance Check** | Real-time balance inquiry |

### 🏦 Loan Management

| Feature | Description |
|---------|-------------|
| **Loan Application** | Apply for Personal, Business, Education, Home, Vehicle loans |
| **EMI Calculator** | Real-time EMI calculation with amortization schedule |
| **Loan Dashboard** | Track all loans (Pending, Active, Completed) |
| **EMI Payments** | Pay EMIs with due date reminders |
| **Early Payment** | Calculate savings on early loan closure |

### 🌐 Accessibility & Localization

| Feature | Description |
|---------|-------------|
| **22+ Languages** | Hindi, Bengali, Telugu, Tamil, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu, and more |
| **Voice Assistant** | Hands-free operation for visually impaired users |
| **Text-to-Speech** | Screen reader support |
| **Simple UI** | Senior-citizen friendly interface |
| **Educational Videos** | UPI tutorial videos in regional languages |

### 📊 Analytics & Monitoring

| Feature | Description |
|---------|-------------|
| **Behavior Dashboard** | Visualize typing patterns, cursor movements, gestures |
| **Fraud Alerts** | Real-time notifications for suspicious activities |
| **Activity Logs** | Complete audit trail of user actions |
| **Security Dashboard** | Centralized security status overview |
| **SMS Fraud Dashboard** | Monitor and manage SMS fraud detections |

---

## 🏗️ Tech Stack

### Frontend (Mobile App)

```typescript
React Native 0.81.5 + Expo ~54.0.25
```

| Category | Technologies |
|----------|-------------|
| **Framework** | React Native, Expo |
| **Navigation** | @react-navigation/native, @react-navigation/native-stack |
| **State Management** | React Context API, React Hooks |
| **UI Components** | react-native-gesture-handler, react-native-safe-area-context |
| **Internationalization** | i18next, react-i18next |
| **Authentication** | expo-local-authentication (Fingerprint/Face ID) |
| **Camera & QR** | expo-camera, react-native-svg |
| **Speech/Voice** | expo-speech, @deepgram/sdk |
| **Security** | expo-screen-capture, expo-secure-store |
| **Storage** | @react-native-async-storage/async-storage |

### Backend (API Server)

```javascript
Node.js + Express + MongoDB
```

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js |
| **Framework** | Express 4.18.2 |
| **Database** | MongoDB, Mongoose 8.0.3 |
| **Authentication** | jsonwebtoken, bcryptjs |
| **ML/NLP** | Natural 6.10.2, Axios (Hugging Face API) |
| **Security** | OTPLib 12.0.1, express-validator |
| **QR Codes** | qrcode 1.5.3 |
| **File Upload** | multer 1.4.5 |
| **CORS** | cors 2.8.5 |

### External Services

| Service | Purpose |
|---------|---------|
| **Hugging Face** | ML-based fraud detection (BERT models) |
| **Deepgram** | Speech-to-Text for voice assistant |
| **Cashfree** | Payment gateway integration |
| **MongoDB Atlas** | Cloud database (production) |

---

## 🚀 Installation

### Prerequisites

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6.0 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **Git** - [Download](https://git-scm.com/)
- **Expo CLI** - Install via npm
- **Android Studio** (for Android) or **Xcode** (for iOS)

### Quick Start (Windows)

```powershell
# Clone the repository
git clone https://github.com/Debjyoti-sarkar/KAVACH.git
cd KAVACH

# Run automated setup
.\quick-start.ps1
```

### Manual Setup

#### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

#### 2. Configure Backend

Create `backend/.env` file:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/kavach

# Authentication
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# ML Services (Optional)
HUGGING_FACE_TOKEN=your_huggingface_token_here
```

#### 3. Start MongoDB

**Windows:**
```bash
mongod --dbpath="C:\data\db"
```

**macOS/Linux:**
```bash
brew services start mongodb-community
```

#### 4. Start Backend Server

```bash
cd backend
npm run dev
```

Verify at: http://localhost:5000

#### 5. Configure Frontend API

Edit `services/api.ts`:

```typescript
export const API_URL = __DEV__
  ? "http://localhost:5000/api"      // For emulator/simulator
  : "https://your-api.com/api";      // For production
```

**For Android Emulator:** Use `http://10.0.2.2:5000/api`

For OTP service, you can set Expo env vars in a root `.env` file:

```env
EXPO_PUBLIC_OTP_API_BASE_URL=http://192.168.1.10:5000
```

You can also use `EXPO_PUBLIC_API_BASE_URL`; both support values with or without `/api`.

#### 6. Start Expo App

```bash
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app for physical device

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **[SETUP_GUIDE.md](SETUP_GUIDE.md)** | Complete installation and deployment guide |
| **[FEATURES_README.md](FEATURES_README.md)** | Detailed feature documentation |
| **[MERGE_COMPLETE.md](MERGE_COMPLETE.md)** | Feature integration summary |
| **[backend/README.md](backend/README.md)** | Backend API documentation |
| **[QUICKSTART.md](QUICKSTART.md)** | Quick start guide |

---

## 🏛️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Mobile App (Expo)                  │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Screens  │  │ Services │  │ Context/Hooks   │  │
│  └────┬─────┘  └────┬─────┘  └────┬────────────┘  │
│       │             │              │                │
│       └─────────────┴──────────────┘                │
│                     ▼                               │
│            API Service (Axios)                      │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────────┐
│              Backend (Express.js)                   │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │  Routes  │→ │ Services │→ │    Models       │  │
│  └──────────┘  └──────────┘  └────┬────────────┘  │
│       ▲              ▲              │               │
│       │              └──────────────┼───────────┐   │
│       │                             ▼           │   │
│  Middleware                    MongoDB      ML API │
└─────────────────────────────────────────────────────┘
```

### Project Structure

```
KAVACH/
├── 📱 Mobile App
│   ├── screens/              # All UI screens
│   ├── components/           # Reusable components
│   ├── navigation/           # Navigation configuration
│   ├── services/             # API & utility services
│   ├── hooks/                # Custom React hooks
│   ├── contexts/             # Context providers
│   ├── constants/            # Theme, i18n config
│   └── utils/                # Helper functions
│
├── 🔧 Backend
│   ├── models/               # 8 Mongoose models
│   ├── services/             # 8 Business logic services
│   ├── routes/               # 12 API route handlers
│   ├── middleware/           # Auth & validation
│   ├── config/               # Database configuration
│   └── server.js             # Express server entry
│
└── 📚 Documentation
    ├── SETUP_GUIDE.md
    ├── FEATURES_README.md
    └── MERGE_COMPLETE.md
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/change-pin` - Change PIN

### Transactions
- `POST /api/transactions/send` - Send money (with fraud check)
- `GET /api/transactions` - Get transaction history
- `GET /api/transactions/:id` - Get transaction details

### Fraud Detection
- `POST /api/ml/analyze-text` - ML text analysis
- `POST /api/ml/analyze-otp` - OTP fraud detection
- `GET /api/fraud-alerts` - Get fraud alerts
- `POST /api/fraud-alerts` - Create fraud alert

### Loans
- `POST /api/loans/apply` - Apply for loan
- `GET /api/loans` - Get user loans
- `GET /api/loans/:id` - Get loan details
- `GET /api/loans/:id/emis` - Get loan EMI schedule

### EMI
- `GET /api/emi` - Get user EMIs
- `GET /api/emi/due` - Get due EMIs
- `POST /api/emi/:id/pay` - Pay EMI

### QR Codes
- `POST /api/qr/generate` - Generate UPI QR code
- `POST /api/qr/parse` - Parse QR code

### Spam Detection
- `POST /api/spam/analyze-message` - Analyze SMS
- `POST /api/spam/analyze-phone` - Check phone number
- `POST /api/spam/check-otp-legitimacy` - Verify OTP message

### Offline OTP
- `GET /api/offline-otp/generate` - Generate TOTP
- `POST /api/offline-otp/verify` - Verify TOTP

**Full API documentation:** [backend/README.md](backend/README.md)

---

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Test health check
curl http://localhost:5000

# Test user registration
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"9876543210","name":"Test User","pin":"123456"}'
```

### Frontend Testing

```bash
# Clear cache and restart
npm start -- --clear

# Run on specific platform
npm run ios
npm run android
```

---

## 🔐 Security Features

- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **PIN Hashing** - bcrypt password hashing
- ✅ **Biometric Auth** - Fingerprint/Face ID support
- ✅ **Screen Security** - Screenshot/recording prevention
- ✅ **SIM Binding** - Device security with SIM verification
- ✅ **CORS Protection** - Cross-origin request filtering
- ✅ **Input Validation** - express-validator for all inputs
- ✅ **Activity Logging** - Complete audit trail
- ✅ **Fraud Scoring** - ML-based risk assessment

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Debjyoti Sarkar** - [@Debjyoti-sarkar](https://github.com/Debjyoti-sarkar)

---

## 🙏 Acknowledgments

- Hugging Face for ML models
- Expo team for the amazing framework
- MongoDB for database solutions
- React Native community

---

## 📞 Support

For issues and questions:
- 📧 Email: support@kavach.app
- 🐛 Issues: [GitHub Issues](https://github.com/Debjyoti-sarkar/KAVACH/issues)
- 📖 Docs: [Documentation](SETUP_GUIDE.md)

---

<div align="center">

**Made with ❤️ for safer digital payments in India**

⭐ Star this repository if you find it helpful!

[📥 Download](#-installation) • [📖 Docs](#-documentation) • [🐛 Report Bug](https://github.com/Debjyoti-sarkar/KAVACH/issues)

</div>
