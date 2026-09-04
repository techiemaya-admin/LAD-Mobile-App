$ErrorActionPreference = "Stop"
Set-Location "C:\Users\patta\LAD-App"
$env:NODE_ENV = "production"
Set-Location "C:\Users\patta\LAD-App\android"
.\gradlew.bat :app:assembleRelease
$apkPath = "C:\Users\patta\LAD-App\android\app\build\outputs\apk\release\MR LAD.apk"
Write-Host "APK ready: $apkPath"
