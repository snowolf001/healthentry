import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import packageInfo from '../../package.json';
import { systemHealth } from '../systemHealth';
import type { Availability, WeightUnit } from '../systemHealth/types';
import { ActionButton } from '../ui/ActionButton';
import type { Theme } from '../ui/theme';
import { getProState, isDebugBuild, setDebugProOverride, type ProState } from '../pro/pro';
import {
  coffeeDefaultLabel,
  coffeeDefaults,
  defaultWidgetPreferences,
  validateWaterWidgetValue,
  validateMoveMinutes,
  validateMoveName,
  waterPresets,
  widgetPreferences,
  type WidgetPreferences,
} from '../preferences/widgetPreferences';

type Props = {
  unit: WeightUnit;
  ready: boolean;
  onUnit: (unit: WeightUnit) => void;
  onBack: () => void;
  onPrivacy: () => void;
  onPro: () => void;
  theme: Theme;
};

export function SettingsScreen({
  unit,
  ready,
  onUnit,
  onBack,
  onPrivacy,
  onPro,
  theme,
}: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [pro, setPro] = useState<ProState | null>(null);
  const [debugBuild, setDebugBuild] = useState(false);
  const [widgets, setWidgets] = useState<WidgetPreferences>(
    defaultWidgetPreferences,
  );
  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetEditor, setWidgetEditor] = useState<'water' | 'coffee' | null>(
    null,
  );
  const [customWater, setCustomWater] = useState('');
  const [customWaterOpen, setCustomWaterOpen] = useState(false);
  const [moveMinutes, setMoveMinutes] = useState('5');
  const [moveName, setMoveName] = useState('Exercise');
  const [widgetError, setWidgetError] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    void getProState().then(setPro);
    void isDebugBuild().then(setDebugBuild);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void getProState().then(setPro);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let active = true;
    let revision = 0;
    async function refresh() {
      const current = ++revision;
      try {
        const status = await systemHealth.getAvailability();
        if (active && current === revision) {
          setAvailability(status);
          setError('');
        }
      } catch {
        if (active && current === revision) {
          setAvailability(null);
          setError(
            'Could not check availability. Reopen Settings to try again.',
          );
        }
      }
    }
    refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    let active = true;
    widgetPreferences
      .load()
      .then(value => {
        if (active) {
          setWidgets(value);
          setMoveMinutes(String(value.moveMinutes));
          setMoveName(value.moveName);
          setWidgetReady(true);
        }
      })
      .catch(() => active && setWidgetError('Could not load widget defaults.'));
    return () => {
      active = false;
    };
  }, []);
  async function saveWidgets(next: WidgetPreferences) {
    setWidgetError('');
    try {
      await widgetPreferences.save(next);
      setWidgets(next);
      setWidgetEditor(null);
      setCustomWater('');
      setCustomWaterOpen(false);
    } catch {
      setWidgetError('Could not save widget defaults.');
    }
  }
  function saveCustomWater() {
    try {
      return saveWidgets({
        ...widgets,
        waterOz: validateWaterWidgetValue(customWater),
      });
    } catch (reason) {
      setWidgetError((reason as Error).message);
    }
  }
  function saveMove() {
    try {
      const minutes = validateMoveMinutes(moveMinutes);
      const name = validateMoveName(moveName);
      return saveWidgets({ ...widgets, moveMinutes: minutes, moveName: name });
    } catch (reason) {
      setWidgetError((reason as Error).message);
    }
  }
  async function openSettings() {
    setOpening(true);
    setError('');
    try {
      await systemHealth.openSettings();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not open Health Connect.',
      );
    } finally {
      setOpening(false);
    }
  }
  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.header}>
        <ActionButton
          theme={theme}
          title="‹"
          compact
          onPress={onBack}
          accessibilityLabel="Back to Home"
        />
        <Text accessibilityRole="header" style={styles.title}>
          Settings
        </Text>
      </View>
      <Text style={styles.sectionLabel}>PRO</Text>
      <SettingsLink
        theme={theme}
        label={pro?.isPro ? 'Health Entry Pro · Active' : 'Health Entry Pro'}
        accessibilityLabel="Health Entry Pro"
        onPress={onPro}
      />
      {debugBuild && (
        <View style={styles.settingsRow}>
          <View>
            <Text style={styles.rowTitle}>Debug Pro Access</Text>
            <Text style={styles.statusText}>Overrides Pro locally in debug builds</Text>
          </View>
          <Switch
            accessibilityLabel="Debug Pro Access"
            value={pro?.debugProOverride === true}
            onValueChange={active => {
              void setDebugProOverride(active).then(setPro);
            }}
          />
        </View>
      )}
      <Text style={styles.sectionLabel}>UNITS</Text>
      <View style={styles.settingsRow}>
        <Text style={styles.rowTitle}>Weight</Text>
        <View style={styles.segment}>
          {(['lb', 'kg'] as const).map(value => (
            <ActionButton
              key={value}
              theme={theme}
              title={value}
              compact
              selected={unit === value}
              disabled={!ready}
              onPress={() => onUnit(value)}
              accessibilityLabel={`Use ${
                value === 'lb' ? 'pounds' : 'kilograms'
              }`}
            />
          ))}
        </View>
      </View>
      <Text style={styles.sectionLabel}>WIDGETS</Text>
      <SettingsLink
        theme={theme}
        label={`Water Widget · ${widgets.waterOz} oz`}
        accessibilityLabel={`Water Widget, ${widgets.waterOz} oz`}
        disabled={!widgetReady}
        onPress={() =>
          setWidgetEditor(widgetEditor === 'water' ? null : 'water')
        }
      />
      {widgetEditor === 'water' && (
        <View style={styles.choiceGrid}>
          {waterPresets.map(value => (
            <ActionButton
              key={value}
              theme={theme}
              title={`${value} oz`}
              compact
              selected={widgets.waterOz === value}
              onPress={() => saveWidgets({ ...widgets, waterOz: value })}
            />
          ))}
          <ActionButton
            theme={theme}
            title="Custom"
            compact
            selected={
              !waterPresets.includes(
                widgets.waterOz as (typeof waterPresets)[number],
              )
            }
            onPress={() => {
              setCustomWaterOpen(true);
              setCustomWater(String(widgets.waterOz));
            }}
          />
          {customWaterOpen && (
            <View style={styles.customRow}>
              <TextInput
                accessibilityLabel="Custom water widget amount in ounces"
                keyboardType="decimal-pad"
                value={customWater}
                onChangeText={setCustomWater}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    color: theme.textPrimary,
                    backgroundColor: theme.inputBackground,
                  },
                ]}
              />
              <Text style={styles.statusText}>oz</Text>
              <ActionButton
                theme={theme}
                title="Save"
                compact
                onPress={saveCustomWater}
              />
            </View>
          )}
        </View>
      )}
      <SettingsLink
        theme={theme}
        label={`Coffee · ${coffeeDefaultLabel(widgets.coffeeDefault)}`}
        accessibilityLabel={`Coffee Widget, ${coffeeDefaultLabel(
          widgets.coffeeDefault,
        )}`}
        disabled={!widgetReady}
        onPress={() =>
          setWidgetEditor(widgetEditor === 'coffee' ? null : 'coffee')
        }
      />
      {widgetEditor === 'coffee' && (
        <View style={styles.choiceGrid}>
          {coffeeDefaults.map(value => (
            <ActionButton
              key={value}
              theme={theme}
              title={coffeeDefaultLabel(value)}
              compact
              selected={widgets.coffeeDefault === value}
              onPress={() => saveWidgets({ ...widgets, coffeeDefault: value })}
            />
          ))}
        </View>
      )}
      <Text style={styles.sectionLabel}>MOVE</Text>
      <Text style={styles.fieldLabel}>Default duration</Text>
        <View style={styles.durationRow}>
          <TextInput
            accessibilityLabel="Default move duration in minutes"
            keyboardType="number-pad"
            value={moveMinutes}
            onChangeText={text => setMoveMinutes(text.replace(/[^0-9]/g, ''))}
            style={[
              styles.durationInput,
              {
                borderColor: theme.border,
                color: theme.textPrimary,
                backgroundColor: theme.inputBackground,
              },
            ]}
            editable={widgetReady}
          />
          <Text style={styles.statusText}>min</Text>
          <ActionButton
            theme={theme}
            title="Save"
            compact
            onPress={saveMove}
            disabled={!widgetReady}
          />
        </View>
      <Text style={styles.fieldLabel}>Exercise name</Text>
        <View style={styles.moveNameRow}>
          <TextInput
            accessibilityLabel="Exercise name"
            value={moveName}
            onChangeText={setMoveName}
            maxLength={60}
            placeholder="Exercise"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.moveNameInput,
              {
                borderColor: theme.border,
                color: theme.textPrimary,
                backgroundColor: theme.inputBackground,
              },
            ]}
            editable={widgetReady}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
          />
          <ActionButton
            theme={theme}
            title="Save"
            compact
            onPress={saveMove}
            disabled={!widgetReady}
          />
        </View>
      {!!widgetError && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {widgetError}
        </Text>
      )}
      <Text style={styles.sectionLabel}>HEALTH CONNECT</Text>
      <SettingsLink
        theme={theme}
        label={opening ? 'Opening…' : 'Manage Health Connect'}
        accessibilityLabel="Manage Health Connect access"
        disabled={opening || availability?.status !== 'available'}
        onPress={openSettings}
      />
      {availability && availability.status !== 'available' && (
        <Text accessibilityLiveRegion="polite" style={styles.statusText}>
          {availability.message}
        </Text>
      )}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      <SettingsLink theme={theme} label="Privacy Policy" onPress={onPrivacy} />
      <Text style={styles.version}>Version {packageInfo.version}</Text>
    </ScrollView>
  );
}

