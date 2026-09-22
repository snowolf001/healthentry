# Android V1 core: Home, System Health, and widget foundation

## Home behavior

A compact white, scrollable screen with native buttons and decimal inputs:

```text
Quick Health

WATER
[ +8 oz ] [ +12 oz ] [ Other ]
US fluid ounces

CAFFEINE
[ Coffee · 95 mg ] [ Espresso · 63 mg ] [ Other ]

WEIGHT
[ 165.2 ] [ lb ⇄ ] [ Add ]
20–1000 lb

✓ Added 165.2 lb
```

This is a layout description, not a captured device screenshot. Buttons wrap on narrow screens. Other water reveals an oz input and Add water; Other caffeine reveals a mg input and Add caffeine. Coffee and Espresso amounts are fixed app defaults, not claims about every beverage. Success stays inline until another entry/validation attempt; inputs are not cleared or automatically submitted. No success modal or health history.

- Water writes 236.6 mL for 8 US fl oz, 354.9 mL for 12 US fl oz, or custom positive oz converted at the boundary.
- Caffeine accepts 1–1000 mg inclusive. Names are explicitly Coffee, Espresso, and Caffeine for custom entry; labels are never inferred from amounts. No other nutrient or hydration value is written.
- Weight defaults to lb, accepts 20–1000 lb or 10–450 kg inclusive, and offers a unit toggle. These and the caffeine range are input sanity limits, not medical guidance.
- Decimal inputs accept a decimal point or comma. Invalid entries do not request permissions or write.
- All write actions share one synchronous pending guard. Buttons/inputs disable during an in-flight operation; same-frame repeated/cross-type taps cannot start another write. A later intentional tap is a new entry. No automatic retries.
- Only Weight waits briefly for local preference loading. Loading failure falls back to lb and an empty input. No health availability check or permission prompt runs at startup.

## Provider-neutral System Health boundary

`src/systemHealth/types.ts` exposes availability, per-input authorization, and `addWater`, `addCaffeine`, `addWeight`, `addBloodPressure`. `CaffeineInput` has an optional `label`; `WeightInput` carries an explicit lb/kg unit; and `BloodPressureInput` carries systolic and diastolic mmHg values. Metro selects `index.android.ts`; the default implementation remains unsupported. No iOS implementation was added.

`androidHealthConnect.ts` alone imports the Health Connect library. Its internal mapping is:

| App input | RN record / requested access | Manifest permission |
| --- | --- | --- |
| water | Hydration / write | android.permission.health.WRITE_HYDRATION |
| caffeine | Nutrition / write | android.permission.health.WRITE_NUTRITION |
| weight | Weight / write | android.permission.health.WRITE_WEIGHT |
| bloodPressure | BloodPressure / write | android.permission.health.WRITE_BLOOD_PRESSURE |

After input validation, every explicit write checks availability, initializes the provider, examines whether that action's write permission is granted, and requests only that missing permission. `getGrantedPermissions` returns the provider's grant set; we only evaluate the target write grant. No reads, startup blanket request, or unrelated permission requests.

The existing permission delegate, provider visibility query, and rationale routes are preserved. Rationale copy now explains all four types, Nutrition access specifically for caffeine, no reading/history/server, and the two local weight convenience preferences.

A shared `writeOne` path builds timestamps after authorization, inserts exactly one record, and requires exactly one nonblank record ID. Missing/ambiguous acknowledgments and native errors remain failures without retries. `[HydrationSpike]` development logging is retained for continuity and now includes all types. Debug logs include sensitive payload/time/IDs; they are diagnostics, not app-managed history.

### Exact payloads

All metadata is `{ recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY }` (3). `now` is captured after permission authorization.

```ts
// Coffee; Espresso changes name to 'Espresso' and value to 63.
// Custom entry uses name 'Caffeine' and the validated user-entered value.
{
  recordType: 'Nutrition',
  startTime: new Date(now - 1000).toISOString(),
  endTime: new Date(now).toISOString(),
  caffeine: { value: 95, unit: 'milligrams' },
  mealType: MealType.UNKNOWN, // 0
  name: 'Coffee',
  metadata: { recordingMethod: 3 },
}
// 165.2 lb; instantaneous, with no interval fields.
{
  recordType: 'Weight',
  time: new Date(now).toISOString(),
  weight: { value: 74.933459524, unit: 'kilograms' },
  metadata: { recordingMethod: 3 },
}
```

