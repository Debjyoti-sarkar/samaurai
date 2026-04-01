# KAVACH Behavior Analysis System

## Overview

The Behavior Analysis System provides real-time fraud detection and user behavior profiling for the KAVACH banking application. It uses a combination of rule-based analysis and machine learning to detect unusual payment patterns and trigger re-authentication when necessary.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React Native)                      │
├─────────────────────────────────────────────────────────────────┤
│  services/behaviorAnalysis.ts    │  hooks/useBehaviorTracking.ts │
│  components/ReauthModal.tsx      │  screens/SecurityDashboard.tsx │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP/REST API
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js/Express)                    │
├─────────────────────────────────────────────────────────────────┤
│  routes/frauddetection.js        │  Risk Scoring Engine          │
│  - /analyze-transaction          │  - Amount Analysis            │
│  - /track-event                  │  - Time Analysis              │
│  - /check-reauth                 │  - Location Analysis          │
│  - /resolve-alert                │  - Device Analysis            │
│  - /user-profile                 │  - Velocity Analysis          │
│  - /statistics                   │  - Behavioral Analysis        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│    MongoDB      │         │   ML Models     │
│                 │         │   (Python)      │
│ - UserProfiles  │         │                 │
│ - Transactions  │         │ - Isolation     │
│ - BehaviorEvents│         │   Forest        │
│ - FraudAlerts   │         │ - Autoencoder   │
└─────────────────┘         │ - Rules Engine  │
                            └─────────────────┘
```

## Features

### 1. Real-Time Risk Scoring
- Analyzes transactions before processing
- Returns risk score (0-100) and risk level
- Identifies specific risk factors
- Recommends actions (proceed/reauth/block)

### 2. User Behavior Profiling
- Tracks transaction patterns (amounts, frequency)
- Learns preferred transaction times
- Builds trusted recipient list
- Records trusted devices and locations

### 3. Anomaly Detection
- Rule-based checks for common fraud patterns
- ML-based anomaly detection (Isolation Forest)
- Optional deep learning (Autoencoder) for pattern recognition

### 4. Re-authentication Triggers
- Automatic re-auth for high-risk transactions
- Supports PIN and Biometric verification
- Escalation after multiple failures

## Setup Instructions

### Backend Setup

1. **Install MongoDB** (if not using cloud):
   ```bash
   # Windows (using chocolatey)
   choco install mongodb

   # Or use MongoDB Atlas (cloud)
   ```

2. **Configure Environment**:
   ```bash
   cd server
   cp .env.example .env
   ```

   Add to `.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/kavach
   # Or for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/kavach
   ```

3. **Install Dependencies**:
   ```bash
   cd server
   npm install
   ```

4. **Start Server**:
   ```bash
   npm run dev
   ```

### ML Model Training

1. **Install Python Dependencies**:
   ```bash
   cd server/ml
   pip install -r requirements.txt
   ```

2. **Generate Synthetic Training Data**:
   ```bash
   python synthetic_data_generator.py
   ```

3. **Train Models**:
   ```bash
   python train_model.py --mode synthetic --users 100 --days 30
   ```

### Frontend Integration

1. **Import the service in your screens**:
   ```typescript
   import { behaviorAnalysis } from '../services/behaviorAnalysis';
   import useBehaviorTracking from '../hooks/useBehaviorTracking';
   ```

2. **Initialize with user ID after login**:
   ```typescript
   useEffect(() => {
     behaviorAnalysis.setUserId(user.id);
   }, [user]);
   ```

## API Reference

### POST /api/fraud/analyze-transaction
Analyze a transaction for fraud risk before processing.

**Request:**
```json
{
  "userId": "USER_001",
  "amount": 5000,
  "recipientUpiId": "receiver@upi",
  "recipientName": "John Doe",
  "deviceInfo": {
    "deviceId": "DEV_123",
    "deviceModel": "Samsung Galaxy S21"
  },
  "locationInfo": {
    "latitude": 19.0760,
    "longitude": 72.8777
  },
  "sessionInfo": {
    "sessionId": "SESSION_123",
    "sessionDuration": 120,
    "actionsBeforeTransaction": 8
  }
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "TXN_123",
  "riskAssessment": {
    "riskScore": 35,
    "riskLevel": "medium",
    "requiresReauth": false,
    "requiresBlock": false,
    "riskFactors": [
      {
        "factor": "new_recipient",
        "score": 40,
        "description": "Transaction to new recipient"
      }
    ]
  },
  "recommendation": {
    "action": "proceed_with_caution",
    "message": "Please verify details before proceeding.",
    "displayType": "info"
  }
}
```

### POST /api/fraud/check-reauth
Quick check if re-authentication is required.

**Request:**
```json
{
  "userId": "USER_001",
  "amount": 50000,
  "recipientUpiId": "unknown@upi"
}
```

**Response:**
```json
{
  "success": true,
  "requiresReauth": true,
  "reason": "High amount to new recipient",
  "riskScore": 78,
  "riskLevel": "high",
  "suggestedMethod": "biometric"
}
```

### POST /api/fraud/track-event
Track user behavior events.

**Request:**
```json
{
  "userId": "USER_001",
  "eventType": "screen_view",
  "eventData": {
    "screenName": "SendMoney"
  },
  "sessionId": "SESSION_123"
}
```

### POST /api/fraud/track-transaction
Track completed transaction for profile updates.

### POST /api/fraud/resolve-alert
Resolve a fraud alert after re-authentication.

### GET /api/fraud/user-profile/:userId
Get user's behavioral profile.

### GET /api/fraud/alerts/:userId
Get user's fraud alerts.

### GET /api/fraud/statistics/:userId
Get fraud detection statistics.

## Risk Scoring Algorithm

The risk score is calculated using weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Amount Deviation | 20% | Z-score from average transaction |
| Time Anomaly | 10% | Transaction at unusual hours |
| Location Anomaly | 15% | Distance from trusted locations |
| Device Anomaly | 15% | Unknown or new device |
| Recipient Anomaly | 15% | New recipient trust score |
| Velocity Anomaly | 10% | Transaction frequency |
| Behavioral Anomaly | 10% | Session patterns |
| Auth Anomaly | 5% | Failed authentication attempts |

### Risk Levels

| Score | Level | Action |
|-------|-------|--------|
| 0-24 | Low | Proceed |
| 25-49 | Medium | Proceed with caution |
| 50-74 | High | Require re-authentication |
| 75-100 | Critical | Block transaction |

## Frontend Usage Examples

### Analyze Transaction Before Payment

```typescript
import { useBehaviorTracking } from '../hooks/useBehaviorTracking';

