> Historical spike handoff, retained for setup and independent record verification. The current Home and widget implementation is documented in [HOME_AND_WIDGET.md](HOME_AND_WIDGET.md). The real hydration path now lives in `src/systemHealth/androidHealthConnect.ts`; `hydrationSpike.ts` is a compatibility facade. The old one-button UI and ID/timestamp success text described below have been replaced: use **+8 oz** and inspect the preserved development logs for timestamp/ID. **+12 oz** writes 354.9 mL through the same path. The historical checks below describe the earlier spike, not this iteration.
# Android hydration technical spike

This temporary app has one button, **Add 8 oz Water**. Each completed tap writes exactly 236.6 mL (approximately 8 US fl oz) directly to Health Connect. No health history is read or persisted by the app. No backend, authentication, analytics, other measurements, or iOS integration was added.

## Versions and integration choice

- React Native: 0.87.1, new architecture / Hermes enabled.
- compileSdk: 37; targetSdk: 36; minSdk: **26** (raised from 24 for Health Connect).
- Build tools: 37.0.0; existing Kotlin 2.2.0 and Gradle 9.4.1 retained.
- Pinned `react-native-health-connect@4.1.3`, published August 6, 2026. Recent 4.x releases, a native new-architecture implementation, typed hydration writes, and stable `androidx.health.connect:connect-client:1.1.0` make this a suitable maintained wrapper for the spike. No custom bridge or Expo dependency is needed.
- Sources: [maintainer releases](https://github.com/matinzd/react-native-health-connect/releases), [installation instructions](https://github.com/matinzd/react-native-health-connect#installation), [Android setup](https://developer.android.com/health-and-fitness/health-connect/get-started).

## Scope and behavior

Availability is checked when the button is pressed, before initialization and permission access. Unavailable and install/update-required statuses produce actionable text. After installing/updating Health Connect, return and tap again. No automatic write happens on launch or resume.

Each tap checks permission again and requests only `{accessType: 'write', recordType: 'Hydration'}` if needed. Denial/cancellation stops the write. A successful insert must return one nonempty record ID before the app displays success. The result is transient UI state, not stored history.

Hydration requires an interval: the record spans the one second ending at the current time **after permission has been granted**, uses explicit milliliters, and is marked as manual entry. No future timestamp is used. Rapid concurrent taps are suppressed. A later tap intentionally creates another record. There are no automatic retries; if a write fails ambiguously, inspect Health Connect before retrying.

Development-only `[HydrationSpike]` logs include availability, initialization, permission state/request/result, write payload, returned IDs, and errors. View them in React Native DevTools Console (press `j` in Metro). Treat debug output as health data; do not share it casually.

## Android configuration

- `android.permission.health.WRITE_HYDRATION`: the only health permission.
- Provider package visibility query: `com.google.android.apps.healthdata`.
- `HealthConnectPermissionDelegate` registered in `MainActivity.onCreate`.
- Small native rationale dialog, reachable by the Android 13-and-earlier rationale intent and Android 14+ permission-usage activity alias.
- `START_VIEW_PERMISSION_USAGE` protects that alias; it is not an additional requested permission.
- Existing `INTERNET` permission is retained for React Native development. No app networking was added.

## Physical-device test (Windows PowerShell)

1. Use a personal-profile Android 9+ phone; Android 14+ is preferred. On Android 9–13 install/update Google's Health Connect from Google Play. On Android 14+ search Settings for Health Connect. Complete its initial setup. Android 8 can install this APK but cannot use Health Connect.
2. Enable Developer options and USB debugging, connect USB, and approve the computer's debugging prompt. Run `adb devices`; ensure exactly the intended device is listed as `device`.
3. From the repository root, run `npm ci` if dependencies have not been installed. Use Node >=22.11 and a compatible JDK (this project uses JDK 17). Ensure `ANDROID_HOME` points at the Android SDK with API 37, Build Tools 37.0.0, and the template's NDK 27.1.12297006.
4. In terminal A run `npm start`. In terminal B run:

   ```powershell
   adb reverse tcp:8081 tcp:8081
   npm run android -- --no-packager
   ```

5. Press `j` in Metro to open DevTools; select Console and filter for `HydrationSpike`.
6. Tap **Add 8 oz Water**. The Health Connect permission screen must offer only hydration/water **write** access, with no read permission or other data types. Open the privacy/rationale link and verify its dialog, close it, then allow hydration writes.
7. Expect success text with **236.6 mL**, a UTC timestamp, and a nonempty record ID. Logs should show available status, permission outcome, one write attempt, and its ID. Record that timestamp/ID for verification below.
8. Tap again: no permission prompt while permission remains granted; exactly one additional record should be written. Rapidly tap during a pending write: only one insert should occur for that pending operation.
9. In Health Connect > App permissions > QuickHealthInput, revoke hydration write access. Return and tap; deny or dismiss the prompt. Expect an error, no write-result log, and no new record. Re-enable permission there and retry. Repeated denial may require manually enabling access in Health Connect.
10. For availability coverage, use an Android 9–13 phone without Health Connect (or with an outdated provider). Expect install/update guidance and no permission/write attempt; install/update, return, and retry. An unsupported device/profile should show the unavailable message.
11. Force-stop/reopen the app: the last success is gone, while the independently verified record remains in Health Connect.

## Independently verify the record

The app deliberately does not request READ_HYDRATION. Success text is an insertion acknowledgment, not an independent readback.

1. Open Health Connect from Settings (search for Health Connect).
2. Open **Data and access** (some versions: **Browse data**) > **Nutrition** > **Hydration** > **See all entries**, and select the local date corresponding to the displayed UTC timestamp. Labels vary by Android/provider version.
3. Find the entry at that time, attributed to **QuickHealthInput** / `com.quickhealthinput`. Inspect the individual entry rather than the daily total. Set volume units to mL if available. The UI may round 236.6 mL to 237 mL or display approximately 8 fl oz.
4. For exact numeric verification, install Google's [Health Connect Toolbox](https://developer.android.com/health-and-fitness/health-connect/test/health-connect-toolbox), using the APK linked from that page (`adb install <downloaded-toolbox.apk>`). Grant **the Toolbox** hydration read access; do not add read permission to Quick Health Input.
5. In Toolbox choose **Read Health Record**, select **Hydration**, choose a time range covering the tap, and press **READ**. Inspect the record: volume **0.2366 L / 236.6 mL**, data origin `com.quickhealthinput`, interval ending at the logged timestamp, manual-entry metadata, and ID matching the app's result where exposed. Do not use Toolbox's insert action.
6. Delete test entries in Health Connect after testing if desired. Deleting data is intentionally outside this spike's UI.

## Remaining risks

- Physical-device permission UX, OEM/provider behavior, and real record persistence must be verified with the steps above; mocked JS tests cannot prove these.
- Native wrapper compatibility with this very recent RN/AGP combination must be covered by the Android build and device run. The wrapper still uses AGP legacy APIs, which emit deprecation warnings.
- The wrapper's hydration serializer supplies null zone offsets; Health Connect handles presentation. Compare UTC timestamps carefully when verifying near local midnight.
- An interrupted write can have persisted even if its acknowledgment never reaches JS. There is no persistent deduplication or automatic retry in this spike.
- This is a debug spike, not a Play release: production privacy policy, Play health declarations, release logging, and broader compatibility work remain outside scope.


## Files changed

- `App.tsx`: temporary one-button UI, pending guard, success/error output.
- `hydrationSpike.ts`: isolated Android availability, write permission, insertion, and debug logging.
- `package.json`, `package-lock.json`: pinned Health Connect wrapper.
- `android/build.gradle`: minSdk raised to 26.
- `android/app/src/main/AndroidManifest.xml`: hydration write permission, provider query, rationale routes.
- `android/app/src/main/java/com/quickhealthinput/MainActivity.kt`: permission result delegate.
- `android/app/src/main/java/com/quickhealthinput/HealthPermissionsRationaleActivity.kt`: temporary rationale dialog.
- `__tests__/App.test.tsx`, `__tests__/hydrationSpike.test.ts`: UI and write-flow checks.
- `README.md`, `HYDRATION_SPIKE.md`: spike handoff documentation.

The merged debug manifest also contains React Native's `SYSTEM_ALERT_WINDOW` and `ACCESS_LOCAL_NETWORK`, and AndroidX's signature-protected `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. These are supplied by existing development/runtime dependencies, not additional health access. Only WRITE_HYDRATION is present in the health permission namespace.

## Checks performed (2026-09-21)

- `android\gradlew.bat :app:assembleDebug --console=plain`: PASS, all four configured ABIs. Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
- `tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `jest --runInBand --watch=false`: PASS, 2 suites / 10 tests. Covers payload/time/manual metadata, availability states, initialization failure, denied/cancelled permission, revocation, native error propagation, missing ID, success/error UI, and concurrent-tap suppression. An initial UI test timed out during the first heavily loaded native build; subsequent runs passed without changing its timeout.
- Android Metro bundle: PASS (`react-native bundle --platform android --dev true --entry-file index.js --bundle-output android/app/build/hydration-spike.bundle --assets-dest android/app/build/hydration-spike-assets --max-workers 2`).
- Merged debug manifest: confirmed minSdk 26, targetSdk 36, only WRITE_HYDRATION in the health permission namespace, provider visibility, and both rationale routes.
- `git diff --check`: PASS.
- Nonblocking diagnostics: upstream Gradle/AGP/RN deprecations, library manifest namespace warnings, and a Metro private feature-flags export fallback. No dependencies were patched.
- Physical device testing / permission dialog / actual Health Connect write and independent readback: NOT RUN. These are the next steps, not claimed as verified.
- No commit or push performed.

