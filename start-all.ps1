# ============================================================================
# KAVACH Complete App Startup Script
# Starts all services: Backend, Voice Server, and React Native App
# ============================================================================

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           KAVACH - Starting All Services                       ║" -ForegroundColor Cyan
Write-Host "║  Backend (Port 5000) | Voice Server (Port 3001) | Expo App    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Kill any existing Node processes
Write-Host "🔄 Clearing existing Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force 2>$null
Start-Sleep 1
Write-Host "✓ Node processes cleared" -ForegroundColor Green
Write-Host ""

# Check if MongoDB is running
Write-Host "📊 Checking MongoDB..." -ForegroundColor Yellow
$mongoRunning = Get-Process mongod -ErrorAction SilentlyContinue
if ($mongoRunning) {
    Write-Host "✓ MongoDB is already running" -ForegroundColor Green
}
else {
    Write-Host "⚠ MongoDB not running. Make sure it's started before continuing!" -ForegroundColor Yellow
    Write-Host "   Run with: mongod --dbpath=C:\data\db" -ForegroundColor Cyan
}
Write-Host ""

# Verify dependencies are installed
Write-Host "📦 Checking dependencies..." -ForegroundColor Yellow
if (!(Test-Path ".\node_modules")) {
    Write-Host "Installing main app dependencies..." -ForegroundColor Cyan
    npm install
}
if (!(Test-Path ".\backend\node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    cd backend
    npm install
    cd ..
}
if (!(Test-Path ".\server\node_modules")) {
    Write-Host "Installing voice server dependencies..." -ForegroundColor Cyan
    cd server
    npm install
    cd ..
}
Write-Host "✓ Dependencies ready" -ForegroundColor Green
Write-Host ""

# Start Backend Server
Write-Host "🚀 Starting Backend Server (Port 5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev" -WindowStyle Normal

Start-Sleep 5

# Start Voice Server
Write-Host "🎤 Starting Voice Server (Port 3001)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; npm run dev" -WindowStyle Normal

Start-Sleep 3

# Start React Native App with Expo
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           Starting React Native App with Expo                  ║" -ForegroundColor Green
Write-Host "║                                                                ║" -ForegroundColor Green
Write-Host "║  Press 'a' for Android Emulator                               ║" -ForegroundColor Green
Write-Host "║  Press 'i' for iOS Simulator                                  ║" -ForegroundColor Green
Write-Host "║  Press 'w' for Web                                            ║" -ForegroundColor Green
Write-Host "║  Scan QR code with Expo Go for physical device                ║" -ForegroundColor Green
Write-Host "║                                                                ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

npm start

# Cleanup message
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  All KAVACH services have been stopped                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
