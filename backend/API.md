# APP1 Intelligence API Documentation

## 🔍 Overview

The Intelligence Platform API provides comprehensive endpoints for:
- Risk assessment and scoring
- Event tracking and correlation
- Case management
- Knowledge graph queries
- Automation rule management

**Base URL**: `http://localhost:5000/api/intelligence`

---

## 🔑 Authentication

All endpoints require JWT token in Authorization header:

```
Authorization: Bearer <jwt_token>
```

Obtain token from:
```
POST /api/auth/login
```

---

## 📊 Risk Management Endpoints

### Evaluate Transaction Risk

**Endpoint**:
```
POST /api/intelligence/risk/evaluate-transaction
```

**Permissions**: `manage_alerts`

**Request Body**:
```json
{
  "transactionId": "60d5ec49c1234567890abcde",
  "transaction": {
    "userId": "user-id",
    "amount": 50000,
    "recipientUPI": "merchant@upi",
    "deviceId": "device-123",
    "location": {
      "city": "Delhi",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "ipAddress": "192.168.1.1"
    }
  }
}
```

**Response**:
```json
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
        "threshold": {"low": 5000, "medium": 25000, "high": 100000},
        "currentValue": 50000,
        "reason": "Amount exceeds medium threshold"
      },
      {
        "factorName": "new_device",
        "weight": 0.12,
        "score": 4.8,
        "currentValue": "new",
        "reason": "Device not registered for this user"
      }
    ],
    "recommendedActions": [
      {
        "action": "flag_transaction",
        "confidence": 90,
        "reason": "High risk score exceeds 70 threshold"
      },
      {
        "action": "request_verification",
        "confidence": 75,
        "reason": "Multiple risk factors detected"
      }
    ]
  }
}
```

### Evaluate User Risk

**Endpoint**:
```
POST /api/intelligence/risk/evaluate-user
```

**Permissions**: Admin, Analyst

**Request Body**:
```json
{
  "userId": "60d5ec49c1234567890abcde"
}
```

**Response**:
```json
{
  "success": true,
  "assessment": {
    "assessmentId": "risk-uuid",
    "overallRiskScore": 35,
    "riskLevel": "medium",
    "factors": [
      {
        "factorName": "account_age_days",
        "weight": 0.08,
        "score": 2.0,
        "currentValue": 45,
        "reason": "Account is 45 days old"
      },
      {
        "factorName": "failed_login_attempts",
        "weight": 0.1,
        "score": 4.0,
        "currentValue": 3,
        "reason": "3 failed login attempts"
      }
    ]
  }
}
```

### Get Risk Assessment

**Endpoint**:
```
GET /api/intelligence/risk/assessment/{assessmentId}
```

**Permissions**: `view_cases`

**Response**:
```json
{
  "assessmentId": "risk-uuid",
  "entityType": "transaction",
  "entityId": "60d5ec49c1234567890abcde",
  "overallRiskScore": 65,
  "riskLevel": "high",
  "factors": [...],
  "rulesApplied": [...],
  "recommendedActions": [...]
}
```

---

## 📝 Event Management Endpoints

### Create Event

**Endpoint**:
```
POST /api/intelligence/events/create
```

**Request Body**:
```json
{
  "eventType": "transaction",
  "userId": "60d5ec49c1234567890abcde",
  "deviceId": "device-123",
  "transactionId": "60d5ec49c1234567890abcde",
  "description": "Large transaction detected",
  "severity": "high",
  "metadata": {
    "amount": 50000,
    "recipient": "merchant@upi",
    "method": "upi"
  },
  "ipAddress": "192.168.1.1",
  "location": {
    "city": "Delhi",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "country": "India"
  }
}
```

**Response**:
```json
{
  "success": true,
  "event": {
    "eventId": "evt-uuid",
    "eventType": "transaction",
    "userId": "60d5ec49c1234567890abcde",
    "deviceId": "device-123",
    "severity": "high",
    "riskScore": 0,
    "riskLevel": "low",
    "timestamp": "2024-03-31T10:00:00Z"
  }
}
```

### Get User Events

**Endpoint**:
```
GET /api/intelligence/events/user/{userId}
```

**Query Parameters**:
- `limit` (default: 100) - Maximum events to return
- `status` - Filter by status (pending, analyzed, correlated, actioned)

**Response**:
```json
{
  "success": true,
  "count": 25,
  "events": [
    {
      "eventId": "evt-uuid",
      "eventType": "transaction",
      "timestamp": "2024-03-31T10:00:00Z",
      "severity": "high",
      "riskScore": 65,
      "status": "analyzed"
    }
  ]
}
```

### Correlate User Events

**Endpoint**:
```
POST /api/intelligence/events/correlate/{userId}
```

**Request Body**:
```json
{
  "timeWindowHours": 24
}
```

