# KAVACH Backend

Production-ready backend server for KAVACH unified banking application.

## Features

- 🔐 JWT Authentication
- 💰 Transaction Management
- 🤖 ML-Powered Fraud Detection
- 📱 OTP Fraud Scanner (Hugging Face BERT)
- 🏦 Loan Management System
- 💳 EMI Calculator & Tracker
- 📲 QR Code Payment System
- 🔒 Offline OTP Generation (TOTP)
- 📞 Spam Detection (SMS & Calls)
- 🔔 Smart Notifications
- 📊 Activity Logging
- 🚨 Fraud Alerts

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Configure environment variables:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/kavach
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
HUGGING_FACE_TOKEN=your_optional_huggingface_token
```

4. Start MongoDB (ensure MongoDB is installed and running)

5. Run the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user
- `PUT /change-pin` - Change PIN

### Transactions (`/api/transactions`)
- `POST /send` - Send money
- `GET /` - Get all transactions
- `GET /:id` - Get transaction details

### ML & Fraud Detection (`/api/ml`)
- `POST /analyze-text` - Analyze text with ML
- `POST /analyze-otp` - Analyze OTP message

### Fraud Alerts (`/api/fraud-alerts`)
- `GET /` - Get fraud alerts
- `POST /` - Create fraud alert
- `PUT /:id/resolve` - Resolve alert
- `POST /analyze-transaction` - Analyze transaction

### Loans (`/api/loans`)
- `POST /apply` - Apply for loan
- `GET /` - Get all loans
- `GET /:id` - Get loan details
- `PUT /:id/approve` - Approve loan
- `GET /:id/emis` - Get EMI schedule

### EMI (`/api/emi`)
- `GET /` - Get all EMIs
- `GET /due` - Get due EMIs
- `POST /:id/pay` - Pay EMI

### QR Codes (`/api/qr`)
- `POST /generate` - Generate UPI QR code
- `POST /generate-payment` - Generate payment QR
- `POST /parse` - Parse UPI string

### Offline OTP (`/api/offline-otp`)
- `GET /generate` - Generate OTP
- `POST /verify` - Verify OTP
- `GET /time-remaining` - Get OTP validity

### Spam Detection (`/api/spam`)
- `POST /analyze-message` - Analyze SMS
- `POST /analyze-phone` - Analyze phone number
- `POST /check-otp-legitimacy` - Check OTP legitimacy

### Notifications (`/api/notifications`)
- `GET /` - Get notifications
- `PUT /:id/read` - Mark as read
- `PUT /read-all` - Mark all as read
- `DELETE /:id` - Delete notification

### Activity Logs (`/api/activity`)
- `GET /` - Get activity logs
- `GET /security-alerts` - Get security alerts

### User (`/api/user`)
- `GET /profile` - Get profile
- `PUT /profile` - Update profile
- `PUT /upi` - Set UPI ID
- `PUT /biometric` - Toggle biometric
- `GET /balance` - Get balance
- `GET /accounts` - Get linked accounts
- `POST /accounts` - Link bank account

## Database Models

- **User** - User accounts and authentication
- **Transaction** - Payment transactions
- **FraudAlert** - Fraud detection alerts
- **Loan** - Loan applications and tracking
- **EMI** - EMI schedules and payments
- **Notification** - User notifications
- **ActivityLog** - Activity tracking
- **Account** - Linked bank accounts

## Services

- `realMlApiService` - Hugging Face ML integration
- `mlFraudDetection` - ML-based fraud detection
- `emiCalculator` - EMI calculations
- `qrService` - QR code generation
- `offlineOtpService` - Offline OTP (TOTP)
- `spamDetectionService` - Spam detection
- `notificationService` - Notifications
- `activityLogger` - Activity logging

## Tech Stack

- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Natural** - NLP for fraud detection
- **OTPLib** - TOTP implementation
- **QRCode** - QR code generation
- **Axios** - HTTP client for ML API

## License

MIT
