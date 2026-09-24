$ErrorActionPreference = "Stop"

Write-Host "`n=== Health Entry: Pull / Build / Install ===" -ForegroundColor Cyan

$ProjectRoot = "C:\a\quick-health-input"
$PackageName = "com.cleanutilityapps.healthentry"
$TargetBranch = "main"

Set-Location $ProjectRoot

# 1. Require a clean worktree and main branch.
Write-Host "`n[1/5] Checking branch and worktree..." -ForegroundColor Yellow

$changes = git status --porcelain
if ($LASTEXITCODE -ne 0) {
    throw "git status failed."
}
if ($changes) {
    Write-Host "Local changes detected:" -ForegroundColor Red
    $changes | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    throw "Worktree is not clean. Commit or stash local changes before building."
}

$branch = git branch --show-current
if ($LASTEXITCODE -ne 0) {
    throw "Could not determine the current Git branch."
}
if ($branch -ne $TargetBranch) {
    Write-Host "Switching from $branch to $TargetBranch..." -ForegroundColor Yellow
    git switch $TargetBranch
    if ($LASTEXITCODE -ne 0) {
        throw "Could not switch to $TargetBranch."
    }
} else {
    Write-Host "Already on $TargetBranch." -ForegroundColor Green
}

# 2. Pull latest main.
Write-Host "`n[2/5] Pulling latest code..." -ForegroundColor Yellow
git pull --ff-only

if ($LASTEXITCODE -ne 0) {
    throw "git pull --ff-only failed."
}

# 3. Build release APK.
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

# 4. Verify Android device.
Write-Host "`n[4/5] Checking Android device..." -ForegroundColor Yellow

$devices = adb devices | Select-String "`tdevice$"
if (!$devices) {
    throw "No Android device found. Connect the phone and enable USB debugging."
}

Write-Host "Android device found." -ForegroundColor Green

# 5. Install/update and launch.
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