const PaymentScreen = () => {
  const { analyzeTransaction } = useBehaviorTracking({ userId: user.id });

  const handlePayment = async () => {
    // Analyze transaction first
    const result = await analyzeTransaction(
      amount,
      recipientUpiId,
      recipientName
    );

    if (!result) {
      // API error - proceed with caution or show error
      return;
    }

    if (result.riskAssessment.requiresBlock) {
      Alert.alert('Transaction Blocked', result.recommendation.message);
      return;
    }

    if (result.riskAssessment.requiresReauth) {
      // Show re-authentication modal
      setShowReauthModal(true);
      return;
    }

    // Proceed with payment
    processPayment();
  };
};
```

### Using Re-authentication Modal

```typescript
import ReauthModal from '../components/ReauthModal';

const [showReauth, setShowReauth] = useState(false);
const [riskResult, setRiskResult] = useState(null);

return (
  <>
    {/* Your payment UI */}

    <ReauthModal
      visible={showReauth}
      onClose={() => setShowReauth(false)}
      onSuccess={() => {
        setShowReauth(false);
        processPayment();
      }}
      onFailure={() => {
        setShowReauth(false);
        Alert.alert('Verification Failed', 'Transaction cancelled for security.');
      }}
      riskLevel={riskResult?.riskLevel || 'medium'}
      reason={riskResult?.riskFactors[0]?.description}
      suggestedMethod="biometric"
    />
  </>
);
```

### Track User Events

```typescript
const { trackEvent, trackAuthEvent, trackScreenView } = useBehaviorTracking();

// Track screen views (automatic with hook option)
// Track button clicks
const handleButtonPress = async () => {
  await trackEvent('button_click', { buttonId: 'pay_now', buttonLabel: 'Pay Now' });
  // ... rest of logic
};

// Track authentication
const handleLogin = async (success: boolean) => {
  await trackAuthEvent('biometric', success);
};
```

## Database Schema

### UserBehaviorProfile
Stores aggregated user behavior patterns:
- Transaction patterns (avg, max, min amounts)
- Time patterns (preferred hours, days)
- Recipient patterns (frequent recipients with trust scores)
- Device patterns (trusted devices)
- Location patterns (trusted locations)
- Risk metrics

### Transaction
Stores transaction history with:
- Transaction details
- Device/location info
- Risk assessment results
- Behavioral features

### BehaviorEvent
Stores user events:
- Event type and category
- Device/location context
- Behavioral metrics
- Risk indicators

### FraudAlert
Stores security alerts:
- Alert type and severity
- Risk factors
- Re-auth status
- Resolution details

## ML Model Details

### Isolation Forest
- Ensemble method for anomaly detection
- No need for labeled data
- Fast prediction time
- Good for high-dimensional data

### Autoencoder (Optional)
- Deep learning approach
- Learns normal transaction patterns
- Detects deviations from learned patterns
- Requires TensorFlow

### Rule-Based Engine
Always active, checks for:
- Amount deviation > 3 standard deviations
- Late night transactions (12 AM - 6 AM)
- New recipient + high amount
- High transaction velocity (>5/hour)
- Multiple failed auth attempts
- Untrusted device/location

## Security Considerations

1. **Data Privacy**: All behavior data is stored securely and used only for fraud detection
2. **Encryption**: All API communication uses HTTPS
3. **No Sensitive Data**: PINs and passwords are never stored or transmitted in plain text
4. **Audit Trail**: All security events are logged
5. **Rate Limiting**: Recommended for production deployment

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
mongosh
# Or check Atlas connection string
```

### ML Model Not Loading
```bash
# Ensure models are trained
cd server/ml
python train_model.py --mode synthetic
```

### API Errors
Check server logs for detailed error messages:
```bash
npm run dev
# Watch for [FraudDetection] or [RiskScorer] logs
```

## Contributing

When adding new risk factors:
1. Add the factor analysis in `calculateTransactionRisk()`
2. Update risk weights if needed
3. Add corresponding event tracking
4. Update documentation

## License

MIT License - Part of KAVACH Banking Application
