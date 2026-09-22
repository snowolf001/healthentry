import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '../ui/ActionButton';
import { useAppTheme } from '../ui/theme';
import { caffeineEntry, caffeinePresets, CaffeineKind } from './caffeine';

export function CaffeinePicker({
  initialKind,
  busy,
  onSubmit,
  onClose,
  widget = false,
}: {
  initialKind: CaffeineKind;
  busy: boolean;
  onSubmit: (entry: ReturnType<typeof caffeineEntry>) => unknown;
  onClose: () => unknown;
  widget?: boolean;
}) {
  const theme = useAppTheme();
  const [kind, setKind] = useState(initialKind);
  const [custom, setCustom] = useState(initialKind === 'Caffeine');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const unit = kind === 'Coffee' ? 'oz' : kind === 'Espresso' ? 'shots' : 'mg';
  function select(next: CaffeineKind) {
    setKind(next);
    setCustom(next === 'Caffeine');
    setText('');
    setError('');
  }
  function submit(value: string) {
    try {
      return onSubmit(caffeineEntry(kind, value));
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  let estimate = '';
  try {
    if (kind !== 'Caffeine')
      estimate = `~${caffeineEntry(kind, text).input.milligrams} mg caffeine`;
  } catch {
    /* Show validation only after Add. */
  }
  return (
    <View style={styles.panel}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.textPrimary }]}
      >
        {kind}
      </Text>
      {kind !== 'Caffeine' && (
        <Text style={{ color: theme.textSecondary }}>
          {kind === 'Coffee'
            ? 'Caffeine estimates · brewed coffee'
            : 'Caffeine estimates · use shots, including lattes and Americanos'}
        </Text>
      )}
      {!custom ? (
        <View style={styles.grid}>
          {caffeinePresets[kind as 'Coffee' | 'Espresso'].map(value => {
            const mg = caffeineEntry(kind, String(value)).input.milligrams;
            const title =
              kind === 'Coffee'
                ? `${value} oz`
                : `${value} ${value === 1 ? 'shot' : 'shots'}`;
            return (
              <ActionButton
                key={value}
                title={title}
                accessibilityLabel={title}
                detail={`${
                  kind === 'Coffee' && value !== 8 ? '~' : ''
                }${mg} mg`}
                theme={theme}
                disabled={busy}
                onPress={() => submit(String(value))}
              />
            );
          })}
          {widget && kind === 'Coffee' && (
            <ActionButton
              title="Espresso"
              detail="Select shots"
              theme={theme}
              disabled={busy}
              onPress={() => select('Espresso')}
            />
          )}
          <ActionButton
            title="Other"
            accessibilityLabel={`Other ${kind.toLowerCase()}`}
            theme={theme}
            disabled={busy}
            onPress={() => setCustom(true)}
          />
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <TextInput
              accessibilityLabel={
                kind === 'Caffeine'
                  ? 'Caffeine in milligrams'
                  : `${kind} in ${unit}`
              }
              autoFocus
              keyboardType="decimal-pad"
              value={text}
              onChangeText={setText}
              editable={!busy}
              placeholder="Amount"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  color: theme.textPrimary,
                  borderColor: theme.border,
                  backgroundColor: theme.inputBackground,
                },
              ]}
            />
            <Text style={{ color: theme.textSecondary }}>{unit}</Text>
            <ActionButton
              title="Add"
              accessibilityLabel={`Add ${kind.toLowerCase()}`}
              compact
              theme={theme}
              disabled={busy}
              onPress={() => submit(text)}
            />
          </View>
          {!!estimate && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: theme.textSecondary }}
            >
              {estimate}
            </Text>
          )}
        </>
      )}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {error}
        </Text>
      )}
      <View style={[styles.row, styles.navigation]}>
        {widget && kind !== 'Caffeine' && (
          <ActionButton
            title="Caffeine"
            detail="Enter mg"
            compact
            theme={theme}
            disabled={busy}
            onPress={() => select('Caffeine')}
          />
        )}
        {((custom && kind !== 'Caffeine') || kind !== initialKind) && (
          <ActionButton
            title="Back"
            compact
            theme={theme}
            disabled={busy}
            onPress={() =>
              custom && kind !== 'Caffeine'
                ? setCustom(false)
                : select(initialKind)
            }
          />
        )}
        <ActionButton
          title="Cancel"
          compact
          theme={theme}
          disabled={busy}
          onPress={onClose}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: 20 },
  panel: { gap: 10 },
  navigation: { flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    minWidth: 60,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 20,
  },
});
