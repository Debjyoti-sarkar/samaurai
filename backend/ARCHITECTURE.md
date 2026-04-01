# APP1 Intelligence Platform - Architecture Overview

## 📋 Overview

APP1 has been evolved into a **lightweight OpenCTI-inspired security intelligence platform** with fraud detection, event correlation, knowledge graphs, and automated response capabilities.

### Version
**2.0.0** - Intelligence Platform Edition

---

## 🏗️ Architecture Layers

### 1. **Data Access Layer (Repositories)**
- `EventRepository` - Event data access
- `CaseRepository` - Case data access  
- `RiskAssessmentRepository` - Risk data access

### 2. **Business Logic Layer (Services & Engines)**

#### Risk Scoring Engine (`/engines/risk-engine`)
Evaluates risk for:
- **Transactions**: Amount, device, location, velocity
- **Users**: Account age, login failures, device diversity
- **Sessions**: Location changes, rapid activities

**Risk Factors**:
- Transaction amount (15% weight)
- New device (12% weight)
- Unusual location (15% weight)
- Failed login attempts (10% weight)
- Account age (8% weight)
- Transaction frequency (10% weight)
- Device sharing (10% weight)

**Output**: Risk score (0-100), Risk level (low/medium/high/critical), Detailed breakdown

#### Event Correlation Engine (`/engines/event-engine`)
Tracks and correlates:
- Login attempts
- Transactions
- Device usage
- API calls
- Biometric events

**Pattern Detection**:
- Device usage across multiple accounts
- Rapid event sequences (5+ events in 5 minutes)
- Location jumping (impossible travel)
- Same device different locations

#### Knowledge Graph Engine (`/engines/graph-engine`)
Relationship mapping:
- User → Uses → Device
- User → Performs → Transaction
- Device → Generated → Event
- Session → Initiated → Device

**Features**:
- Multi-hop relationship queries
- Suspicious cluster detection
- Shortest path analysis

#### Automation Engine (`/engines/automation-engine`)
Rule-based action execution:
- **Actions**: Block transaction, flag user, send alert, create case
- **Triggers**: Risk thresholds, event patterns, behavioral anomalies
- **Conditions**: Risk score > X, Failure count >= Y, etc.

---

## 📊 Data Models

### New Models Added

#### Event
```javascript
{
  eventId: String (unique),
  eventType: enum [login, transaction, device_used, otp, fraud_alert, etc.],
  userId: ObjectId,
  deviceId: String,
  severity: enum [low, medium, high, critical],
  riskScore: 0-100,
  riskLevel: enum [low, medium, high, critical],
  correlatedEvents: [{ eventId, similarity }],
  timestamp: Date
}
```

#### RiskAssessment
```javascript
{
  assessmentId: String (unique),
  entityType: enum [user, transaction, device, session],
  entityId: ObjectId,
  overallRiskScore: Number (0-100),
  riskLevel: enum [low, medium, high, critical],
  riskFactors: [{
    factorName, weight, score, currentValue, reason
  }],
  recommendedActions: [{action, confidence}],
  timestamp: Date
}
```

#### Case
```javascript
{
  caseId: String (unique),
  caseType: enum [fraud, account_takeover, suspicious_activity],
  severity: enum [low, medium, high, critical],
  status: enum [open, investigating, escalated, resolved],
  primaryUser: ObjectId,
  involvedUsers: [{ userId, role }],
  involvedTransactions: [ObjectId],
  associatedEvents: [ObjectId],
  evidence: [{type, description, sourceEventId}],
  assignedTo: [{ userId, role }],
  activityLog: [{action, actor, timestamp, details}],
  resolution: { outcome, notes, actions }
}
```

#### AutomationRule
```javascript
{
  ruleId: String (unique),
  name: String,
  triggers: [{eventType, condition, value}],
  conditions: [{field, operator, value}],
  actions: [{
    actionType: enum [block_transaction, flag_user, send_alert, create_case, etc.],
    parameters: Object
  }],
  isActive: Boolean,
  priority: Number,
  executionStats: {totalExecutions, successfulExecutions, lastExecutedAt}
}
```

#### EntityRelationship (Knowledge Graph)
```javascript
{
  relationshipId: String (unique),
  sourceEntity: {type, id},
  relationshipType: enum [uses, performs, receives, owns, etc.],
  targetEntity: {type, id},
  strength: 0-1,
  frequency: Number,
  flagged: Boolean,
  riskReason: String
}
```

#### Alert
```javascript
{
  alertId: String (unique),
  alertType: enum [fraud, anomaly, rule_violation, verification_required],
  severity: enum [low, medium, high, critical],
  triggerSource: enum [automation_rule, manual, ml_model, analyst],
  primaryUserId: ObjectId,
  status: enum [new, acknowledged, investigating, resolved],
  title: String,
  message: String,
  recommendedActions: [String],
  escalated: Boolean
}
```

#### Updated User Model
- **RBAC Fields**: `role` (user/analyst/admin), `permissions`
- **Risk Fields**: `riskScore`, `riskLevel`, `accountStatus`
- **Device Tracking**: `registeredDevices` with device history
- **Behavioral**: `failedLoginAttempts`, `behaviorProfile`

---

