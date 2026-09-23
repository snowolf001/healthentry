/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

test('manifest declares only the supported Trends read and entry write permissions', () => {
  const manifest = readFileSync(
    join(__dirname, '../android/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  const permissions = Array.from(
    manifest.matchAll(
      /<uses-permission android:name="(android\.permission\.health\.[^"]+)"/g,
    ),
    match => match[1],
  ).sort();
  expect(permissions).toEqual([
    'android.permission.health.READ_BLOOD_PRESSURE',
    'android.permission.health.READ_EXERCISE',
    'android.permission.health.READ_HYDRATION',
    'android.permission.health.READ_NUTRITION',
    'android.permission.health.READ_WEIGHT',
    'android.permission.health.WRITE_BLOOD_PRESSURE',
    'android.permission.health.WRITE_EXERCISE',
    'android.permission.health.WRITE_HYDRATION',
    'android.permission.health.WRITE_NUTRITION',
    'android.permission.health.WRITE_WEIGHT',
  ]);
});

const read = (path: string) =>
  readFileSync(join(__dirname, '..', path), 'utf8');
const res = (path: string) => read('android/app/src/main/res/' + path);
const native = (path: string) =>
  read('android/app/src/main/java/com/cleanutilityapps/healthentry/' + path);

test('HealthEntry identity and React registrations agree', () => {
  expect(read('android/app/build.gradle')).toContain(
    'applicationId "com.cleanutilityapps.healthentry"',
  );
  expect(JSON.parse(read('app.json')).displayName).toBe('HealthEntry');
  expect(res('values/strings.xml')).not.toContain('QuickHealthInput');
  expect(read('index.js')).toContain("registerComponent('HealthEntryWidget'");
  expect(native('widget/WidgetEntryActivity.kt')).toContain(
    'getMainComponentName() = "HealthEntryWidget"',
  );
});

test.each(['water', 'coffee', 'weight'])(
  '%s is a compact independent HealthEntry widget',
  action => {
    const layout = res(`layout/${action}_widget.xml`);
    const metadata = res(`xml/${action}_widget_info.xml`);
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const name = action[0].toUpperCase() + action.slice(1);
    expect(manifest).toContain(`.widget.${name}WidgetProvider`);
    expect(manifest).toContain(`@xml/${action}_widget_info`);
    expect(res('values/strings.xml')).toContain(`HealthEntry ${name}`);
    for (const attr of [
      'minWidth',
      'minHeight',
      'minResizeWidth',
      'minResizeHeight',
    ]) {
      expect(metadata).toContain(`android:${attr}="56dp"`);
    }
    expect(metadata).toContain('android:targetCellWidth="1"');
    expect(metadata).toContain('android:targetCellHeight="1"');
    expect(metadata).toContain('android:resizeMode="none"');
    expect(metadata).toContain('android:updatePeriodMillis="0"');
    expect(layout).toContain('android:id="@+id/widget_action"');
    expect(layout).toContain(
      `android:contentDescription="@string/widget_${action}_accessibility"`,
    );
    expect(layout.match(/<ImageView/g)).toHaveLength(1);
    expect(layout.match(/<TextView/g)).toHaveLength(1);
    expect(layout.match(/android:maxLines="1"/g)).toHaveLength(1);
    expect(layout).not.toContain('android:ellipsize');
    expect(layout).toContain(`android:src="@drawable/widget_${action}_icon"`);
    expect(layout).not.toContain(`android:text="@string/widget_${action}"`);
    expect(res(`drawable/widget_${action}_icon.xml`)).toContain('<vector');
    expect(res(`drawable/widget_${action}_icon.xml`)).toContain(
      `android:fillColor="@color/widget_${action}_accent"`,
    );
    expect(res(`drawable/widget_${action}_icon.xml`)).toContain(
      'android:fillType="evenOdd"',
    );
    expect(layout).toContain('android:layout_width="28dp"');
    expect(layout).toContain('android:layout_height="28dp"');
    expect(layout).toContain('android:textColor="@color/widget_text_secondary"');
    expect(layout).not.toMatch(/<Button|<View |ConstraintLayout/);
    expect(layout).toMatch(/android:textSize="(?:8|11)sp"/);
    expect(layout).toContain('android:autoSizeTextType="uniform"');
    expect(layout.match(/android:background=/g)).toHaveLength(1);
  },
);

