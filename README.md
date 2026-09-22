# HealthEntry

HealthEntry is an Android-first React Native app for quickly writing water,
caffeine, weight, and blood pressure entries to the user's system health store. Health Connect
is the source of truth; the app does not keep health history.

A small entry screen for writing health data into the system health store. The app owns no health history and has no backend, accounts, analytics, or charts.

Current implementation: real Android water, caffeine, weight, and blood pressure entry; tiny local weight preferences; and three independent 1x1 Android widgets using a compact translucent entry Activity (Water, Coffee, and Weight). No iOS health implementation or widget background writes. Only the preferred unit and last successfully submitted weight are retained locally, with no health history.

See [HOME_AND_WIDGET.md](HOME_AND_WIDGET.md) for behavior, architecture, files, verification, and remaining device tests. The preserved [hydration spike notes](HYDRATION_SPIKE.md) include device setup and independent record verification.

## Run

Use Node >=22.11, JDK 17, and the Android SDK configured for this repository. Install dependencies with `npm ci`, start Metro with `npm start`, then run `npm run android` with an emulator or connected device. This debug APK requires Metro.

## Checks

```powershell
npx tsc --noEmit
npm run lint
npm test -- --runInBand --watch=false
cd android
.\gradlew.bat :app:assembleDebug --console=plain
```

Run `git diff --check` from the root. No physical-device tests have been performed for this iteration.
