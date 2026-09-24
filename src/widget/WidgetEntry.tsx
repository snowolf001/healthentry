import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputInstance,
  View,
} from 'react-native';
import { CaffeinePicker } from '../home/CaffeinePicker';
import { caffeineEntry } from '../home/caffeine';
import { useWeightInput, weightEntry } from '../home/weightInput';
import { systemHealth } from '../systemHealth';
import { useAppTheme } from '../ui/theme';
import { submitWidgetEntry, widgetBridge } from './widgetSubmission';

export default function WidgetEntry({ sessionId }: { sessionId: string }) {
  const theme = useAppTheme();
  const weight = useWeightInput();
  const [action, setAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const input = useRef<TextInputInstance>(null);
  const launch = useRef<Promise<string | null> | null>(null);
  const handled = useRef(false);
  const submitting = useRef(false);
  const styles = makeStyles(theme);

  useEffect(() => {
    // Native consumeLaunch is one-shot across JS reloads and repeated effects.
    let mounted = true;
    launch.current ??= widgetBridge().consumeLaunch(sessionId);
    launch.current
      .then(async next => {
        if (!mounted || handled.current) {
          return;
        }
        handled.current = true;
        if (!next) {
          await widgetBridge().finish(sessionId, '');
          return;
        } // Restored/reloaded roots never submit again.
        const [kind, preset] = next.split(':');
        setAction(
          kind === 'coffee'
            ? preset === 'ask'
              ? 'coffee'
              : 'quick'
            : kind,
        );
        if (kind === 'water') {
          const ounces = Number(preset);
          submitting.current = true;
          setBusy(true);
          const failure = await submitWidgetEntry(
            sessionId,
            () => systemHealth.addWater({ value: ounces, unit: 'us-fl-oz' }),
            `Added ${ounces} oz water`,
          );
          if (failure) {
            await widgetBridge().finish(sessionId, failure);
          }
        } else if (kind === 'exercise') {
          const parts = next.split(':');
          const minutes = Number(parts[1]);
          const title = decodeURIComponent(parts.slice(2).join(':') || 'Exercise');
          if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
            throw new Error('Entry unavailable.');
          }
          submitting.current = true;
          setBusy(true);
          const failure = await submitWidgetEntry(
            sessionId,
            () => systemHealth.addExercise({ minutes, title }),
            `Added ${title} · ${minutes} min`,
          );
          if (failure) await widgetBridge().finish(sessionId, failure);
        } else if (kind === 'coffee' && preset !== 'ask') {
          const match = /^(coffee|espresso)(\d+)$/.exec(preset);
          if (!match) throw new Error('Entry unavailable.');
          const entry = caffeineEntry(
            match[1] === 'coffee' ? 'Coffee' : 'Espresso',
            match[2],
          );
          submitting.current = true;
          setBusy(true);
          const failure = await submitWidgetEntry(
            sessionId,
            () => systemHealth.addCaffeine(entry.input),
            entry.success,
          );
          if (failure) await widgetBridge().finish(sessionId, failure);
        }
      })
      .catch(() => {
        if (mounted) {
          setFeedback('Entry unavailable. Close and try again.');
        }
      });
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (action === 'weight' && weight.ready && !busy) {
      input.current?.focus();
    }
  }, [action, weight.ready, busy]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!submitting.current) {
        widgetBridge().finish(sessionId, '');
      }
      return true;
    });
    return () => back.remove();
  }, [sessionId]);

  async function addCaffeine(entry: ReturnType<typeof caffeineEntry>) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const failure = await submitWidgetEntry(
      sessionId,
      () => systemHealth.addCaffeine(entry.input),
      entry.success,
    );
    // Close on failure; never automatically retry an ambiguous write.
    if (failure) await widgetBridge().finish(sessionId, failure);
  }

  async function addWeight() {
    if (submitting.current || !weight.ready) {
      return;
    }
    let entry: ReturnType<typeof weightEntry>;
    try {
      entry = weightEntry(weight.draft, weight.unit);
    } catch (error) {
      setFeedback((error as Error).message);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setFeedback('');
    const failure = await submitWidgetEntry(
      sessionId,
      () => systemHealth.addWeight(entry),
      `Added ${weight.draft.text.replace(',', '.').trim()} ${weight.unit}`,
      () => weight.rememberSuccess(entry.value),
    );
    if (failure) {
      setFeedback(failure);
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.overlay} behavior="padding">
      <View
        style={[styles.dialog, action === 'coffee' && styles.coffeeDialog]}
        accessibilityViewIsModal
      >
        <Text style={styles.brand}>Health Entry</Text>
        {action === 'coffee' ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.coffeeScroll}
          >
            <CaffeinePicker
              initialKind="Coffee"
              widget
              busy={busy}
              onSubmit={addCaffeine}
              onClose={() => widgetBridge().finish(sessionId, '')}
            />
            {busy && (
              <ActivityIndicator
                accessibilityLabel="Adding caffeine"
                color={theme.accent}
              />
            )}
          </ScrollView>
        ) : action === 'weight' ? (
          <>
            <Text style={styles.title} accessibilityRole="header">
              Weight
            </Text>
            <View style={styles.row}>
              <TextInput
                ref={input}
                autoFocus={weight.ready}
                keyboardType="decimal-pad"
                accessibilityLabel={`Weight in ${
                  weight.unit === 'lb' ? 'pounds' : 'kilograms'
                }`}
                value={weight.draft.text}
                onChangeText={weight.setText}
                editable={weight.ready && !busy}
                style={styles.input}
                selectTextOnFocus
              />
              <Text style={styles.unit}>{weight.unit}</Text>
            </View>
            {!!feedback && (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {feedback}
              </Text>
            )}
            {busy && (
              <ActivityIndicator
                accessibilityLabel="Adding weight"
                color={theme.accent}
              />
            )}
            <View style={styles.buttons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel weight entry"
                disabled={busy}
                style={styles.button}
                onPress={() => widgetBridge().finish(sessionId, '')}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add weight"
                disabled={!weight.ready || busy}
                style={styles.button}
                onPress={addWeight}
              >
                <Text style={styles.buttonText}>Add</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <ActivityIndicator
              accessibilityLabel="Adding entry"
              color={theme.accent}
            />
            <Text style={styles.unit} accessibilityLiveRegion="polite">
              {feedback || (action ? 'Adding entry...' : 'Opening entry...')}
            </Text>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
const makeStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    coffeeDialog: { maxHeight: '100%' },
    coffeeScroll: { flexShrink: 1 },
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    dialog: {
      width: '100%',
      maxWidth: 320,
      padding: 20,
      gap: 12,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    brand: { color: theme.textSecondary, fontSize: 12 },
    title: { color: theme.textPrimary, fontSize: 20, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    input: {
      flex: 1,
      minHeight: 48,
      padding: 10,
      borderWidth: 1,
      borderRadius: 8,
      borderColor: theme.border,
      color: theme.textPrimary,
      backgroundColor: theme.inputBackground,
      fontSize: 22,
    },
    unit: { color: theme.textSecondary, fontSize: 16 },
    error: { color: theme.error, fontSize: 14 },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    button: {
      minWidth: 64,
      minHeight: 48,
      padding: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: { color: theme.accent, fontSize: 16, fontWeight: '600' },
  });