Nutrition contains no calories, sugar, protein, hydration volume, or fake zero nutrients. An absent optional boundary label omits `name`. Hydration retains its previous nonzero one-second interval, manual metadata, and 0.1 mL rounding. `hydrationSpike.ts` remains a compatibility facade.

## Weight conversion and persistence

`units.ts` owns `kg = lb * 0.45359237`, reverse conversion, validation, and display formatting. `weightInput.ts` keeps unrounded canonical kg separately from display text. Switching units formats canonical kg to one decimal and never reinterprets or rounds the stored canonical value. Editing the text deliberately replaces the canonical draft. The boundary validates in the selected input unit and always constructs the native payload in kg.

The specified lb/kg validation ranges are not equivalent: 20 lb becomes about 9.1 kg, below the kg entry minimum; 1000 lb becomes about 453.6 kg, above the kg maximum. A subsequent Add uses the currently selected unit's limits. Values remain intact during toggles and are not silently clamped.

Persistence uses a small code-generated Android TurboModule and private SharedPreferences, with no database or added dependency:

- `specs/NativeWeightPreferences.ts` — two asynchronous methods, load/save.
- `WeightPreferencesModule.kt` — ordered single-thread IO, durable `commit()` acknowledgment, whitelist of two JSON fields.
- `WeightPreferencesPackage.kt` and `MainApplication.kt` — native registration.
- `src/preferences/weightPreferences.ts` — validation/defaults and serialization whitelist.
- `src/home/weightInput.ts` — preference loading, ordered saves, canonical draft, last-success update.

Exactly one JSON value under key `value` in private SharedPreferences file `weight_input_preferences` is maintained:

```json
{"unit":"lb","lastEnteredWeightKg":74.933459524}
```

`lastEnteredWeightKg` may be null. No timestamp, record ID, array, previous-value list, or health history is stored locally. Unit switches save the preference but never save an unsubmitted draft as the last successful weight. That value changes only after a valid Health Connect receipt. App backup remains disabled in the manifest. Android may maintain its own transient storage bookkeeping; the app does not retain a history model.

After a successful health write, preference saving runs separately. Failure only logs a generic development warning; it cannot replace success feedback, retry a health write, or create a duplicate. The last value remains in memory for the session; restart may load the older durable preference if saving failed. Failed health writes never update the last value. Input remains prefilled for the next entry and never auto-submits.

## Widget entry architecture

HealthEntry now has three independent 1x1 widgets: Water +8 oz, Coffee 95 mg, and Weight Enter. The old multi-action development widget and its URL/inbox routing into Home are removed. Each provider uses an immutable explicit PendingIntent to a private, translucent WidgetEntryActivity in a separate task excluded from Recents. It mounts only the HealthEntryWidget React root, never Home.

Water/Coffee submit immediately through the same provider-neutral systemHealth adapter and shared pending guard used by Home. A short native Toast confirms an acknowledged write and the Activity closes. Weight shows a compact input surface with existing lb/kg preference, canonical last-weight prefill, numeric keyboard, Cancel, and Add. Failure preserves the editable draft. The Activity normally returns to the launcher when finished.

Both MainActivity and WidgetEntryActivity now own their own Activity Result permission launcher, avoiding the library's global permission-launcher singleton. The adapter requests only the relevant write permission through this small native bridge. Health record construction, units, validation, and receipt checks remain in the existing TypeScript implementation. Native session gating rejects replay/restoration and rapid taps; there is no persisted operation or automatic retry.

Each widget requests 1x1 cells with 56 x 56 dp minimum dimensions, no resizing, 4 dp padding, 13 sp labels, and 12 sp secondary text. See [WIDGET_DEVICE_TESTING.md](WIDGET_DEVICE_TESTING.md) for current architecture, exact source inventory, verification, and Pixel acceptance procedure. Historical implementation notes below describe earlier iterations.