function SettingsLink({
  theme,
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  theme: Theme;
  label: string;
  onPress: () => unknown;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.rowTitle}>{label}</Text>
      <Text accessibilityElementsHidden style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}

export function PrivacyScreen({
  onBack,
  theme,
}: {
  onBack: () => void;
  theme: Theme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ActionButton
          theme={theme}
          title="‹"
          compact
          onPress={onBack}
          accessibilityLabel="Back to Settings"
        />
        <Text accessibilityRole="header" style={styles.title}>
          Privacy Policy
        </Text>
      </View>
      <Text style={styles.body}>
        Health Entry writes water, caffeine, weight, blood pressure, and exercise
        sessions to your system health data. Trends reads those health data types
        directly from Health Connect. Health Entry does not keep a second health history.
      </Text>
      <Text style={styles.body}>
        Only input preferences, widget defaults, and the last successfully
        entered weight are saved locally to make the next entry faster. No
        accounts, analytics, or server uploads.
      </Text>
      <Text style={styles.body}>
        Development builds log write diagnostics to developer tools.
      </Text>
      <Text style={styles.body}>
        The production privacy policy URL is not configured yet. This screen is
        the route boundary for that future link.
      </Text>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      padding: 20,
      paddingBottom: 32,
      gap: 16,
      backgroundColor: theme.background,
      flexGrow: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 4,
    },
    title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: theme.textSecondary,
      marginTop: 8,
    },
    settingsRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    segment: { flexDirection: 'row', gap: 6 },
    choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fieldLabel: { fontSize: 17, color: theme.textPrimary, marginTop: 2 },
    moveNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    moveNameInput: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      fontSize: 17,
    },
    durationInput: {
      width: 96,
      minHeight: 48,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      fontSize: 18,
      textAlign: 'center',
    },
    customRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      fontSize: 18,
    },
    rowTitle: { fontSize: 17, color: theme.textPrimary },
    statusText: {
      fontSize: 15,
      color: theme.textSecondary,
      flexShrink: 1,
      textAlign: 'right',
    },
    linkRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    chevron: { fontSize: 28, color: theme.textSecondary },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.45 },
    appName: { fontSize: 20, fontWeight: '600', color: theme.textPrimary },
    body: { fontSize: 16, lineHeight: 23, color: theme.textSecondary },
    version: { fontSize: 14, color: theme.textSecondary },
    error: { fontSize: 15, color: theme.error },
  });
