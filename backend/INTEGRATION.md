# APP1 Intelligence Platform - Integration Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 14+
- MongoDB running
- Environment variables configured

### Installation

1. **Install new dependencies**
```bash
cd APP1/backend
npm install uuid
```

2. **Update .env file**
```env
# Existing variables
PORT=5000
MONGO_URI=mongodb://localhost:27017/kavach
JWT_SECRET=your-jwt-secret
NODE_ENV=development

# New optional variables for intelligence system
INTELLIGENCE_ENABLED=true
RISK_THRESHOLD_HIGH=70
RISK_THRESHOLD_MEDIUM=50
GRAPH_DB_TYPE=mongodb  # or neo4j if you want to use Neo4j
```

3. **Start the server**
```bash
npm run dev
```

---

## 📋 Integration Steps

### Step 1: Verify Models
All new models are automatically loaded by Mongoose when you start the server:
- Event.js
- RiskAssessment.js
- Case.js
- AutomationRule.js
- EntityRelationship.js
- Alert.js

### Step 2: Initialize Core Engines
The engines are initialized in routes but you can also initialize them globally:

```javascript
// In your server.js or a startup script
const RiskScoringEngine = require('./engines/risk-engine/RiskScoringEngine');
const EventCorrelationEngine = require('./engines/event-engine/EventCorrelationEngine');
const GraphEngine = require('./engines/graph-engine/GraphEngine');
const AutomationEngine = require('./engines/automation-engine/AutomationEngine');

global.riskEngine = new RiskScoringEngine();
global.eventEngine = new EventCorrelationEngine();
global.graphEngine = new GraphEngine();
global.automationEngine = new AutomationEngine(global.eventEngine, global.riskEngine);

console.log('✅ Intelligence engines initialized');
```

### Step 3: Integrate with Existing Routes

#### In Transaction Route (`routes/transactionRoutes.js`)
```javascript
const eventEngine = require('../engines/event-engine/EventCorrelationEngine');
const riskEngine = require('../engines/risk-engine/RiskScoringEngine');

// After transaction is created
router.post('/send', async (req, res) => {
  try {
    // ... existing transaction creation code ...
    
    const transaction = await Transaction.create({...});
    
    // NEW: Evaluate risk
    await riskEngine.evaluateTransactionRisk(transaction._id, transaction);
    
    // NEW: Create event
    await eventEngine.createEvent({
      eventType: 'transaction',
      userId: transaction.userId,
      deviceId: req.body.deviceId,
      transactionId: transaction._id,
      metadata: {amount: transaction.amount}
    });
    
    res.json({success: true, transaction});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});
```

#### In Auth Route (`routes/authRoutes.js`)
```javascript
// After successful login
router.post('/login', async (req, res) => {
  try {
    // ... existing auth code ...
    
    // NEW: Create login event
    await eventEngine.createEvent({
      eventType: 'login_attempt',
      userId: user._id,
      deviceId: req.body.deviceId,
      severity: loginAttempts > 2 ? 'high' : 'low',
      metadata: {
        loginAttempts,
        ipAddress: req.ip
      }
    });
    
    // NEW: Create relationship
    if (req.body.deviceId) {
      await graphEngine.createRelationship(
        {type: 'user', id: user._id},
        'uses',
        {type: 'device', id: req.body.deviceId}
      );
    }
    
    res.json({token, user});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});
```

### Step 4: Create Default Automation Rules

