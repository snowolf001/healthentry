# Widget launch failure investigation

## Root cause and evidence

The connected Pixel's existing `ActivityTaskManager` log contains widget launches with `dat=healthentry-widget://null` and `flg=0x30000000`. Its `dumpsys activity intents` contains a HealthEntry PendingIntent with that same URI. The target is correctly `.widget.WidgetEntryActivity`, not MainActivity.

In `EntryWidgetProvider.onUpdate`, the unqualified `$action` inside `Intent(...).apply { ... }` resolves to the receiver's `Intent.action`, not the provider's constructor property. The new Intent has no action, so interpolation produces the literal host `"null"`. Inspection of the original compiled provider with `javap -c -p` confirms a call to `android/content/Intent.getAction` at URI construction. All three providers also accidentally share the same PendingIntent identity because their target, request code and malformed data match.

`WidgetSessionGate.open` correctly rejects this unsupported host before allocating any session. Thus these failed taps do not leave an active session behind. This explains failure both before and after normal Home initialization. Relaxing restoration or active-session checks would not fix the URI and would weaken safety.

The production fix explicitly qualifies `this@EntryWidgetProvider.action` in URI interpolation. No lifecycle, task, gate, permission, record mapping, UI, or provider sizing behavior is changed.

## Complete path reviewed

1. Each provider creates an explicit, immutable activity PendingIntent with its preset URI, request code 0, UPDATE_CURRENT, and NEW_TASK | SINGLE_TOP. Distinct URI hosts distinguish the three PendingIntents.
2. The manifest sends it to the private, singleTask WidgetEntryActivity in its own task affinity, excluded from Recents. MainActivity has a separate affinity and is not the target.
3. WidgetEntryActivity reads the host, asks the process-local gate to admit it, then clears intent data. Saved state/history launches are rejected. `onNewIntent` drops active-session taps without forwarding URL events.
4. ReactActivity creates its delegate during construction; its `onCreate` obtains launch options and loads only `HealthEntryWidget`. The session is assigned before `super.onCreate`, and launch options read that session. MainApplication shares the ReactHost; MainActivity does not modify the widget gate.
5. WidgetEntry consumes the token through WidgetActions exactly once. Water/Coffee enter the shared Home/widget pending guard and native foreground/write lock. Weight waits for explicit Add.
6. The existing systemHealth adapter validates units and checks only the corresponding WRITE permission. An Activity-owned HealthPermissionHost requests missing permission and resolves one pending request. Denial prevents insertion.
7. The existing Health Connect adapter inserts one record and validates its receipt. Water maps to 236.6 mL and Coffee to 95 mg. Native feedback/finish closes the session and compact task. There is no retry loop, read permission, or persisted health record.

The active gate remains process-local. Destruction cannot unlock a write in flight; completion releases it. Old tokens cannot consume, begin, or close a newer session. A lost callback during a development reload can still conservatively hold the lock until process restart; this existing fail-closed behavior is not the malformed-URI bug and is not weakened here.

## Files changed

- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/EntryWidgetProvider.kt`: qualify the preset reference and explain the shadowing hazard.
- `android/app/build.gradle`: test-only Robolectric dependency and Android resources for JVM widget click tests.
- `android/app/src/test/java/com/cleanutilityapps/healthentry/widget/EntryWidgetProviderTest.kt`: actual provider → RemoteViews click → PendingIntent → gate regression tests, including stale tokens, repeated delivery, restoration, fresh sessions, and independent preset identity.
- `WIDGET_LAUNCH_FIX.md`: investigation evidence and retest procedure.

Robolectric setup follows its [official instructions](https://robolectric.org/getting-started/). The JVM tests use Android API 35 and a plain Application so they do not initialize React Native or perform real health writes. Existing Jest tests cover the subsequent React/systemHealth behavior.

## Verification results

- Before the fix, all three new provider tests failed, including `expected healthentry-widget://water but was healthentry-widget://null`. This reproduced the device evidence without React Native or Health Connect.
- After the fix, all 7 native tests pass (3 provider click regressions plus 4 existing session gate tests). The test copies the shadow-delivered Intent to match Android's parcel-copy boundary before simulating Activity data clearing.
- Complete Jest suite: 7 suites / 155 tests pass, including existing preset mapping, permission, denial, replay, shared pending guard, and Weight behavior coverage.
- TypeScript (`node node_modules/typescript/bin/tsc --noEmit`) and ESLint (`node node_modules/eslint/bin/eslint.js .`) pass.
- `android/gradlew.bat :app:testDebugUnitTest :app:assembleDebug --console=plain` passes. Existing Gradle deprecation warnings remain.
- Merged manifest inspection passes: exactly four existing health WRITE permissions, no READ permissions, three private widget providers, and the private singleTask widget Activity with separate affinity and exclusion from Recents.
- APK inspection confirms all three widget layouts and provider metadata remain packaged. Corrected bytecode reads the provider field instead of calling Intent.getAction.
- `git diff --check` passes. No commit or push. No app installation, permission changes, or health writes were performed on the Pixel during this investigation.

## Pixel retest procedure

1. Start Metro with `npm start`. In another terminal run `adb reverse tcp:8081 tcp:8081`, then `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. Do not clear application data or uninstall; keep preferences/permissions. Remove and re-add the Water widget to ensure the launcher uses the corrected PendingIntent instead of cached RemoteViews.
2. Before any write, note HealthEntry's hydration record count in Health Connect. Inspect `adb shell dumpsys activity intents`: the new Water PendingIntent must have `healthentry-widget://water`, never `://null`. An unreferenced old PendingIntent may still be listed; the new widget's launch is the decisive check.
3. **Water, warm/granted:** Ensure Hydration WRITE permission is granted. Open HealthEntry normally, return to the launcher, tap Water once. Expect the compact entry surface, no full Home, then native `Added 8 oz water` Toast and return to the launcher. In Health Connect confirm exactly one new 236.6 mL record. `adb logcat -d -v brief -s ActivityTaskManager` should show the private widget Activity and the water URI.
4. **Water, cold/granted:** Return to the launcher, run `adb shell am kill com.cleanutilityapps.healthentry`, and check `adb shell pidof com.cleanutilityapps.healthentry` returns no PID. Tap Water once and verify the same single record/Toast. If the process is retained, force-stop it, then tap the widget if the launcher permits; if force-stop disables it, open Home once, return to the launcher, and retry `am kill`.
5. **Water, missing permission:** Revoke only Hydration WRITE access through Health Connect. Tap Water; grant the requested Hydration WRITE permission. Expect the original entry to complete once without a second tap. Verify one new record. Repeat after revocation but deny/back out instead: expect permission failure feedback and zero new records.
6. **Rapid taps:** With a Water permission request open, return to the launcher and tap Water several times, then complete the original request. Expect no queued entries and at most one new record. Repeat with fast taps while the progress surface is visible. A separate tap after completion is a new intentional entry and may add another record.
7. **Replay/stale session:** After success and separately after denial, open the normal app icon and Recents several times, background/resume, and change orientation/theme. Verify no extra record or permission prompt and no widget task in Recents. Tap Water again deliberately after completion: it must work, showing the previous session did not poison later entry. Never retry an ambiguous failure until checking Health Connect.
8. Only after Water passes, re-add Coffee and Weight and smoke-test the shared fix: Coffee creates exactly one 95 mg caffeine record; Weight focuses its input, Cancel creates nothing, and only Add writes. Retest their corresponding permission denial. All widgets remain independent 1x1 surfaces; Blood Pressure has no widget.

Reading existing device diagnostics does not constitute an end-to-end write retest. The corrected APK still needs the steps above; no health records were created as part of this investigation.