**Response**:
```json
{
  "success": true,
  "correlationCount": 5,
  "correlations": [
    {
      "event1Id": "evt-1",
      "event2Id": "evt-2",
      "event1EventType": "transaction",
      "event2EventType": "login_attempt",
      "similarity": 75,
      "pattern": "same_device + rapid_succession"
    }
  ]
}
```

### Detect Suspicious Patterns

**Endpoint**:
```
GET /api/intelligence/events/patterns
```

**Response**:
```json
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
      "userId": "user-id",
      "eventCount": 5,
      "timeframeMinutes": 2.5,
      "description": "User triggered 5 events in 2.5 minutes"
    }
  ]
}
```

---

## 📋 Case Management Endpoints

### Create Case

**Endpoint**:
```
POST /api/intelligence/cases/create
```

**Permissions**: Admin, Analyst

**Request Body**:
```json
{
  "title": "Suspicious Transaction Pattern",
  "description": "User made 5 large transactions in 2 hours",
  "caseType": "fraud",
  "severity": "high",
  "primaryUser": "60d5ec49c1234567890abcde"
}
```

**Response**:
```json
{
  "success": true,
  "case": {
    "caseId": "case-uuid",
    "title": "Suspicious Transaction Pattern",
    "caseType": "fraud",
    "severity": "high",
    "status": "open",
    "primaryUser": "60d5ec49c1234567890abcde",
    "initiatedAt": "2024-03-31T10:00:00Z"
  }
}
```

### Get Cases

**Endpoint**:
```
GET /api/intelligence/cases
```

**Query Parameters**:
- `status` (default: "open") - open, investigating, escalated, resolved, closed

**Response**:
```json
{
  "success": true,
  "count": 12,
  "cases": [
    {
      "caseId": "case-uuid",
      "title": "...",
      "status": "open",
      "severity": "high",
      "involvedUsers": 3,
      "createdAt": "2024-03-31T..."
    }
  ]
}
```

### Get Case Details

**Endpoint**:
```
GET /api/intelligence/cases/{caseId}
```

**Response**:
```json
{
  "caseId": "case-uuid",
  "title": "Suspicious Transaction Pattern",
  "description": "...",
  "caseType": "fraud",
  "severity": "high",
  "status": "investigating",
  "primaryUser": {...},
  "involvedUsers": [...],
  "involvedTransactions": [...],
  "associatedEvents": [...],
  "evidence": [
    {
      "type": "transaction",
      "description": "Large payment of ₹100,000",
      "sourceEventId": "evt-123",
      "timestamp": "2024-03-31T..."
    }
  ],
  "assignedTo": [
    {
      "userId": "analyst-1",
      "role": "investigator"
    }
  ],
  "activityLog": [
    {
      "action": "case_created",
      "timestamp": "2024-03-31T...",
      "details": "Case created"
    }
  ]
}
```

### Update Case Status

**Endpoint**:
```
PUT /api/intelligence/cases/{caseId}/status
```

**Permissions**: Admin, Analyst

**Request Body**:
```json
{
  "status": "resolved",
  "notes": "Case closed - user account verified"
}
```

**Response**:
```json
{
  "success": true,
  "case": {
    "caseId": "case-uuid",
    "status": "resolved",
    "resolvedAt": "2024-03-31T10:30:00Z"
  }
}
```

### Add Evidence to Case

**Endpoint**:
```
POST /api/intelligence/cases/{caseId}/evidence
```

**Permissions**: Admin, Analyst

**Request Body**:
```json
{
  "type": "transaction",
  "description": "Suspicious payment to unknown recipient",
  "sourceEventId": "evt-123"
}
```

**Response**:
```json
{
  "success": true,
  "case": {
    "caseId": "case-uuid",
    "evidence": [
      {
        "type": "transaction",
        "description": "Suspicious payment to unknown recipient",
        "sourceEventId": "evt-123",
        "timestamp": "2024-03-31T10:30:00Z"
      }
    ]
  }
}
```

---

## 🔗 Knowledge Graph Endpoints

### Create Relationship

**Endpoint**:
```
POST /api/intelligence/graph/create-relationship
```

**Permissions**: Admin, Analyst

**Request Body**:
```json
{
  "sourceEntity": {
    "type": "user",
    "id": "60d5ec49c1234567890abcde"
  },
  "relationshipType": "uses",
  "targetEntity": {
    "type": "device",
    "id": "device-123"
  },
  "context": {
    "transactionId": "60d5ec49c1234567890abcde",
    "ipAddress": "192.168.1.1",
    "location": "Delhi"
  }
}
```

**Response**:
```json
{
  "success": true,
  "relationship": {
    "relationshipId": "rel-uuid",
    "sourceEntity": {...},
    "relationshipType": "uses",
    "targetEntity": {...},
    "strength": 1,
    "frequency": 1
  }
}
```

### Get User Devices

**Endpoint**:
```
GET /api/intelligence/graph/user/{userId}/devices
```

