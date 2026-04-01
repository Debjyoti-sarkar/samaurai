# APP1 Intelligence Platform - Setup Guide

## ✅ System Requirements

- **Node.js**: v14 or higher
- **MongoDB**: v4.4 or higher
- **npm**: v6 or higher
- **Git**: For cloning repository

### Recommended Hardware
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 10GB+ free space

---

## 🚀 Installation Steps

### 1. Clone Repository

```bash
# If not already cloned
git clone https://github.com/Debjyoti-sarkar/APP1.git
cd APP1/backend
```

### 2. Install Dependencies

```bash
# Install Node packages
npm install

# Install new intelligence platform package
npm install uuid
```

### 3. Set Up Environment Variables

Create `.env` file in `APP1/backend`:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/kavach
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/dbname

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=7d

# OTP & SMS (Existing)
FAST2SMS_API_KEY=your_api_key
FAST2SMS_ROUTE=q
OTP_LENGTH=6
OTP_EXPIRY_SECONDS=300

# Intelligence Platform (New)
INTELLIGENCE_ENABLED=true
RISK_THRESHOLD_HIGH=70
RISK_THRESHOLD_MEDIUM=50
RISK_THRESHOLD_LOW=30

# Graph Database Type
# Options: mongodb (recommended for lightweight), neo4j (for complex graphs)
GRAPH_DB_TYPE=mongodb

# Logging
LOG_LEVEL=info
# Options: error, warn, info, debug
```

### 4. Start MongoDB

**Option A: Local MongoDB**
```bash
# On Windows
mongod

# On macOS (with Homebrew)
brew services start mongodb-community

# On Linux
sudo service mongod start
```

**Option B: MongoDB Atlas (Cloud)**
- Create account at https://www.mongodb.com/cloud/atlas
- Create cluster
- Get connection string
- Update MONGO_URI in .env

**Option C: Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. Verify MongoDB Connection

```bash
# Test connection
mongosh "mongodb://localhost:27017/kavach"

# Or with MongoDB Compass GUI
# Download from: https://www.mongodb.com/products/compass
```

### 6. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### Expected Output

```
🚀 KAVACH Backend Server started on port 5000
📊 Environment: development
🔗 API available at: http://localhost:5000
✅ Intelligence engines initialized
📊 MongoDB connected successfully
```

---

## 📊 Database Initialization

### Create Default Automation Rules

Create file: `APP1/backend/scripts/initialize-rules.js`

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const AutomationRule = require('../models/AutomationRule');

async function initializeDefaultRules() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Rule 1: Block High Risk Transactions
    await AutomationRule.create({
      ruleId: 'rule-high-risk-tx',
      name: 'Block High Risk Transactions',
      description: 'Blocks transactions with risk score >= 70',
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
          enabled: true,
          priority: 2
        }
      ],
      isActive: true,
      priority: 100,
      applicableEntityTypes: ['transaction']
    });

    // Rule 2: Flag Account on Login Failures
    await AutomationRule.create({
      ruleId: 'rule-login-failures',
      name: 'Flag Account After 5 Failed Logins',
      description: 'Flags user account after 5 failed login attempts',
      conditions: [
        {
          field: 'failedLoginAttempts',
          operator: 'gte',
          value: 5
        }
      ],
      actions: [
        {
          actionType: 'flag_user',
          enabled: true,
          priority: 1
        },
        {
          actionType: 'send_alert',
          parameters: {
            severity: 'high'
          },
          enabled: true,
          priority: 2
        }
      ],
      isActive: true,
      priority: 90,
      applicableEntityTypes: ['user']
    });

    // Rule 3: Alert on Device Sharing
    await AutomationRule.create({
      ruleId: 'rule-device-sharing',
      name: 'Alert on Device Sharing',
      description: 'Alerts when device is used by multiple accounts',
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
          parameters: {
            severity: 'medium'
          },
          enabled: true
        }
      ],
      isActive: true,
      priority: 80,
      applicableEntityTypes: ['device']
    });

    console.log('✅ Default automation rules created');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

initializeDefaultRules();
```

Run initialization:
```bash
node scripts/initialize-rules.js
```

### Create Test User with Analyst Role

```javascript
// scripts/create-test-user.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const hash = await bcryptjs.hash('analyst123', 10);
    
    const analyst = await User.create({
      phoneNumber: '9999999999',
      name: 'Test Analyst',
      pin: hash,
      role: 'analyst',
      permissions: ['view_cases', 'manage_alerts', 'create_cases'],
      emailVerified: true,
      phoneVerified: true
    });

    console.log('✅ Test analyst created');
    console.log('Phone: 9999999999');
    console.log('PIN: analyst123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestUser();
```

---

## 🧪 Testing the Installation

### 1. Health Check

```bash
curl http://localhost:5000/
```

Expected response:
```json
{
  "message": "KAVACH Backend API + Intelligence Platform",
  "version": "2.0.0",
  "status": "running"
}
```

### 2. Authentication Test

```bash
# Create test account
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "9876543210",
    "name": "Test User",
    "pin": "123456"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "9876543210",
    "pin": "123456"
  }'

# Save the returned token
TOKEN="your-jwt-token-here"
```

### 3. Create Event Test

