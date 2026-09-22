# HealthEntry: three 1x1 widgets ? implementation and Pixel acceptance

## Architecture chosen

Each native AppWidgetProvider creates a simple RemoteViews layout and an immutable explicit PendingIntent targeting the private WidgetEntryActivity. It does no health work. There are exactly three registered providers: WaterWidgetProvider, CoffeeWidgetProvider, and WeightWidgetProvider. The development multi-action widget, its metadata/layout, old action contracts, native inbox, and JavaScript Home-link routing are removed.

WidgetEntryActivity is a foreground translucent ReactActivity with a separate task affinity, singleTask launch mode, and excludeFromRecents=true. It mounts a new HealthEntryWidget component, not App/Home. Water/Coffee briefly display a small progress surface over the launcher while React Native and Health Connect complete the operation. Weight shows only its compact input dialog. finishAndRemoveTask closes the temporary task, normally revealing the launcher beneath it. No Service, background receiver writer, WorkManager, Headless JS, or background permission workaround is used.

This retains one health-record implementation: src/systemHealth/androidHealthConnect.ts still constructs records and validates receipts. WidgetEntry uses systemHealth.addWater/addCaffeine/addWeight. Weight uses the existing useWeightInput, weightEntry, and unit conversion/validation. Nothing is reimplemented in native units or record mappings. The shared runHealthEntry guard spans both React roots in the shared ReactHost.

Inspection found react-native-health-connect's permission delegate is a global singleton holding one ActivityResultLauncher. Registering a widget Activity there could leave later Home permission requests attached to a destroyed widget Activity. It is therefore replaced at the app boundary by HealthPermissionHost, instantiated separately in each Activity. The native HealthPermissions module selects the current Activity's host, requests exactly one type's WRITE permission, launches only when RESUMED, resolves once, and rejects pending requests on destruction. No health insertion moved into Kotlin.

The app explicitly depends on the same androidx.health.connect:connect-client:1.1.0 already used by the installed React Native package, solely for its permission contract and write-permission names. JUnit 4.13.2 is a test-only dependency.

