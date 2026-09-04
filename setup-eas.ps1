<#
.SYNOPSIS
    Mr LAD - EAS CLI Setup Script for Windows
.DESCRIPTION
    Installs EAS CLI globally and verifies Expo and Apple Developer authentication.
#>

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "        Mr LAD - EAS CLI Cloud Build Setup (Windows)      " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Checking Node.js and NPM..." -ForegroundColor Green
node -v
npm -v

Write-Host "`n[2/3] Installing/Updating eas-cli globally..." -ForegroundColor Green
npm install -g eas-cli

Write-Host "`n[3/3] Checking Expo login status..." -ForegroundColor Green
eas whoami

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n⚠️ You are not logged into Expo. Please log in below:" -ForegroundColor Yellow
    eas login
}

Write-Host "`n✅ Setup complete! You can now run:" -ForegroundColor Green
Write-Host "   .\build-ios.ps1" -ForegroundColor White
Write-Host "   or npm run build:ios" -ForegroundColor White
