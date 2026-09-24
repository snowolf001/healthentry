import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { systemHealth } from './src/systemHealth';
import { validateBloodPressure, weightToKg } from './src/systemHealth/units';
import { ActionButton } from './src/ui/ActionButton';
import { useAppTheme } from './src/ui/theme';
import { SettingsScreen } from './src/settings/SettingsScreen';
import { TrendsScreen } from './src/trends/TrendsScreen';
import { runHealthEntry, parsePositiveDecimal } from './src/home/entry';
import { useWeightInput, weightEntry } from './src/home/weightInput';
import { logPreferenceFailure } from './src/preferences/weightPreferences';
import {
  defaultWidgetPreferences,
  recentQuickEntries,
  validateMoveMinutes,
  validateWaterWidgetValue,
  widgetPreferences,
} from './src/preferences/widgetPreferences';

import { CaffeinePicker } from './src/home/CaffeinePicker';
import { caffeineEntry, CaffeineKind } from './src/home/caffeine';
import NativeWidgetActions from './specs/NativeWidgetActions';

function App() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [screen, setScreen] = useState<'home' | 'settings' | 'trends'>('home');
  const [feedback, setFeedback] = useState('');
  const [feedbackSection, setFeedbackSection] = useState<'water' | 'caffeine' | 'weight' | 'move' | 'bloodPressure' | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWidgetDiscovery, setShowWidgetDiscovery] = useState(false);
  const [widgetPinSupported, setWidgetPinSupported] = useState(false);
  const [waterValue, setWaterValue] = useState('16');
  const [recentWaterOz, setRecentWaterOz] = useState(16);
  const [moveValue, setMoveValue] = useState('30');
  const [recentMoveMinutes, setRecentMoveMinutes] = useState(30);
  const [moveName, setMoveName] = useState('Exercise');
  const [caffeineKind, setCaffeineKind] = useState<CaffeineKind | null>(null);
  const [systolicValue, setSystolicValue] = useState('');
  const [diastolicValue, setDiastolicValue] = useState('');
  const weight = useWeightInput();
  const guard = runHealthEntry;

  useEffect(() => {
    void recentQuickEntries.load().then(recent => {
      setRecentWaterOz(recent.waterOz);
      setWaterValue(String(recent.waterOz));
      setRecentMoveMinutes(recent.moveMinutes);
      setMoveValue(String(recent.moveMinutes));
    });
    void widgetPreferences.load().then(preferences => setMoveName(preferences.moveName)).catch(() => {});
    void NativeWidgetActions?.loadWidgetDiscovery().then(raw => {
      const state = JSON.parse(raw) as { dismissed: boolean; hasWidget: boolean; pinSupported: boolean };
      setShowWidgetDiscovery(!state.dismissed && !state.hasWidget);
      setWidgetPinSupported(state.pinSupported);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'home') {
        return false;
      }
      setScreen('home');
      return true;
    });
    return () => listener.remove();
  }, [screen]);
  const runEntry = useCallback(
    async (
      write: () => Promise<unknown>,
      success: string,
      section: 'water' | 'caffeine' | 'weight' | 'move' | 'bloodPressure',
      afterSuccess?: () => void,
    ) => {
      await guard(async () => {
        setBusy(true);
        setFeedbackSection(section);
        setFeedback('Adding…');
        try {
          try {
            await write();
          } catch (error) {
            setFeedback(
              `Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return;
          }
          setFeedback(success);
          // Preferences are a separate concern: never turn a saved record into a write failure.
          try {
            afterSuccess?.();
          } catch {
            logPreferenceFailure();
          }
        } finally {
          setBusy(false);
        }
      });
    },
    [guard],
  );

  const addWater = useCallback(
    (ounces: number) => {
      return runEntry(
        () => systemHealth.addWater({ value: ounces, unit: 'us-fl-oz' }),
        `✓ Added ${ounces} oz water`,
        'water',
      );
    },
    [runEntry],
  );
  function addOtherWater() {
    let value: number;
    try {
      value = validateWaterWidgetValue(waterValue);
    } catch (error) {
      setFeedbackSection('water');
      setFeedback((error as Error).message);
      return;
    }
    return runEntry(
      () => systemHealth.addWater({ value, unit: 'us-fl-oz' }),
      `✓ Added ${value} oz water`,
      'water',
      () => {
        setWaterValue(String(value));
        if (value !== 8 && value !== 12) {
          setRecentWaterOz(value);
          void recentQuickEntries.saveWaterOz(value).catch(logPreferenceFailure);
        }
      },
    );
  }
  function addCaffeine(entry: ReturnType<typeof caffeineEntry>) {
    return runEntry(
      () => systemHealth.addCaffeine(entry.input),
      `✓ ${entry.success}`,
      'caffeine',
      () => setCaffeineKind(null),
    );
  }
  function addWeight() {
    if (!weight.ready) {
      return;
    }
    try {
      const input = weightEntry(weight.draft, weight.unit);
      const kg = weightToKg(input.value, input.unit);
      return runEntry(
        () => systemHealth.addWeight(input),
        `✓ Added ${weight.draft.text.replace(',', '.').trim()} ${weight.unit}`,
        'weight',
        () => weight.rememberSuccess(kg),
      );
    } catch (error) {
      setFeedbackSection('weight');
      setFeedback((error as Error).message);
    }
  }
  async function addMove(minutes: number) {
    let title = moveName || defaultWidgetPreferences.moveName;
    try {
      const preferences = await widgetPreferences.load();
      title = preferences.moveName;
      setMoveName(title);
    } catch {
      // Preference failure must not block a health entry; use the last loaded/default name.
    }
    return runEntry(
      () => systemHealth.addExercise({ minutes, title }),
      `✓ Added ${title} · ${minutes} min`,
      'move',
    );
  }
  async function addOtherMove() {
    let minutes: number;
    try {
      minutes = validateMoveMinutes(moveValue);
    } catch (error) {
      setFeedbackSection('move');
      setFeedback((error as Error).message);
      return;
    }
    let title = moveName || defaultWidgetPreferences.moveName;
    try {
      const preferences = await widgetPreferences.load();
      title = preferences.moveName;
      setMoveName(title);
    } catch {
      // Preference failure must not block a health entry.
    }
    return runEntry(
      () => systemHealth.addExercise({ minutes, title }),
      `✓ Added ${title} · ${minutes} min`,
      'move',
      () => {
        setMoveValue(String(minutes));
        if (minutes !== 5 && minutes !== 10) {
          setRecentMoveMinutes(minutes);
          void recentQuickEntries.saveMoveMinutes(minutes).catch(logPreferenceFailure);
        }
      },
    );
  }
  async function dismissWidgetDiscovery() {
    setShowWidgetDiscovery(false);
    try { await NativeWidgetActions?.dismissWidgetDiscovery(); } catch {}
  }
  async function addHomeWidget(widget: 'water' | 'coffee' | 'weight' | 'exercise') {
    if (!widgetPinSupported) {
      void Linking.openURL('https://cleanutilityapps.com/healthentry/widgets/');
      return;
    }
    try {
      const requested = await NativeWidgetActions?.requestPinWidget(widget);
      if (!requested) {
        void Linking.openURL('https://cleanutilityapps.com/healthentry/widgets/');
      }
    } catch {
      void Linking.openURL('https://cleanutilityapps.com/healthentry/widgets/');
    }
  }

  function addBloodPressure() {
    if (!systolicValue.trim()) {
      setFeedbackSection('bloodPressure');
      setFeedback('Enter systolic pressure.');
      return;
    }
    if (!diastolicValue.trim()) {
      setFeedbackSection('bloodPressure');
      setFeedback('Enter diastolic pressure.');
      return;
    }
    const systolic = parsePositiveDecimal(systolicValue) ?? NaN;
    const diastolic = parsePositiveDecimal(diastolicValue) ?? NaN;
    try {
      validateBloodPressure({ systolic, diastolic });
    } catch (error) {
      setFeedbackSection('bloodPressure');
      setFeedback((error as Error).message);
      return;
    }
    return runEntry(
      () => systemHealth.addBloodPressure({ systolic, diastolic }),
      `✓ Added ${systolic}/${diastolic} mmHg`,
      'bloodPressure',
      () => {
        setSystolicValue('');
        setDiastolicValue('');
      },
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container}>
        {screen === 'settings' ? (
          <SettingsScreen
            unit={weight.unit}
            ready={weight.ready}
            onUnit={weight.selectUnit}
            onBack={() => setScreen('home')}
            onPrivacy={() => void Linking.openURL('https://cleanutilityapps.com/healthentry/privacy/')}
            theme={theme}
          />
         ) : screen === 'trends' ? (
          <TrendsScreen onBack={() => setScreen('home')} theme={theme} weightUnit={weight.unit} />
        ) : (
          <KeyboardAvoidingView style={styles.container} behavior="padding">
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title}>
                  Health Entry
                </Text>
                <View style={styles.headerActions}>
                  <ActionButton
                    title="Trends"
                    theme={theme}
                    compact
                    onPress={() => setScreen('trends')}
                    disabled={busy}
                    accessibilityLabel="Open Trends"
                  />
                  <ActionButton
                    title="⚙"
                    theme={theme}
                    compact
                    onPress={() => setScreen('settings')}
                    disabled={busy}
                    accessibilityLabel="Open Settings"
                  />
                </View>
              </View>
              {showWidgetDiscovery && (
                <View style={styles.widgetDiscovery}>
                  <View style={styles.widgetDiscoveryHeader}>
                    <View style={styles.widgetDiscoveryCopy}>
                      <Text style={styles.widgetDiscoveryTitle}>Log faster with Home Screen widgets</Text>
                      <Text style={styles.widgetDiscoveryText}>Add Water, Coffee, Weight, or Exercise for quick access.</Text>
                    </View>
                    <Text accessibilityRole="button" accessibilityLabel="Dismiss widget tip" onPress={dismissWidgetDiscovery} style={styles.dismissWidget}>×</Text>
                  </View>
                  <View style={styles.widgetDiscoveryActions}>
                    {(['water', 'coffee', 'weight', 'exercise'] as const).map(widget => (
                      <ActionButton
                        key={widget}
                        compact
                        title={widget === 'exercise' ? 'Exercise' : widget[0].toUpperCase() + widget.slice(1)}
                        theme={theme}
                        onPress={() => void addHomeWidget(widget)}
                      />
                    ))}
                  </View>
                  <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://cleanutilityapps.com/healthentry/widgets/')} style={styles.howToLink}>How to add widgets ›</Text>
                </View>
              )}
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.label}>
                  WATER
                </Text>
                <View style={styles.row}>
                  <ActionButton
                    title="8 oz"
                    theme={theme}
                    onPress={() => addWater(8)}
                    disabled={busy}
                  />
                  <ActionButton
                    title="12 oz"
                    theme={theme}
                    onPress={() => addWater(12)}
                    disabled={busy}
                  />
                  <ActionButton
                    title={`${recentWaterOz} oz`}
                    theme={theme}
                    onPress={() => addWater(recentWaterOz)}
                    disabled={busy}
                  />
                </View>
                <View style={styles.customRow}>
                  <TextInput
                    accessibilityLabel="Water amount in US fluid ounces"
                    placeholder="Amount"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={waterValue}
                    onChangeText={setWaterValue}
                    style={[styles.input, busy && styles.disabledControl]}
                    editable={!busy}
                  />
                  <Text style={styles.unitSuffix}>oz</Text>
                  <ActionButton compact primary title="Add" theme={theme} onPress={addOtherWater} disabled={busy} />
                </View>
                {feedbackSection === 'water' && <EntryFeedback busy={busy} feedback={feedback} theme={theme} styles={styles} />}
              </View>
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.label}>
                  CAFFEINE
                </Text>
                <View style={styles.row}>
                  {(['Coffee', 'Espresso', 'Caffeine'] as const).map(kind => (
                    <ActionButton
                      key={kind}
                      title={kind}
                      theme={theme}
                      testID={
                        kind === 'Caffeine' ? 'other-caffeine' : undefined
                      }
                      disabled={busy}
                      onPress={() =>
                        setCaffeineKind(caffeineKind === kind ? null : kind)
                      }
                    />
                  ))}
                </View>
                {caffeineKind && (
                  <CaffeinePicker
                    key={caffeineKind}
                    initialKind={caffeineKind}
                    busy={busy}
                    onSubmit={addCaffeine}
                    onClose={() => setCaffeineKind(null)}
                  />
                )}
                {feedbackSection === 'caffeine' && <EntryFeedback busy={busy} feedback={feedback} theme={theme} styles={styles} />}
              </View>
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.label}>
                  WEIGHT
                </Text>
                <View style={styles.row}>
                  <TextInput
                    accessibilityLabel={`Weight in ${
                      weight.unit === 'lb' ? 'pounds' : 'kilograms'
                    }`}
                    placeholder="Weight"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={weight.draft.text}
                    onChangeText={weight.setText}
                    style={[
                      styles.input,
                      (busy || !weight.ready) && styles.disabledControl,
                    ]}
                    editable={!busy && weight.ready}
                  />
                  <ActionButton
                    compact
                    title={weight.unit}
                    theme={theme}
                    accessibilityLabel={`Weight unit ${
                      weight.unit
                    }, switch to ${weight.unit === 'lb' ? 'kg' : 'lb'}`}
                    onPress={weight.switchUnit}
                    disabled={busy || !weight.ready}
                  />
                  <ActionButton
                    compact
                    primary
                    title="Add"
                    theme={theme}
                    onPress={addWeight}
                    disabled={busy || !weight.ready}
                  />
                </View>
                {!weight.ready && (
                  <Text style={styles.hint}>Loading input preference…</Text>
                )}
                {feedbackSection === 'weight' && <EntryFeedback busy={busy} feedback={feedback} theme={theme} styles={styles} />}
              </View>
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.label}>
                  MOVE
                </Text>
                <View style={styles.row}>
                  <ActionButton title="5 min" theme={theme} onPress={() => addMove(5)} disabled={busy} />
                  <ActionButton title="10 min" theme={theme} onPress={() => addMove(10)} disabled={busy} />
                  <ActionButton title={`${recentMoveMinutes} min`} theme={theme} onPress={() => addMove(recentMoveMinutes)} disabled={busy} />
                </View>
                <View style={styles.customRow}>
                  <TextInput
                    accessibilityLabel="Exercise duration in minutes"
                    placeholder="Minutes"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={moveValue}
                    onChangeText={text => setMoveValue(text.replace(/[^0-9]/g, ''))}
                    style={[styles.input, busy && styles.disabledControl]}
                    editable={!busy}
                  />
                  <Text style={styles.unitSuffix}>min</Text>
                  <ActionButton compact primary title="Add" theme={theme} onPress={addOtherMove} disabled={busy} />
                </View>
                {feedbackSection === 'move' && <EntryFeedback busy={busy} feedback={feedback} theme={theme} styles={styles} />}
              </View>
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.label}>
                  BLOOD PRESSURE
                </Text>
                <View style={styles.bloodPressureRow}>
                  <TextInput
                    accessibilityLabel="Systolic pressure"
                    placeholder="Systolic"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={systolicValue}
                    onChangeText={text =>
                      setSystolicValue(text.replace(/[^0-9]/g, ''))
                    }
                    style={[
                      styles.pressureInput,
                      busy && styles.disabledControl,
                    ]}
                    editable={!busy}
                  />
                  <Text style={styles.pressureSeparator}>/</Text>
                  <TextInput
                    accessibilityLabel="Diastolic pressure"
                    placeholder="Diastolic"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={diastolicValue}
                    onChangeText={text =>
                      setDiastolicValue(text.replace(/[^0-9]/g, ''))
                    }
                    style={[
                      styles.pressureInput,
                      busy && styles.disabledControl,
                    ]}
                    editable={!busy}
                  />
                  <Text style={styles.inlinePressureUnit}>mmHg</Text>
                  <ActionButton
                    compact
                    primary
                    title="Add"
                    theme={theme}
                    accessibilityLabel="Add blood pressure"
                    onPress={addBloodPressure}
                    disabled={busy}
                  />
                </View>
                {feedbackSection === 'bloodPressure' && <EntryFeedback busy={busy} feedback={feedback} theme={theme} styles={styles} />}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function EntryFeedback({ busy, feedback, theme, styles }: {
  busy: boolean;
  feedback: string;
  theme: ReturnType<typeof useAppTheme>;
  styles: { status: object; feedback: object; error: object };
}) {
  return (
    <View style={styles.status}>
      {busy && <ActivityIndicator color={theme.accent} accessibilityLabel="Writing entry" />}
      {!!feedback && (
        <Text
          accessibilityLiveRegion="polite"
          selectable
          style={[styles.feedback, !busy && !feedback.startsWith('✓') && styles.error]}
        >
          {feedback}
        </Text>
      )}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 18, paddingBottom: 24, gap: 14 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: {
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: -0.8,
      color: theme.textPrimary,
    },
    widgetDiscovery: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
      gap: 12,
      backgroundColor: theme.surface,
    },
    widgetDiscoveryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    widgetDiscoveryCopy: { flex: 1, gap: 4 },
    widgetDiscoveryTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    widgetDiscoveryText: { fontSize: 13, lineHeight: 18, color: theme.textSecondary },
    widgetDiscoveryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dismissWidget: { fontSize: 24, lineHeight: 24, color: theme.textSecondary, paddingHorizontal: 4 },
    howToLink: { fontSize: 14, fontWeight: '600', color: theme.accent },
    section: {
      gap: 9,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    label: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 1.4,
      color: theme.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },
    customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bloodPressureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pressureInput: {
      width: 76,
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 56,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 10,
      color: theme.textPrimary,
      backgroundColor: theme.inputBackground,
      fontSize: 18,
    },
    pressureSeparator: { fontSize: 22, color: theme.textSecondary },
    inlinePressureUnit: { fontSize: 14, color: theme.textSecondary, flexShrink: 1 },
    unitSuffix: { fontSize: 17, color: theme.textSecondary },
    disabledControl: { opacity: 0.55, borderColor: theme.disabled },
    hint: { fontSize: 14, color: theme.textSecondary },
    input: {
      minWidth: 110,
      flexGrow: 1,
      flexBasis: 110,
      minHeight: 56,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: theme.textPrimary,
      backgroundColor: theme.inputBackground,
      fontSize: 22,
    },
    status: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    feedback: { flex: 1, fontSize: 16, lineHeight: 22, color: theme.success },
    error: { color: theme.error },
  });
export default App;
