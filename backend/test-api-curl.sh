#!/bin/bash
# Intelligence Platform API Test Suite (Bash for simplicity)

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWNjMTE0MzE2NDg2Yjg3NjY0YzAwZWQiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzQ5ODE0NDYsImV4cCI6MTc3NTU4NjI0Nn0.zHo-JzQQq2BWEtwZp3SJuM5Vg7GFufpMYzNlbrQ3ro4"
BASE_URL="http://localhost:5000/api/intelligence"

echo "=========================================="
echo "INTELLIGENCE PLATFORM API TEST"
echo "=========================================="
echo ""

# Test 1: Risk Evaluation
echo "Test 1: Risk Evaluation"
curl -s -X POST "$BASE_URL/risk/evaluate-transaction" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn-test-001",
    "transaction": {
      "userId": "69cc114316486b87664c00ed",
      "amount": 50000,
      "currency": "INR",
      "deviceId": "device-test-001",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "recipientUPI": "test@upi",
      "recipientName": "Test User",
      "location": {
        "city": "Mumbai",
        "country": "India"
      }
    }
  }' | python3 -m json.tool
echo ""
echo ""

# Test 2: Create Event
echo "Test 2: Create Event"
EVENT_ID="evt_$(shuf -i 100000-999999 -n 1)"
curl -s -X POST "$BASE_URL/events/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "transaction",
    "userId": "69cc114316486b87664c00ed",
    "deviceId": "device-test-001",
    "description": "Large transaction detected",
    "severity": "high",
    "ipAddress": "192.168.1.100",
    "eventId": "'$EVENT_ID'"
  }' | python3 -m json.tool
echo ""
echo ""

# Test 3: Get User Events
echo "Test 3: Get User Events"
curl -s -X GET "$BASE_URL/events/user/69cc114316486b87664c00ed" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""
echo ""

# Test 4: Create Case
echo "Test 4: Create Case"
curl -s -X POST "$BASE_URL/cases/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Suspicious Transaction Alert",
    "description": "High-value transaction from new device",
    "severity": "high",
    "userId": "69cc114316486b87664c00ed",
    "caseType": "fraud_investigation"
  }' | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "ALL TESTS COMPLETED"
echo "=========================================="