```bash
curl -X POST http://localhost:5000/api/intelligence/events/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "transaction",
    "userId": "USER_ID_HERE",
    "deviceId": "device-test-123",
    "severity": "medium",
    "metadata": {
      "amount": 5000,
      "type": "test"
    }
  }'
```

### 4. Evaluate Risk Test

```bash
curl -X POST http://localhost:5000/api/intelligence/risk/evaluate-transaction \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TRANSACTION_ID",
    "transaction": {
      "userId": "USER_ID",
      "amount": 50000,
      "deviceId": "device-test-123",
      "location": {
        "city": "Delhi",
        "latitude": 28.6139,
        "longitude": 77.2090
      }
    }
  }'
```

---

## 📊 MongoDB Verification

### Check Collections Created

```bash
# Connect to MongoDB
mongosh

# Select database
use kavach

# List all collections
show collections

# Expected collections:
# - users
# - transactions
# - events
# - cases
# - automationrules
# - riskassessments
# - entityrelationships
# - alerts
```

### Verify Data

```bash
# Check events
db.events.find().limit(5)

# Check cases
db.cases.find().limit(5)

# Check automation rules
db.automationrules.find()
```

---

## 🔧 Configuration Fine-Tuning

### Adjust Risk Factors

Edit `engines/risk-engine/RiskScoringEngine.js`:

```javascript
this.riskFactors = {
  transaction_amount: {
    weight: 0.15,  // Increase for more weight
    thresholds: {
      low: 5000,
      medium: 25000,
      high: 100000
    }
  },
  // ... other factors
};
```

### Adjust Event Time Windows

Edit `engines/event-engine/EventCorrelationEngine.js`:

```javascript
// Default 24 hours
const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

// Change to 48 hours
const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
```

### Adjust Automation Cooldowns

Edit `models/AutomationRule.js`:

```javascript
cooldownSeconds: {
  type: Number,
  default: 300  // 5 minutes - adjust as needed
}
```

---

## 📝 Logging & Monitoring

### Enable Detailed Logging

Update `.env`:
```env
LOG_LEVEL=debug
```

### View Logs

```bash
# All logs
tail -f logs/app.log

# Error logs only
tail -f logs/error.log
```

### Monitor Database

Use MongoDB Compass:
1. Download from https://www.mongodb.com/products/compass
2. Connect to `mongodb://localhost:27017`
3. Monitor collections in real-time

---

## 🐛 Troubleshooting

### MongoDB Connection Error

**Error**: `MongooseError: Cannot connect to MongoDB`

**Solution**:
```bash
# Check if MongoDB is running
mongosh "mongodb://localhost:27017"

# If not running, start it
mongod

# Or use Docker
docker start mongodb
```

### Port Already in Use

**Error**: `Error: listen EADDRINUSE :::5000`

**Solution**:
```bash
# Change port in .env
PORT=5001

# Or kill process using port 5000
lsof -i :5000  # View process
kill -9 <PID>   # Kill process
```

### JWT Token Expired

**Error**: `Invalid or expired token`

**Solution**:
```bash
# Login again to get new token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "...", "pin": "..."}'
```

### Missing UUID Package

**Error**: `Cannot find module 'uuid'`

**Solution**:
```bash
npm install uuid
```

### Database Models Not Found

**Error**: `MongooseError: Cannot find model`

**Solution**:
```bash
# Ensure all models are imported in server.js
require('./models/Event');
require('./models/Case');
// ... etc
```

---

## 🔒 Security Checklist

Before production:

- [ ] Change JWT_SECRET to strong value
- [ ] Use MongoDB Atlas with authentication
- [ ] Enable HTTPS
- [ ] Implement rate limiting
- [ ] Set up API authentication
- [ ] Enable CORS only for trusted origins
- [ ] Use environment-specific configs
- [ ] Enable database backups
- [ ] Set up monitoring/alerts
- [ ] Implement audit logging

---

## 📦 Docker Deployment (Optional)

### Create Dockerfile

```dockerfile
FROM node:16

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

### Create docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:5.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  app:
    build: .
    environment:
      MONGO_URI: mongodb://admin:password@mongodb:27017/kavach
      PORT: 5000
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "5000:5000"
    depends_on:
      - mongodb

volumes:
  mongodb_data:
```

### Deploy with Docker

```bash
docker-compose up -d
```

---

## 📞 Support

### Common Commands

```bash
# Check server status
curl http://localhost:5000/health

# View recent logs
pm2 logs app

# Monitor CPU/Memory
pm2 monit
```

### Get Help

- GitHub Issues: https://github.com/Debjyoti-sarkar/APP1/issues
- Contact: [your-email@example.com]

---

## ✅ Post-Installation Checklist

- [ ] MongoDB running and connected
- [ ] All dependencies installed (`npm install`)
- [ ] .env file configured
- [ ] Server starting without errors
- [ ] Health check endpoint responding
- [ ] Database collections created
- [ ] Default automation rules initialized
- [ ] Test user created
- [ ] API endpoints accessible
- [ ] JWT authentication working

---

## 🎯 Next Steps

1. **Review Architecture**: Read [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Integration**: Follow [INTEGRATION.md](./INTEGRATION.md)
3. **API Usage**: Check [API.md](./API.md)
4. **Create Cases**: Start using the case management system
5. **Set Automation Rules**: Configure rules for your use cases