References checked before implementation:
- [Android Health Connect writing guidance](https://developer.android.com/health-and-fitness/health-connect/write-data)
- [Widget construction / RemoteViews](https://developer.android.com/develop/ui/views/appwidgets)
- [Widget sizing](https://developer.android.com/develop/ui/views/appwidgets/layouts)
- [Task and Recents handling](https://developer.android.com/guide/components/activities/recents)

## Exact sizes and appearance

All three providers use the same constraints:

| Property | Value |
| --- | --- |
| targetCellWidth / targetCellHeight | 1 / 1 |
| minWidth / minHeight | 56 dp / 56 dp |
| minResizeWidth / minResizeHeight | 56 dp / 56 dp |
| resizeMode | none |
| updatePeriodMillis | 0 |
| widgetCategory | home_screen |
| Root touch target | Entire surface; minWidth/minHeight 48 dp |
| Outer padding | 4 dp on each side |
| Main label | 13 sp bold, one line |
| Detail | 12 sp regular, one line, 2 dp gap above |
| Outer shape | 16 dp rounded corners, 1 dp semantic border, native ripple |

Only LinearLayout and TextView are inflated. There is one outer surface, no nested button/card. Both labels use maxLines=1, ellipsize=end, includeFontPadding=false. Launcher allocation is a request, not an exact Pixel measurement; Android launcher grids and margins vary. Large font scales may ellipsize. Values/values-night semantic colors are preserved. Picker labels are HealthEntry Water, HealthEntry Coffee, HealthEntry Weight; spoken descriptions describe the whole action. Blood Pressure is not a widget.

The Weight entry surface is a centered, theme-aware dialog capped at 320 dp width, with 20 dp padding, 16 dp corners, a 48 dp-minimum numeric input, and 48 dp-minimum Cancel/Add targets. It does not display Home, Settings, or Blood Pressure controls.

## Exact actions and feedback

- **Water:** Consume one session, call addWater({value:8, unit:'us-fl-oz'}). The existing adapter writes Hydration 236.6 mL, using the existing manual-entry metadata. Success Toast: **Added 8 oz water**. Close the entry Activity.
- **Coffee:** Call addCaffeine({milligrams:95, label:'Coffee'}). The existing adapter writes a Nutrition record containing caffeine 95 mg, Coffee name, UNKNOWN meal type, and manual-entry metadata. Success Toast: **Added 95 mg caffeine**. Close the entry Activity.
- **Weight:** Load existing unit and lastEnteredWeightKg; preserve canonical kg behind rounded display; focus the decimal input and show the keyboard. Nothing is submitted until Add. Validate with the existing weightEntry/weight bounds (10?450 kg canonical), then write the existing Weight payload. A successful write updates only the already-supported two-field input preference, closes the surface, and Toasts the entered/displayed value and unit, e.g. **Added 171.3 lb**. Cancel/Back before submission writes nothing and does not save an unsubmitted draft. Failure stays inline with the value available for editing and an explicit retry.
- **Permission:** Already-granted access inserts directly. Missing access requests only Hydration, Nutrition, or Weight WRITE as appropriate. A grant continues the same awaited call once; there is no second Add for Water/Coffee and no second Add after granting for Weight. Denial/cancellation makes no insertion.
- **Failures:** Water/Coffee close with a short native Toast. Permission failure says **Permission not granted. Nothing added.** An ambiguous insert error/receipt says **Save not confirmed. Check Health Connect before retrying.** Weight keeps equivalent failure feedback inline and does not close. No path reports success before a validated receipt.

## Duplicate and restoration protection

A synchronized native WidgetSessionGate admits one session at a time. Launch consumption is one-shot. It rejects unknown actions, saved-state restoration, history launches, rapid new launches while a session is open, duplicate consume calls, duplicate beginWrite calls, and stale session tokens. Activity intent data is cleared before React mounts. onNewIntent discards additional taps rather than queuing them. A writing session cannot be released merely by Activity destruction/Back; its callback must end the write first.

The TypeScript runHealthEntry guard is shared with Home. It blocks concurrent authorization/insertion across the two React roots. React effect replay is guarded by one launch promise and a handled flag; no AppState or URL listener can resubmit. MainActivity no longer consumes widget URLs. New widgets target a non-exported Activity, so unrelated apps cannot launch the writer through public deep links.

Only a fresh intentional tap after completion can start a new operation. Weight failure allows an explicit Add retry in its still-open input surface. No operation, health record, timestamp, or Health Connect record ID is persisted. A process death can lose an unfinished operation or its acknowledgment; restored tasks fail closed and never retry. Independently inspect Health Connect before retrying an ambiguous failure.

## Exact Pixel device procedure

### Install

Keep Metro running for the debug APK:

```powershell
# Terminal 1, repository root:
npm start
# Terminal 2:
adb reverse tcp:8081 tcp:8081
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Remove the old development widget if the launcher leaves a placeholder. Long-press Pixel Home > Widgets > HealthEntry. Add Water, Coffee, and Weight independently. Confirm each requests one cell, the old large widget is absent, and no Blood Pressure widget exists. Test all taps on the actual widgets: the entry Activity is intentionally private, so adb explicit launch commands are not a substitute.

Before each write case, note current Health Connect record counts/times. Success labels alone do not prove persistence. Water must add exactly one 236.6 mL Hydration record; Coffee exactly one Nutrition record with caffeine 95 mg and Coffee name; Weight the entered value converted to kg. Do not press a second time merely to confirm a successful quick entry.

### Required cases

1. **Already granted:** Grant Hydration WRITE, tap Water once. Expect only the small progress surface, never Home, then Added 8 oz water and return to the launcher. Inspect one new record. Repeat Coffee with Nutrition WRITE and its exact success text/record.
2. **Initially absent:** Revoke the target write permission in Health Connect > App permissions > HealthEntry. Tap Water/Coffee once. Verify the request contains only that target's write permission, with no reads/unrelated types. Grant once. Without another tap, expect one record, Toast, and closed surface. Repeat Weight by entering a value and pressing Add once, then granting Weight WRITE.
3. **Denied/cancelled:** Revoke and repeat, denying once and using Back/cancel once. Verify zero new records. Water/Coffee Toast failure and close. Weight keeps its edited value and error; Cancel then closes without writing. Reopening alone must not request permission again or submit.
4. **Cold:** Go Home and run `adb shell am force-stop com.cleanutilityapps.healthentry`; then tap a widget. If Pixel disables a force-stopped widget, open the app once, return Home, run `adb shell am kill com.cleanutilityapps.healthentry`, and verify no PID with `adb shell pidof com.cleanutilityapps.healthentry` before tapping. Test all three widgets with permission granted and absent. No full Home should appear. Weight still waits for Add.
5. **Warm/background:** Open HealthEntry normally, go Home, and tap each widget. Repeat after using another app and with HealthEntry previously on Settings/Privacy. Expect only the compact entry surface. After each widget closes, open Home and perform a normal permission-requiring entry; then test another permission-requiring widget entry. This specifically verifies the per-Activity permission launchers do not point at a destroyed Activity.
6. **Rapid taps:** Keep a permission request open, return Home if needed, and tap the same/other widgets several times. The existing entry is foregrounded with Finish the current entry first; no queued action is added. Grant the original request: at most one record. Repeat while Adding is visible and with repeated Weight Add taps. A new tap after completion is a new explicit entry and can add one record.
7. **Reopen/replay:** After success, repeatedly open the normal app icon and Recents, rotate, and change system theme. Background and kill the app, then reopen from the icon/Recents. Verify no new write, prompt, or automatic widget task. The widget task must not appear in Recents. Repeat after denial and after an observed native error. Turn on Developer options > Don't keep activities for an additional destructive-restoration test: cancellation/loss of the pending operation is acceptable, automatic replay is not. Inspect Health Connect before retrying.
8. **Weight input:** Set lb in Home Settings and save a known weight. Tap Weight: verify lb, current last-weight prefill, focused decimal field, and keyboard without Home. Edit to 171.3; press Cancel: zero records and draft not persisted. Reopen, edit to 171.3, Add: exactly one kg-converted record, Added 171.3 lb Toast, surface closed. Repeat with kg. Try empty/zero/out-of-range values: no permission request or write, input remains editable. Deny permission or induce an error: draft remains. Retry only by explicitly pressing Add. Rotate and toggle theme while editing; verify no auto-submit.
9. **Appearance/accessibility:** Check the default Pixel grid plus supported display/font scaling in light/dark themes. All six label lines should be readable at normal scaling with no wrapping. Tap edges/corners and both text lines to verify the entire surface acts as one target. With TalkBack, each widget should be one correctly described action. Verify the Weight dialog fits above the keyboard, Cancel/Add are reachable, and Toasts/inline errors are announced.

### Remaining risks / acceptance boundary

No physical execution of this new architecture is claimed. Native Activity/ReactHost interaction, cold-start latency, permission UI across Android versions, keyboard positioning, launcher sizing, Toast visibility, and TalkBack need the Pixel pass above. Water/Coffee intentionally show a small foreground progress surface instead of relying on an unreliable background React/permission flow. Android may also show its system launch transition.

An interrupted insert may have persisted before its receipt was lost. There is no retry/recovery journal. Process/task restoration deliberately abandons the session; it does not silently recover a draft or repeat a write. A development JS reload during an in-flight native operation can leave its conservative in-memory lock held until the process restarts; check Health Connect before any deliberate retry. Back/Cancel is blocked during a submitted operation because a write cannot safely be undone by dismissing UI. The existing two-field weight preference remains the only local convenience storage; no new health history is retained.

### Completed automated checks

TypeScript and ESLint pass. Complete Jest suite: 7 suites, 155 tests pass. Native JUnit: 4 tests pass. Android debug build (`:app:testDebugUnitTest :app:assembleDebug`) passes for the configured ABIs. Production-mode Metro Android bundling passes for both registered roots. Merged manifest confirms exactly the four existing WRITE permissions, no READ permissions, three private widget receivers, and the private/translucent singleTask Activity excluded from Recents. Packaged APK contains all three layouts/providers with 56dp minima and 1x1 target cells; the old combined layout/provider is absent. `git diff --check` passes. Existing Gradle deprecation warnings remain. No device execution, commit, or push was performed.

### Exact task file inventory

This inventory compares against source hashes captured before this task, preserving pre-existing working-tree changes. Generated build artifacts are excluded.

#### Added

- `android/app/src/main/java/com/cleanutilityapps/healthentry/permissions/HealthPermissionHost.kt`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/permissions/HealthPermissionsModule.kt`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/EntryWidgetProvider.kt`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/WidgetEntryActivity.kt`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/WidgetSessionGate.kt`
- `android/app/src/main/res/drawable/widget_background.xml`
- `android/app/src/main/res/layout/coffee_widget.xml`
- `android/app/src/main/res/layout/water_widget.xml`
- `android/app/src/main/res/layout/weight_widget.xml`
- `android/app/src/main/res/xml/coffee_widget_info.xml`
- `android/app/src/main/res/xml/water_widget_info.xml`
- `android/app/src/main/res/xml/weight_widget_info.xml`
- `android/app/src/test/java/com/cleanutilityapps/healthentry/widget/WidgetSessionGateTest.kt`
- `specs/NativeHealthPermissions.ts`
- `src/widget/WidgetEntry.tsx`
- `src/widget/widgetSubmission.ts`

#### Modified

- `App.tsx`
- `HOME_AND_WIDGET.md`
- `README.md`
- `WIDGET_DEVICE_TESTING.md`
- `__tests__/App.test.tsx`
- `__tests__/androidManifest.test.ts`
- `__tests__/hydrationSpike.test.ts`
- `__tests__/widgetQuickEntry.test.tsx`
- `android/app/build.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/MainActivity.kt`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/WidgetActionsModule.kt`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/WidgetActionsPackage.kt`
- `android/app/src/main/res/values/strings.xml`
- `android/app/src/main/res/values/styles.xml`
- `index.js`
- `specs/NativeWidgetActions.ts`
- `src/home/entry.ts`
- `src/systemHealth/androidHealthConnect.ts`
- `.eslintrc.js`

#### Removed

- `__tests__/quickActions.test.ts`
- `__tests__/widgetRouting.test.tsx`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/QuickActionContract.kt`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/QuickHealthWidgetProvider.kt`
- `android/app/src/main/java/com/cleanutilityapps/healthentry/widget/WidgetActionInbox.kt`
- `android/app/src/main/res/drawable/quick_health_widget_background.xml`
- `android/app/src/main/res/drawable/widget_action_background.xml`
- `android/app/src/main/res/layout/quick_health_widget.xml`
- `android/app/src/main/res/xml/quick_health_widget_info.xml`
- `src/quickActions/quickActions.ts`
- `src/quickActions/useQuickActionLinks.ts`