## Files changed in the V1 implementation iteration

Modified: `App.tsx`; `src/systemHealth/types.ts`, `units.ts`, `androidHealthConnect.ts`; `android/app/src/main/AndroidManifest.xml`; `android/app/src/main/java/com/quickhealthinput/MainApplication.kt`, `HealthPermissionsRationaleActivity.kt`; `package.json` (app Codegen config only); `__tests__/App.test.tsx`, `hydrationSpike.test.ts`; `README.md`; `HOME_AND_WIDGET.md`.

Added: `src/home/weightInput.ts`; `src/preferences/weightPreferences.ts`; `specs/NativeWeightPreferences.ts`; `android/app/src/main/java/com/quickhealthinput/preferences/WeightPreferencesModule.kt`, `WeightPreferencesPackage.kt`; `__tests__/weightPreferences.test.ts`, `androidManifest.test.ts`.

Existing hydration setup, SDK/dependencies, widget files, quick-action contract, and all other prior worktree changes are retained. No dependency added, commit, or push.

## Device verification still required

1. Grant each permission on its first action; confirm only Hydration, Nutrition, or Weight write access is requested for that action and no reads. Test denial, cancellation, revocation, unsupported/update-required devices, and rationale routes.
2. Independently inspect water records (see HYDRATION_SPIKE.md), partial Nutrition entries with Coffee 95 mg / Espresso 63 mg / custom Caffeine names, UNKNOWN meal type, and Weight in kg. Verify actual provider persistence and UI presentation.
3. Verify 165.2 lb conversion, kg/lb toggling, keyboard/localized decimals, small displays, large font sizes, TalkBack, and input validation. No device screenshot was captured here.
4. Relaunch after successful weight submission; verify unit and last kg restore. A failed/denied write must not change the durable last value. Validate native preference-module runtime availability and failure handling on a device; JS tests mock its transport.
5. Rapid taps during permissions/insertion should create one pending write. Interruptions may leave a record persisted even without an acknowledgment; inspect Health Connect before retrying.
6. Confirm the three independent widgets use the compact entry Activity across cold/warm/background launches, and Weight never writes before Add. Check actual launcher layout.

The code is implemented and build/test verified; physical permission UX, real Health Connect persistence, native preference round trips, and accessibility/launcher behavior remain the gate before declaring Android V1 core device-verified. Existing release-signing/privacy/Play publication work remains separate. The wrapper still supplies null zone offsets, so check travel/local-time presentation.

## Final automated verification (2026-09-21)

- TypeScript: `npx tsc --noEmit` — PASS.
- ESLint: `npm run lint` — PASS.
- Complete Jest suite: `npm test -- --runInBand --watch=false` — PASS, 6 suites / 108 tests.
- Android debug build: `android/gradlew.bat :app:assembleDebug --console=plain` — PASS, all four configured ABIs. APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Metro Android bundle — PASS, including the platform adapter and new preference TurboModule spec.
- Merged debug manifest — exactly WRITE_HYDRATION, WRITE_NUTRITION, WRITE_WEIGHT in the health permission namespace; no READ permissions; private widget receiver and rationale routes preserved; backup disabled.
- Generated native module bindings inspected: WeightPreferences load/save are included in the generated Java/C++ Codegen output and Kotlin registration compiles.
- `git diff --check` — PASS after removing a documentation trailing blank line.
- Existing upstream Gradle/AGP deprecations and Metro private-featureflags export fallback remain nonblocking. No dependency patches.
- No physical-device execution or screenshots; no commit or push.

Tests cover exact partial nutrition payloads/labels/meal type, weight payload/manual metadata, per-action writes without read permissions, authorization denial, missing/ambiguous IDs/no retries, input boundaries, conversion/display precision and unit switching, prefill, failed-write preservation of last weight, isolated preference failure after health success, duplicate/cross-type taps, original hydration behavior, and widget/action routing parity.
