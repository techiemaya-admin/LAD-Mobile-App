<#
.SYNOPSIS
    Mr LAD - iOS Cloud Build Script for Windows
.DESCRIPTION
    Triggers an EAS cloud build on Apple Mac M-series servers to produce signed iOS IPA or Simulator binaries without needing Xcode locally on Windows.
#>

$env:EAS_BUILD_NO_EXPO_GO_WARNING = "true"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "           Mr LAD - iOS Cloud Build (EAS Build)           " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Select the build profile you want to run:" -ForegroundColor Green
Write-Host "  [1] Preview IPA (Ad-hoc signed for testing on physical iPhones)" -ForegroundColor White
Write-Host "  [2] Production IPA (App Store / TestFlight signed release)" -ForegroundColor White
Write-Host "  [3] Development Simulator (Build for iOS Simulators)" -ForegroundColor White
Write-Host "  [4] Development Device Client (Debug build for physical iPhone)" -ForegroundColor White
Write-Host "  [Q] Quit" -ForegroundColor DarkGray
Write-Host ""

$choice = Read-Host "Enter choice (1-4 or Q) [default: 1]"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

switch ($choice) {
    "1" {
        Write-Host "`n🚀 Starting EAS Cloud Build for iOS Preview (.ipa)..." -ForegroundColor Cyan
        npx eas-cli build --platform ios --profile preview
    }
    "2" {
        Write-Host "`n🚀 Starting EAS Cloud Build for iOS Production (TestFlight / App Store)..." -ForegroundColor Cyan
        npx eas-cli build --platform ios --profile production
    }
    "3" {
        Write-Host "`n🚀 Starting EAS Cloud Build for iOS Simulator..." -ForegroundColor Cyan
        npx eas-cli build --platform ios --profile development
    }
    "4" {
        Write-Host "`n🚀 Starting EAS Cloud Build for iOS Development Client (Physical Device)..." -ForegroundColor Cyan
        npx eas-cli build --platform ios --profile development-device
    }
    "Q" {
        Write-Host "Exiting." -ForegroundColor Yellow
        exit 0
    }
    "q" {
        Write-Host "Exiting." -ForegroundColor Yellow
        exit 0
    }
    Default {
        Write-Host "Invalid option selected." -ForegroundColor Red
        exit 1
    }
}
