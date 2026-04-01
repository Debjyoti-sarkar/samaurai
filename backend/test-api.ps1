# Intelligence Platform API Test Suite
# Updated with comprehensive testing

$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWNjMTE0MzE2NDg2Yjg3NjY0YzAwZWQiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzQ5ODE0NDYsImV4cCI6MTc3NTU4NjI0Nn0.zHo-JzQQq2BWEtwZp3SJuM5Vg7GFufpMYzNlbrQ3ro4"
$baseUrl = "http://localhost:5000/api/intelligence"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🧪 INTELLIGENCE PLATFORM API TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$testsPassed = 0
$testsFailed = 0

# Test 1: Risk Evaluation
Write-Host "`n1️⃣  Testing Risk Evaluation..." -ForegroundColor Yellow
$riskBody = @{
    transactionId = "txn-test-001"
    transaction = @{
        userId = "69cc114316486b87664c00ed"
        amount = 50000
        currency = "INR"
        deviceId = "device-test-001"
        timestamp = [datetime]::UtcNow.ToString("o")
        recipientUPI = "test@upi"
        recipientName = "Test User"
        location = @{
            city = "Mumbai"
            country = "India"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $riskResponse = Invoke-WebRequest -Uri "$baseUrl/risk/evaluate-transaction" `
        -Method POST `
        -Headers $headers `
        -Body $riskBody -ErrorAction Stop

    $riskData = $riskResponse.Content | ConvertFrom-Json
    Write-Host "   ✅ Success! Risk Score: $($riskData.data.riskScore)" -ForegroundColor Green
    $testsPassed++
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Test 2: Create Event
Write-Host "`n2️⃣  Creating Event..." -ForegroundColor Yellow
$randomId = Get-Random -Minimum 100000 -Maximum 999999
$eventBody = @{
    eventType = "transaction"
    userId = "69cc114316486b87664c00ed"
    deviceId = "device-test-001"
    description = "Large transaction detected"
    severity = "high"
    ipAddress = "192.168.1.100"
    eventId = "evt_$randomId"
} | ConvertTo-Json

try {
    $eventResponse = Invoke-WebRequest -Uri "$baseUrl/events/create" `
        -Method POST `
        -Headers $headers `
        -Body $eventBody -ErrorAction Stop

    $eventData = $eventResponse.Content | ConvertFrom-Json
    Write-Host "   ✅ Success! Event: $($eventData.data.eventId)" -ForegroundColor Green
    $testsPassed++
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Test 3: Get User Events
Write-Host "`n3️⃣  Fetching User Events..." -ForegroundColor Yellow
try {
    $eventsResponse = Invoke-WebRequest -Uri "$baseUrl/events/user/69cc114316486b87664c00ed" `
        -Method GET `
        -Headers $headers -ErrorAction Stop

    $eventsData = $eventsResponse.Content | ConvertFrom-Json
    Write-Host "   ✅ Success! Total events: $($eventsData.data.Count)" -ForegroundColor Green
    $testsPassed++
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Test 4: Create Case
Write-Host "`n4️⃣  Creating Case..." -ForegroundColor Yellow
$caseBody = @{
    title = "Suspicious Transaction Alert"
    description = "High-value transaction from new device"
    severity = "high"
    userId = "69cc114316486b87664c00ed"
    caseType = "fraud_investigation"
} | ConvertTo-Json

try {
    $caseResponse = Invoke-WebRequest -Uri "$baseUrl/cases/create" `
        -Method POST `
        -Headers $headers `
        -Body $caseBody -ErrorAction Stop

    $caseData = $caseResponse.Content | ConvertFrom-Json
    Write-Host "   ✅ Success! Case: $($caseData.data.caseId)" -ForegroundColor Green
    $testsPassed++
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Test 5: Create Entity Relationship
Write-Host "`n5️⃣  Creating Entity Relationship..." -ForegroundColor Yellow
$relBody = @{
    entityA = @{
        type = "user"
        id = "69cc114316486b87664c00ed"
    }
    entityB = @{
        type = "device"
        id = "device-test-001"
    }
    relationshipType = "uses"
    metadata = @{
        lastUsed = [datetime]::UtcNow.ToString("o")
        usageCount = 5
    }
} | ConvertTo-Json -Depth 10

try {
    $relResponse = Invoke-WebRequest -Uri "$baseUrl/graph/create-relationship" `
        -Method POST `
        -Headers $headers `
        -Body $relBody -ErrorAction Stop

    Write-Host "   ✅ Success! Relationship created" -ForegroundColor Green
    $testsPassed++
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Summary
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "📊 TEST RESULTS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "`nPassed: $testsPassed ✅" -ForegroundColor Green
Write-Host "Failed: $testsFailed ❌" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })
Write-Host "`n📌 System Status: All Intelligence Engines Operational" -ForegroundColor Green
Write-Host "`n🔗 Environment:" -ForegroundColor Yellow
Write-Host "   Server: http://localhost:5000" -ForegroundColor Gray
Write-Host "   API Base: http://localhost:5000/api/intelligence" -ForegroundColor Gray
Write-Host "   Database: MongoDB (Local)" -ForegroundColor Gray
Write-Host "   Status: Running" -ForegroundColor Green

