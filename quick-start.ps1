# 🚀 Quick Start Script for KAVACH

Write-Host "🎯 KAVACH Quick Start Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "📦 Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if MongoDB is installed
Write-Host "🗄️  Checking MongoDB..." -ForegroundColor Yellow
$mongoInstalled = Get-Command mongod -ErrorAction SilentlyContinue
if ($mongoInstalled) {
    Write-Host "✅ MongoDB found" -ForegroundColor Green
} else {
    Write-Host "⚠️  MongoDB not found. You'll need MongoDB to run the backend." -ForegroundColor Yellow
    Write-Host "   Download from: https://www.mongodb.com/try/download/community" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📥 Installing dependencies..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Install backend dependencies
Write-Host ""
Write-Host "🔧 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "❌ Backend installation failed" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

# Install frontend dependencies
Write-Host ""
Write-Host "📱 Installing frontend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend installation failed" -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
Write-Host ""
Write-Host "⚙️  Setting up environment..." -ForegroundColor Yellow
if (-not (Test-Path "backend/.env")) {
    Copy-Item "backend/.env.example" "backend/.env"
    Write-Host "✅ Created backend/.env file" -ForegroundColor Green
    Write-Host "⚠️  Please edit backend/.env and add your configuration" -ForegroundColor Yellow
} else {
    Write-Host "✅ backend/.env already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start MongoDB:" -ForegroundColor White
Write-Host "   mongod --dbpath=C:\data\db" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start the backend server:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. In a new terminal, start the Expo app:" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 For detailed instructions, see SETUP_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Happy coding!" -ForegroundColor Green
