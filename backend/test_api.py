#!/usr/bin/env python3
"""
Intelligence Platform API Test Suite
Tests all core intelligence endpoints
"""

import requests
import json
from datetime import datetime
import random

# Configuration
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWNjMTE0MzE2NDg2Yjg3NjY0YzAwZWQiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzQ5ODE0NDYsImV4cCI6MTc3NTU4NjI0Nn0.zHo-JzQQq2BWEtwZp3SJuM5Vg7GFufpMYzNlbrQ3ro4"
BASE_URL = "http://localhost:5000/api/intelligence"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Track results
tests_passed = 0
tests_failed = 0

def print_header(text):
    print("\n" + "="*50)
    print(text)
    print("="*50)

def test_risk_evaluation():
    global tests_passed, tests_failed
    print("\nTest 1: Risk Evaluation")
    try:
        payload = {
            "transactionId": "txn-test-001",
            "transaction": {
                "userId": "69cc114316486b87664c00ed",
                "amount": 50000,
                "currency": "INR",
                "deviceId": "device-test-001",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "recipientUPI": "test@upi",
                "recipientName": "Test User",
                "location": {
                    "city": "Mumbai",
                    "country": "India"
                }
            }
        }
        
        response = requests.post(f"{BASE_URL}/risk/evaluate-transaction", 
                               json=payload, 
                               headers=HEADERS)
        
        if response.status_code in [200, 201]:
            data = response.json()
            risk_score = data.get("data", {}).get("riskScore", "N/A")
            print(f"   PASS: Risk Score = {risk_score}")
            tests_passed += 1
        else:
            print(f"   FAIL: Status {response.status_code}")
            print(f"   Response: {response.text}")
            tests_failed += 1
    except Exception as e:
        print(f"   FAIL: {str(e)}")
        tests_failed += 1

def test_create_event():
    global tests_passed, tests_failed
    print("\nTest 2: Create Event")
    try:
        event_id = f"evt_{random.randint(100000, 999999)}"
        payload = {
            "eventType": "transaction",
            "userId": "69cc114316486b87664c00ed",
            "deviceId": "device-test-001",
            "description": "Large transaction detected",
            "severity": "high",
            "ipAddress": "192.168.1.100",
            "eventId": event_id
        }
        
        response = requests.post(f"{BASE_URL}/events/create", 
                               json=payload, 
                               headers=HEADERS)
        
        if response.status_code in [200, 201]:
            data = response.json()
            returned_id = data.get("data", {}).get("eventId", "N/A")
            print(f"   PASS: Event Created = {returned_id}")
            tests_passed += 1
        else:
            print(f"   FAIL: Status {response.status_code}")
            print(f"   Response: {response.text}")
            tests_failed += 1
    except Exception as e:
        print(f"   FAIL: {str(e)}")
        tests_failed += 1

def test_get_user_events():
    global tests_passed, tests_failed
    print("\nTest 3: Get User Events")
    try:
        response = requests.get(f"{BASE_URL}/events/user/69cc114316486b87664c00ed", 
                              headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            count = len(data.get("data", []))
            print(f"   PASS: Found {count} events")
            tests_passed += 1
        else:
            print(f"   FAIL: Status {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"   FAIL: {str(e)}")
        tests_failed += 1

def test_create_case():
    global tests_passed, tests_failed
    print("\nTest 4: Create Case")
    try:
        payload = {
            "title": "Suspicious Transaction Alert",
            "description": "High-value transaction from new device",
            "severity": "high",
            "primaryUser": "69cc114316486b87664c00ed",
            "caseType": "fraud"
        }
        
        response = requests.post(f"{BASE_URL}/cases/create", 
                               json=payload, 
                               headers=HEADERS)
        
        if response.status_code in [200, 201]:
            data = response.json()
            case_id = data.get("data", {}).get("caseId", "N/A")
            print(f"   PASS: Case Created = {case_id}")
            tests_passed += 1
        else:
            print(f"   FAIL: Status {response.status_code}")
            print(f"   Response: {response.text}")
            tests_failed += 1
    except Exception as e:
        print(f"   FAIL: {str(e)}")
        tests_failed += 1

def test_create_relationship():
    global tests_passed, tests_failed
    print("\nTest 5: Create Entity Relationship")
    try:
        payload = {
            "sourceEntity": {
                "type": "user",
                "id": "69cc114316486b87664c00ed"
            },
            "relationshipType": "uses",
            "targetEntity": {
                "type": "device",
                "id": "device-test-001"
            },
            "context": {
                "lastUsed": datetime.utcnow().isoformat() + "Z",
                "usageCount": 5
            }
        }
        
        response = requests.post(f"{BASE_URL}/graph/create-relationship", 
                               json=payload, 
                               headers=HEADERS)
        
        if response.status_code in [200, 201]:
            print(f"   PASS: Relationship Created")
            tests_passed += 1
        else:
            print(f"   FAIL: Status {response.status_code}")
            print(f"   Response: {response.text}")
            tests_failed += 1
    except Exception as e:
        print(f"   FAIL: {str(e)}")
        tests_failed += 1

def main():
    print_header("INTELLIGENCE PLATFORM API TEST SUITE")
    
    test_risk_evaluation()
    test_create_event()
    test_get_user_events()
    test_create_case()
    test_create_relationship()
    
    print_header("TEST RESULTS")
    print(f"\nPassed: {tests_passed}")
    print(f"Failed: {tests_failed}")
    
    if tests_failed == 0:
        print("\nALL TESTS PASSED!")
        print("System Status: All Intelligence Engines Operational")
    else:
        print("\nSome tests failed. Check output above for details.")

if __name__ == "__main__":
    main()