test('only three widget providers; old multi-action widget and Blood Pressure widget absent', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  expect(manifest.match(/android.appwidget.provider/g)).toHaveLength(3);
  expect(manifest).not.toMatch(
    /QuickHealthWidgetProvider|BloodPressureWidgetProvider/,
  );
  expect(() => res('layout/quick_health_widget.xml')).toThrow();
  expect(() => res('xml/quick_health_widget_info.xml')).toThrow();
  const provider = native('widget/EntryWidgetProvider.kt');
  expect(provider).toContain(
    'Intent(context, WidgetEntryActivity::class.java)',
  );
  expect(provider).toContain('PendingIntent.FLAG_IMMUTABLE');
  expect(provider).toContain('this@EntryWidgetProvider.action');
  expect(provider).toContain(
    'setOnClickPendingIntent(R.id.widget_action, pending)',
  );
  expect(provider).not.toMatch(
    /HealthConnect|insertRecords|requestPermission|MainActivity|startService/,
  );
});

test('private translucent Activity and session gate prevent task replay', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const activity = manifest.match(
    /<activity\s+android:name=".widget.WidgetEntryActivity"[\s\S]*?\/>/,
  )![0];
  expect(activity).toContain('android:exported="false"');
  expect(activity).toContain('android:excludeFromRecents="true"');
  expect(activity).toContain('android:launchMode="singleTask"');
  expect(activity).not.toContain('android:noHistory="true"');
  expect(res('values/styles.xml')).toContain(
    '<item name="android:windowIsTranslucent">true</item>',
  );
  const kotlin = native('widget/WidgetEntryActivity.kt');
  expect(kotlin).toContain('savedInstanceState != null');
  expect(kotlin).toContain('Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY');
  expect(kotlin).toContain('intent.data = null');
  expect(kotlin).toContain('finishAndRemoveTask()');
  expect(native('MainActivity.kt')).not.toContain('WidgetActionInbox');
  const gate = native('widget/WidgetSessionGate.kt');
  expect(gate).not.toMatch(/SharedPreferences|File\(|recordId|timestamp/);
});

test('permissions belong to their Activity and request only one write type', () => {
  const host = native('permissions/HealthPermissionHost.kt');
  expect(host).toContain('registerForActivityResult');
  expect(host).toContain('launcher.launch(setOf(requested))');
  expect(host).toContain('Lifecycle.State.RESUMED');
  expect(host).toContain('override fun onDestroy');
  expect(host).not.toContain('getReadPermission');
  for (const activity of ['MainActivity.kt', 'widget/WidgetEntryActivity.kt']) {
    expect(native(activity)).toContain('HealthPermissionHost(this)');
    expect(native(activity)).not.toContain('HealthConnectPermissionDelegate');
  }
});

test('all widget colors have native day/night resources', () => {
  const visual = [
    'layout/water_widget.xml',
    'layout/coffee_widget.xml',
    'layout/weight_widget.xml',
    'drawable/widget_background.xml',
    'drawable/widget_water_icon.xml',
    'drawable/widget_coffee_icon.xml',
    'drawable/widget_weight_icon.xml',
  ]
    .map(res)
    .join('\n');
  expect(visual).not.toMatch(/#[0-9a-fA-F]{6,8}/);
  for (const theme of ['values', 'values-night']) {
    for (const [, name] of visual.matchAll(/@color\/(\w+)/g)) {
      expect(res(`${theme}/colors.xml`)).toContain(`<color name="${name}">`);
    }
  }
});