```javascript
// Run this script once to create default rules
// scripts/initialize-rules.js

const AutomationRule = require('../models/AutomationRule');

async function initializeDefaultRules() {
  try {
    // Rule 1: High-risk transaction
    await AutomationRule.create({
      ruleId: 'rule-high-risk-tx',
      name: 'Block High Risk Transactions',
      conditions: [
        {
          field: 'riskScore',
          operator: 'gte',
          value: 70
        }
      ],
      actions: [
        {
          actionType: 'block_transaction',
          enabled: true,
          priority: 1
        },
        {
          actionType: 'send_alert',
          parameters: {
            alertType: 'fraud_alert',
            severity: 'high'
          },
          priority: 2
        }
      ],
      isActive: true,
      priority: 100
    });

    // Rule 2: Multiple failed logins
    await AutomationRule.create({
      ruleId: 'rule-login-failures',
      name: 'Flag Account After Failed Logins',
      conditions: [
        {
          field: 'failed_login_attempts',
          operator: 'gte',
          value: 5
        }
      ],
      actions: [
        {
          actionType: 'flag_user',
          enabled: true
        },
        {
          actionType: 'send_alert',
          enabled: true
        }
      ],
      isActive: true,
      priority: 90
    });

    // Rule 3: Device sharing
    await AutomationRule.create({
      ruleId: 'rule-device-sharing',
      name: 'Alert on Device Sharing',
      conditions: [
        {
          field: 'device_user_count',
          operator: 'gte',
          value: 3
        }
      ],
      actions: [
        {
          actionType: 'send_alert',
          parameters: {severity: 'medium'},
          enabled: true
        }
      ],
      isActive: true,
      priority: 80
    });

    console.log('✅ Default rules created');
  } catch (error) {
    console.error('Error creating rules:', error);
  }
}
```

---

## 🔌 API Usage Examples

### 1. Evaluate Transaction Risk
```bash
POST /api/intelligence/risk/evaluate-transaction
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionId": "60d5ec49c1234567890abcde",
  "transaction": {
    "userId": "60d5ec49c1234567890abcde",
    "amount": 50000,
    "deviceId": "device-123",
    "location": {
      "city": "Delhi",
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  }
}

Response:
{
  "success": true,
  "assessment": {
    "assessmentId": "risk-uuid",
    "overallRiskScore": 65,
    "riskLevel": "high",
    "factors": [
      {
        "factorName": "transaction_amount",
        "weight": 0.15,
        "score": 7.5,
        "threshold": {low: 5000, medium: 25000},
        "currentValue": 50000,
        "reason": "Amount exceeds medium threshold"
      }
      // ... more factors
    ],
    "recommendedActions": [
      {
        "action": "flag_transaction",
        "confidence": 90,
        "reason": "High risk score"
      }
    ]
  }
}
```

### 2. Create Event
```bash
POST /api/intelligence/events/create
Authorization: Bearer <token>

{
  "eventType": "transaction",
  "userId": "60d5ec49c1234567890abcde",
  "deviceId": "device-123",
  "transactionId": "60d5ec49c1234567890abcde",
  "severity": "high",
  "metadata": {
    "amount": 50000,
    "recipient": "merchant@upi"
  }
}

Response:
{
  "success": true,
  "event": {
    "eventId": "evt-uuid",
    "eventType": "transaction",
    "userId": "60d5ec49c1234567890abcde",
    ...
  }
}
```

### 3. Correlate User Events
```bash
POST /api/intelligence/events/correlate/60d5ec49c1234567890abcde
Authorization: Bearer <token>

{
  "timeWindowHours": 24
}

Response:
{
  "success": true,
  "correlationCount": 5,
  "correlations": [
    {
      "event1Id": "6...",
      "event2Id": "7...",
      "similarity": 75,
      "pattern": "same_event_type + same_device + rapid_succession"
    }
    // ...
  ]
}
```

### 4. Create Case
```bash
POST /api/intelligence/cases/create
Authorization: Bearer <token>
X-Required-Role: analyst

{
  "title": "Suspicious Transaction Pattern",
  "description": "User made 5 large transactions in 2 hours",
  "caseType": "fraud",
  "severity": "high",
  "primaryUser": "60d5ec49c1234567890abcde"
}

Response:
{
  "success": true,
  "case": {
    "caseId": "case-uuid",
    "status": "open",
    "createdAt": "2024-03-31T..."
  }
}
```

### 5. Get Device Users (Graph Query)
```bash
GET /api/intelligence/graph/device/device-123/users
Authorization: Bearer <token>

Response:
{
  "success": true,
  "users": [
    {
      "userId": "60d5ec49c1234567890abcde",
      "frequency": 45,
      "lastUsed": "2024-03-31T..."
    },
    // ... more users
  ]
}
```

