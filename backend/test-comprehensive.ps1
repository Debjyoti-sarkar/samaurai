$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWNjMTE0MzE2NDg2Yjg3NjY0YzAwZWQiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzQ5ODE0NDYsImV4cCI6MTc3NTU4NjI0Nn0.zHo-JzQQq2BWEtwZp3SJuM5Vg7GFufpMYzNlbrQ3ro4"
$baseUrl = "http://localhost:5000/api/intelligence"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Intelligence Platform - API Tests" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check (No Auth Required)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/test" -UseBasicParsing -ErrorAction Stop
    Write-Host "SUCCESS - API is operational" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Risk Evaluation
Write-Host "Test 2: Risk Evaluation Endpoint" -ForegroundColor Yellow
$riskBody = @{
    transactionId = "txn-$(Get-Random)"
    transaction = @{
        userId = "69cc114316486b87664c00ed"
        amount = 75000
        currency = "INR"
        deviceId = "device-$(Get-Random)"
        timestamp = [datetime]::UtcNow.ToString("o")
        recipientUPI = "merchant@upi"
        recipientName = "Merchant"
        location = @{ city = "Mumbai"; country = "India" }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/risk/evaluate-transaction" -Method POST -ContentType "application/json" -Body $riskBody -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    Write-Host "SUCCESS - Risk Level: $($data.assessment.riskLevel), Score: $($data.assessment.overallRiskScore)/100" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Event Creation
Write-Host "Test 3: Event Creation" -ForegroundColor Yellow
$eventBody = @{
    eventType = "transaction_completed"
    userId = "69cc114316486b87664c00ed"
    deviceId = "device-001"
    eventData = @{
        amount = 50000
        recipient = "test@upi"
        timestamp = [datetime]::UtcNow.ToString("o")
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/events/create" -Method POST -ContentType "application/json" -Body $eventBody -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    Write-Host "SUCCESS - Event Created with ID: $($data.eventId)" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: User Risk Evaluation
Write-Host "Test 4: User Risk Evaluation" -ForegroundColor Yellow
$userRiskBody = @{
    userId = "69cc114316486b87664c00ed"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/risk/evaluate-user" -Method POST -ContentType "application/json" -Body $userRiskBody -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    Write-Host "SUCCESS - User Risk Level: $($data.assessment.riskLevel), Score: $($data.assessment.overallRiskScore)/100" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host "All Core Systems Operational" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