## 🔐 Role-Based Access Control (RBAC)

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Manage users, rules, cases, view analytics, export data |
| **Analyst** | View/update cases, manage alerts, create cases |
| **User** | View own profile, transactions, alerts |
| **System** | Full access (internal) |

### Middleware
- `authenticateToken` - JWT verification
- `requireRole(roles)` - Role check
- `requirePermission(permission)` - Permission check
- `auditLog(action)` - Access logging

---

## 🔄 Integration Points with Existing Code

### Transaction System
```javascript
// Risk evaluation automatically triggered
POST /api/transactions/send
→ Risk Engine evaluates transaction
→ Creates Event (transaction_type)
→ Creates EntityRelationship (user performs transaction)
→ Checks automation rules
→ May block transaction if high risk
```

### User Authentication
```javascript
// Event created on login
POST /api/auth/login
→ Event Engine creates login_attempt event
→ Risk Engine checks failure attempts
→ May flag account if multiple failures
→ Creates EntityRelationship (user logs in from device)
```

### Device Tracking
```javascript
// When transaction occurs
deviceId tracked → GraphEngine creates relationship
→ Detects device sharing across accounts
→ Alerts if suspicious clustering
```

---

## 🚀 API Endpoints

### Risk Evaluation
```
POST /api/intelligence/risk/evaluate-transaction
POST /api/intelligence/risk/evaluate-user
GET  /api/intelligence/risk/assessment/:assessmentId
```

### Events
```
POST /api/intelligence/events/create
GET  /api/intelligence/events/user/:userId
POST /api/intelligence/events/correlate/:userId
GET  /api/intelligence/events/patterns
```

### Cases
```
POST /api/intelligence/cases/create
GET  /api/intelligence/cases
GET  /api/intelligence/cases/:caseId
PUT  /api/intelligence/cases/:caseId/status
POST /api/intelligence/cases/:caseId/evidence
```

### Knowledge Graph
```
POST /api/intelligence/graph/create-relationship
GET  /api/intelligence/graph/user/:userId/devices
GET  /api/intelligence/graph/device/:deviceId/users
GET  /api/intelligence/graph/clusters
GET  /api/intelligence/graph/stats
```

### Automation
```
POST /api/intelligence/automation/rules
GET  /api/intelligence/automation/rules
POST /api/intelligence/automation/evaluate
```

---

## 📁 Folder Structure

```
backend/
├── engines/
│   ├── risk-engine/
│   │   └── RiskScoringEngine.js
│   ├── event-engine/
│   │   └── EventCorrelationEngine.js
│   ├── automation-engine/
│   │   └── AutomationEngine.js
│   └── graph-engine/
│       └── GraphEngine.js
│
├── repositories/
│   ├── EventRepository.js
│   ├── CaseRepository.js
│   └── RiskAssessmentRepository.js
│
├── services/
│   └── caseManagementService.js
│
├── middleware/
│   └── rbac.js (NEW)
│
├── models/
│   ├── Event.js (NEW)
│   ├── RiskAssessment.js (NEW)
│   ├── Case.js (NEW)
│   ├── AutomationRule.js (NEW)
│   ├── EntityRelationship.js (NEW)
│   ├── Alert.js (NEW)
│   └── User.js (UPDATED)
│   └── Transaction.js (UPDATED)
│
├── routes/
│   └── intelligenceRoutes.js (NEW)
│
└── server.js (UPDATED)
```

---

## 💡 Use Cases

### 1. Fraud Detection Flow
```
Transaction Created
→ Risk Engine scores transaction (Amount, device, location)
→ Event Engine correlates with similar events
→ AutomationRule triggers if score > 70
→ Action: Block transaction, create case, send alert
```

### 2. Account Takeover Detection
```
Multiple failed logins detected
→ Risk Engine increases user risk score
→ Event correlation detects rapid login attempts
→ GraphEngine detects new device usage
→ AutomationRule triggers account suspension
→ Case created for analyst review
```

### 3. Device Abuse Detection
```
GraphEngine detects device used by multiple users
→ Risk alert generated
→ Case created for investigation
→ Related transactions pulled for review
```

---

## 🔧 Future Enhancements

### AI/ML Integrations
- [ ] ML-based anomaly detection
- [ ] Behavioral biometrics
- [ ] Deep learning fraud classifier

### Advanced Analytics
- [ ] Risk prediction models
- [ ] Trend analysis
- [ ] Forecasting models

### Scalability
- [ ] Move graph data to Neo4j for complex queries
- [ ] Event streaming (Kafka)
- [ ] Distributed automation engine

### Dashboard
- [ ] Real-time risk dashboard
- [ ] Case management UI
- [ ] Graph visualization
- [ ] Alert management

---

## 📚 Documentation Files

1. **ARCHITECTURE.md** (this file) - System design
2. **INTEGRATION.md** - Integration steps
3. **API.md** - API documentation
4. **SETUP.md** - Installation guide

---

## ✅ Validation Checklist

- [x] Risk scoring engine implemented
- [x] Event correlation working
- [x] Knowledge graph relationships tracked
- [x] Automation rules executable
- [x] RBAC implemented
- [x] Case management system
- [x] API endpoints created
- [x] Models integrated with existing code
- [ ] Integration testing
- [ ] Production deployment