**Response**:
```json
{
  "success": true,
  "devices": [
    {
      "deviceId": "device-123",
      "frequency": 45,
      "lastUsed": "2024-03-31T10:00:00Z"
    },
    {
      "deviceId": "device-456",
      "frequency": 12,
      "lastUsed": "2024-03-30T15:00:00Z"
    }
  ]
}
```

### Get Device Users

**Endpoint**:
```
GET /api/intelligence/graph/device/{deviceId}/users
```

**Permissions**: Admin, Analyst

**Response**:
```json
{
  "success": true,
  "users": [
    {
      "userId": "60d5ec49c1234567890abcde",
      "frequency": 45,
      "lastUsed": "2024-03-31T10:00:00Z"
    }
  ]
}
```

### Find Suspicious Clusters

**Endpoint**:
```
GET /api/intelligence/graph/clusters
```

**Permissions**: Admin, Analyst

**Response**:
```json
{
  "success": true,
  "clusterCount": 2,
  "clusters": [
    {
      "type": "device_sharing",
      "entityId": "device-123",
      "entityType": "device",
      "involvedUsers": ["user1", "user2", "user3"],
      "severity": "high",
      "description": "Device shared by 3 users"
    }
  ]
}
```

### Get Graph Statistics

**Endpoint**:
```
GET /api/intelligence/graph/stats
```

**Permissions**: Admin, Analyst

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalRelationships": 1250,
    "relationshipsByType": [
      {
        "_id": "uses",
        "count": 800
      },
      {
        "_id": "performs",
        "count": 350
      }
    ],
    "flaggedRelationships": 15,
    "totalEntities": {
      "users": 150,
      "devices": 200,
      "transactions": 500
    }
  }
}
```

---

## ⚙️ Automation Endpoints

### Create Rule

**Endpoint**:
```
POST /api/intelligence/automation/rules
```

**Permissions**: Admin

**Request Body**:
```json
{
  "name": "Block High Risk Transactions",
  "description": "Automatically block transactions with risk score >= 70",
  "conditions": [
    {
      "field": "riskScore",
      "operator": "gte",
      "value": 70
    }
  ],
  "actions": [
    {
      "actionType": "block_transaction",
      "parameters": {},
      "priority": 1,
      "enabled": true
    },
    {
      "actionType": "send_alert",
      "parameters": {
        "alertType": "fraud_alert",
        "severity": "high"
      },
      "priority": 2,
      "enabled": true
    }
  ],
  "isActive": true,
  "priority": 100,
  "applicableEntityTypes": ["transaction"],
  "cooldownSeconds": 300,
  "maxActionsPerDay": 1000
}
```

**Response**:
```json
{
  "success": true,
  "rule": {
    "ruleId": "rule-uuid",
    "name": "Block High Risk Transactions",
    "isActive": true,
    "priority": 100
  }
}
```

### Get Active Rules

**Endpoint**:
```
GET /api/intelligence/automation/rules
```

**Permissions**: Admin, Analyst

**Response**:
```json
{
  "success": true,
  "count": 5,
  "rules": [
    {
      "ruleId": "rule-uuid",
      "name": "Block High Risk Transactions",
      "priority": 100,
      "isActive": true,
      "executionStats": {
        "totalExecutions": 45,
        "successfulExecutions": 43,
        "lastExecutedAt": "2024-03-31T10:00:00Z"
      }
    }
  ]
}
```

### Evaluate and Execute Rules

**Endpoint**:
```
POST /api/intelligence/automation/evaluate
```

**Permissions**: Admin, Analyst

**Request Body**:
```json
{
  "entityType": "transaction",
  "entityId": "60d5ec49c1234567890abcde",
  "eventType": "transaction",
  "riskScore": 75,
  "riskLevel": "high"
}
```

**Response**:
```json
{
  "success": true,
  "actionsExecuted": 2,
  "actions": [
    {
      "ruleId": "rule-uuid",
      "action": "block_transaction",
      "status": "success",
      "result": {
        "transactionId": "60d5ec49c1234567890abcde",
        "message": "Transaction blocked"
      }
    },
    {
      "ruleId": "rule-uuid",
      "action": "send_alert",
      "status": "success",
      "result": {
        "alertId": "alert-uuid",
        "message": "Alert created"
      }
    }
  ]
}
```

---

## ❌ Error Responses

All endpoints return error responses in this format:

```json
{
  "error": "Descriptive error message"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Server Error |

---

## 🔄 Rate Limiting

Recommended rate limits:
- Risk evaluation: 100 requests/minute/user
- Event creation: 500 requests/minute/user
- Case creation: 50 requests/minute/user

---

## 📝 Notes

- All timestamps are in ISO 8601 format (UTC)
- Risk scores range from 0-100
- All IDs are MongoDB ObjectId or UUID strings
- Unauthorized requests return 401
- Insufficient permissions return 403

