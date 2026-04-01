# Stop any running Metro bundler
Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Write-Host "Building KAVACH Web Version..." -ForegroundColor Green
Set-Location $PSScriptRoot

# Build for web
npx expo export:web

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Build successful! Output in: web-build/" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. Install Vercel CLI: npm install -g vercel"
    Write-Host "2. Deploy: vercel --prod"
    Write-Host "3. Or upload web-build folder to Vercel/Netlify website"
} else {
    Write-Host "`n❌ Build failed" -ForegroundColor Red
}
