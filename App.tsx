import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { systemHealth } from './src/systemHealth';
import {
  validateBloodPressure,
  validateCaffeine,
  weightToKg,
} from './src/systemHealth/units';
import { ActionButton } from './src/ui/ActionButton';
import { useAppTheme } from './src/ui/theme';
import { SettingsScreen, PrivacyScreen } from './src/settings/SettingsScreen';
import { runHealthEntry, parsePositiveDecimal } from './src/home/entry';
import { useWeightInput, weightEntry } from './src/home/weightInput';
import { logPreferenceFailure } from './src/preferences/weightPreferences';

const caffeinePresets = [
  { label: 'Coffee', milligrams: 95 },
  { label: 'Espresso', milligrams: 63 },
] as const;

function App() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [screen, setScreen] = useState<'home' | 'settings' | 'privacy'>('home');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [otherWater, setOtherWater] = useState(false);
  const [waterValue, setWaterValue] = useState('');
  const [otherCaffeine, setOtherCaffeine] = useState(false);
  const [caffeineValue, setCaffeineValue] = useState('');
  const [systolicValue, setSystolicValue] = useState('');
  const [diastolicValue, setDiastolicValue] = useState('');
  const weight = useWeightInput();
  const guard = runHealthEntry;

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'home') {
        return false;
      }
      setScreen(screen === 'privacy' ? 'settings' : 'home');
      return true;
    });
    return () => listener.remove();
  }, [screen]);
  const runEntry = useCallback(
    async (
      write: () => Promise<unknown>,
      success: string,
      afterSuccess?: () => void,
    ) => {
      await guard(async () => {
        setBusy(true);
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
      );
    },
    [runEntry],
  );
  function addOtherWater() {
    const value = parsePositiveDecimal(waterValue);
    if (value === null) {
      setFeedback('Enter a water amount greater than zero.');
      return;
    }
    return runEntry(
      () => systemHealth.addWater({ value, unit: 'us-fl-oz' }),
      `✓ Added ${value} oz water`,
      () => {
        setOtherWater(false);
        setWaterValue('');
      },
    );
  }
  const addCaffeine = useCallback(
    (milligrams: number, label: string) => {
      try {
        validateCaffeine(milligrams);
      } catch (error) {
        setFeedback((error as Error).message);
        return;
      }
      return runEntry(
        () => systemHealth.addCaffeine({ milligrams, label }),
        `✓ Added ${label} · ${milligrams} mg`,
      );
    },
    [runEntry],
  );

  function addOtherCaffeine() {
    const value = parsePositiveDecimal(caffeineValue) ?? NaN;
    try {
      validateCaffeine(value);
    } catch (error) {
      setFeedback((error as Error).message);
      return;
    }
    return runEntry(
      () => systemHealth.addCaffeine({ milligrams: value, label: 'Caffeine' }),
      `✓ Added Caffeine · ${value} mg`,
      () => {
        setOtherCaffeine(false);
        setCaffeineValue('');
      },
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
        () => weight.rememberSuccess(kg),
      );
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }
  function addBloodPressure() {
    if (!systolicValue.trim()) {
      setFeedback('Enter systolic pressure.');
      return;
    }
    if (!diastolicValue.trim()) {
      setFeedback('Enter diastolic pressure.');
      return;
    }
    const systolic = parsePositiveDecimal(systolicValue) ?? NaN;
    const diastolic = parsePositiveDecimal(diastolicValue) ?? NaN;
    try {
      validateBloodPressure({ systolic, diastolic });
    } catch (error) {
      setFeedback((error as Error).message);
      return;
    }
    return runEntry(
      () => systemHealth.addBloodPressure({ systolic, diastolic }),
      `✓ Added ${systolic}/${diastolic} mmHg`,
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
            onPrivacy={() => setScreen('privacy')}
            theme={theme}
          />
        ) : screen === 'privacy' ? (
          <PrivacyScreen onBack={() => setScreen('settings')} theme={theme} />
        ) : (
          <KeyboardAvoidingView style={styles.container} behavior="padding">
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title}>
                  HealthEntry
                </Text>
                <ActionButton
                  title="⚙"
                  theme={theme}
                  compact
                  onPress={() => setScreen('settings')}
                  disabled={busy}
                  accessibilityLabel="Open Settings"
                />
              </View>
              <View style={styles.status}>
                {busy && (
                  <ActivityIndicator
                    color={theme.accent}
                    accessibilityLabel="Writing entry"
                  />
                )}
                <Text
                  accessibilityLiveRegion="polite"
                  selectable
                  style={[
                    styles.feedback,
                    !!feedback &&
                      !busy &&
                      !feedback.startsWith('✓') &&
                      styles.error,
                  ]}
                >
                  {feedback || 'Quick entries. Your system health data.'}
                </Text>
              </View>
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.label}>
                  WATER
                </Text>
                <View style={styles.row}>
                  <ActionButton
                    title="+8 oz"
                    theme={theme}
                    onPress={() => addWater(8)}
                    disabled={busy}
                  />
                  <ActionButton
                    title="+12 oz"
                    theme={theme}
                    onPress={() => addWater(12)}
                    disabled={busy}
                  />
                  <ActionButton
                    title="Other"
                    theme={theme}
                    testID="other-water"
                    onPress={() => setOtherWater(!otherWater)}
                    disabled={busy}
                  />
                </View>
                {otherWater && (
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
                    <ActionButton
                      title="Add"
                      theme={theme}
                      onPress={addOtherWater}
                      disabled={busy}
                    />
                  </View>
                )}
              </View>
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.label}>
                  CAFFEINE
                </Text>
                <View style={styles.row}>
                  {caffeinePresets.map(preset => (
                    <ActionButton
                      key={preset.label}
                      theme={theme}
                      title={preset.label}
                      detail={`${preset.milligrams} mg`}
                      onPress={() =>
                        addCaffeine(preset.milligrams, preset.label)
                      }
                      disabled={busy}
                    />
                  ))}
                  <ActionButton
                    title="Other"
                    theme={theme}
                    testID="other-caffeine"
                    onPress={() => setOtherCaffeine(!otherCaffeine)}
                    disabled={busy}
                  />
                </View>
                {otherCaffeine && (
                  <View style={styles.customRow}>
                    <TextInput
                      accessibilityLabel="Caffeine in milligrams"
                      placeholder="Amount"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      value={caffeineValue}
                      onChangeText={setCaffeineValue}
                      style={[styles.input, busy && styles.disabledControl]}
                      editable={!busy}
                    />
                    <Text style={styles.unitSuffix}>mg</Text>
                    <ActionButton
                      title="Add"
                      theme={theme}
                      onPress={addOtherCaffeine}
                      disabled={busy}
                    />
                  </View>
                )}
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
                <Text style={styles.hint}>mmHg</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
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
    title: {
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: -0.8,
      color: theme.textPrimary,
    },
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
      flex: 1,
      minWidth: 0,
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