### 6. Detect Suspicious Patterns
```bash
GET /api/intelligence/events/patterns
Authorization: Bearer <token>

Response:
{
  "success": true,
  "patternCount": 3,
  "patterns": [
    {
      "patternType": "device_multiple_users",
      "severity": "high",
      "deviceId": "device-456",
      "userIds": ["user1", "user2", "user3"],
      "count": 12,
      "description": "Device used by 3 different users"
    },
    {
      "patternType": "rapid_event_sequence",
      "severity": "critical",
      "userId": "60d5ec49c1234567890abcde",
      "description": "User triggered 5 events in 2.5 minutes"
    }
    // ...
  ]
}
```

---

## 🔒 Security Considerations

### 1. Permission Checks
All intelligence endpoints check user roles:
```javascript
requireRole(['admin', 'analyst']) // Only admins/analysts can create cases
requirePermission('manage_alerts') // Specific permission required
```

### 2. Audit Logging
All actions are logged with:
- User ID
- Action type
- IP address
- Timestamp

### 3. Rate Limiting (Recommended Add)
```javascript
const rateLimit = require('express-rate-limit');

const intelligenceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many intelligence requests'
});

router.use(intelligenceLimiter);
```

---

## 📊 Monitoring & Debugging

### Check System Status
```bash
curl http://localhost:5000/
```

### View Recent Events
```bash
curl http://localhost:5000/api/intelligence/events/user/<userId> \
  -H "Authorization: Bearer <token>"
```

### Monitor Risk Scores
```bash
curl http://localhost:5000/api/intelligence/risk/assessment/<assessmentId> \
  -H "Authorization: Bearer <token>"
```

---

## ⚙️ Configuration Tips

### Risk Thresholds
Adjust in `RiskScoringEngine.js`:
```javascript
this.riskFactors.transaction_amount.thresholds = {
  low: 5000,      // Below this: 0 points
  medium: 25000,  // Moderate: 50 points
  high: 100000    // High: 100 points
};
```

### Event Time Windows
```javascript
// Default 24 hours, adjust as needed
const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
```

### Automation Cooldown
```javascript
{
  cooldownSeconds: 300,  // Don't fire twice within 5 minutes
  maxActionsPerDay: 1000 // Cap daily executions
}
```

---

## 🧪 Testing

### Test Risk Engine
```javascript
const riskEngine = new RiskScoringEngine();

const result = await riskEngine.evaluateTransactionRisk(transactionId, {
  userId: 'test-user',
  amount: 100000,
  deviceId: 'new-device',
  location: {city: 'Mumbai'}
});

console.log(result); // Should show high risk score
```

### Test Event Correlation
```javascript
const eventEngine = new EventCorrelationEngine();

const patterns = await eventEngine.detectSuspiciousPatterns();
console.log(patterns); // Should show correlation alerts
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: "uuid module not found"
```bash
Solution: npm install uuid
```

**Issue**: "Intelligence routes not loading"
```javascript
Solution: Check intelligenceRoutes.js is properly exported
// Verify in routes/intelligenceRoutes.js
module.exports = router; // exists at end
```

**Issue**: "Risk score always 0"
```javascript
Solution: Ensure transaction object has required fields
// Required: userId, amount, deviceId, location
```

---

## ✅ Validation Checklist

Before going to production:

- [ ] All models created in MongoDB
- [ ] Default automation rules initialized
- [ ] RBAC permissions configured
- [ ] JWT tokens working
- [ ] Event creation working in transaction flow
- [ ] Risk scoring returning accurate scores
- [ ] Case creation operational
- [ ] Graph relationships being tracked
- [ ] API endpoints responding correctly
- [ ] Error handling in place
- [ ] Audit logging functioning
- [ ] Database backups configured

---

## 📚 Next Steps

1. **Test with existing transactions**
   - Create transactions
   - Verify risk scores
   - Check event creation

2. **Set up automation rules**
   - Initialize default rules
   - Test rule triggering

3. **Create test cases**
   - Create suspicious activity
   - Verify case creation
   - Test analyst workflow

4. **Monitor and tune**
   - Adjust risk factors
   - Fine-tune thresholds
   - Analyze false positives

