import { Pressable, StyleSheet, Text } from 'react-native';
import type { Theme } from './theme';

type Props = {
  title: string;
  detail?: string;
  onPress: () => unknown;
  disabled?: boolean;
  selected?: boolean;
  compact?: boolean;
  primary?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  theme: Theme;
};

export function ActionButton({
  title,
  detail,
  onPress,
  disabled = false,
  selected,
  compact,
  primary,
  accessibilityLabel,
  testID,
  theme,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (detail ? `${title} · ${detail}` : title)
      }
      accessibilityState={{ disabled, selected }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
        compact && styles.compact,
        (primary || selected) && {
          backgroundColor: theme.accent,
          borderColor: theme.accent,
        },
        pressed && { backgroundColor: theme.accentPressed },
        disabled && { opacity: 0.45, borderColor: theme.disabled },
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          styles.title,
          { color: primary || selected ? theme.accentText : theme.textPrimary },
        ]}
      >
        {title}
      </Text>
      {detail && (
        <Text
          style={[
            styles.detail,
            {
              color:
                primary || selected ? theme.accentText : theme.textSecondary,
            },
          ]}
        >
          {detail}
        </Text>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    minWidth: 88,
    flexGrow: 1,
    flexBasis: 88,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  compact: { flexGrow: 0, flexBasis: 'auto', minWidth: 56, minHeight: 48 },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  detail: { fontSize: 15, marginTop: 3, textAlign: 'center' },
});
