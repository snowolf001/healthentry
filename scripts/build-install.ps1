$ErrorActionPreference = "Stop"

Write-Host "`n=== Health Entry: Pull / Build / Install ===" -ForegroundColor Cyan

# Project root
$ProjectRoot = "C:\a\quick-health-input"
$PackageName = "com.cleanutilityapps.healthentry"

Set-Location $ProjectRoot

# 1. Make sure we're on the feature branch
Write-Host "`n[1/5] Checking branch..." -ForegroundColor Yellow

$branch = git branch --show-current

if ($branch -ne "feature/move-exercise-entry") {
    Write-Host "Switching to feature/move-exercise-entry..."
    git checkout feature/move-exercise-entry
}

# 2. Pull latest code
Write-Host "`n[2/5] Pulling latest code..." -ForegroundColor Yellow
git pull

if ($LASTEXITCODE -ne 0) {
    throw "git pull failed."
}

# 3. Build release APK
Write-Host "`n[3/5] Building release APK..." -ForegroundColor Yellow

Set-Location "$ProjectRoot\android"

.\gradlew assembleRelease

if ($LASTEXITCODE -ne 0) {
    throw "Gradle build failed."
}

$Apk = "$ProjectRoot\android\app\build\outputs\apk\release\app-release.apk"

if (!(Test-Path $Apk)) {
    throw "APK not found: $Apk"
}

# 4. Verify Android device
Write-Host "`n[4/5] Checking Android device..." -ForegroundColor Yellow

$devices = adb devices |
    Select-String "`tdevice$"

if (!$devices) {
    throw "No Android device found. Connect the phone and enable USB debugging."
}

Write-Host "Android device found." -ForegroundColor Green

# 5. Install/update and launch
Write-Host "`n[5/5] Installing APK..." -ForegroundColor Yellow

adb install -r $Apk

if ($LASTEXITCODE -ne 0) {
    throw "APK installation failed."
}

Write-Host "`nLaunching Health Entry..." -ForegroundColor Yellow

adb shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host "`n======================================" -ForegroundColor Green
Write-Host " Health Entry installed successfully!" -ForegroundColor Green
Write-Host "======================================`n" -ForegroundColor Green
