$ErrorActionPreference = "Stop"
Set-Location "C:\Users\patta\LAD-App"
$env:NODE_ENV = "production"
Set-Location "C:\Users\patta\LAD-App\android"
.\gradlew.bat :app:bundleRelease
$aabPath = "C:\Users\patta\LAD-App\android\app\build\outputs\bundle\release\app-release.aab"
Write-Host "AAB ready: $aabPath"
