import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { systemHealth } from '../systemHealth';
import type {
  DailyTrend,
  TrendData,
  TrendRangeDays,
} from '../systemHealth/types';
import { ActionButton } from '../ui/ActionButton';
import type { Theme } from '../ui/theme';

type Props = { onBack: () => void; theme: Theme };
const ranges: TrendRangeDays[] = [7, 30, 90];

export function TrendsScreen({ onBack, theme }: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [days, setDays] = useState<TrendRangeDays>(7);
  const [data, setData] = useState<TrendData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    systemHealth
      .readTrends(days)
      .then(value => active && setData(value))
      .catch(reason => {
        if (active) {
          setData(null);
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [days]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ActionButton
          theme={theme}
          title="‹"
          compact
          onPress={onBack}
          accessibilityLabel="Back to Home"
        />
        <Text accessibilityRole="header" style={styles.title}>Trends</Text>
      </View>
      <View style={styles.ranges}>
        {ranges.map(value => (
          <ActionButton
            key={value}
            theme={theme}
            title={`${value}D`}
            compact
            selected={days === value}
            onPress={() => setDays(value)}
          />
        ))}
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accent} />
          <Text style={styles.secondary}>Reading Health Connect…</Text>
        </View>
      ) : error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
      ) : data ? (
        <>
          <DailyCard
            title="Water"
            unit="oz"
            rows={data.daily}
            value={row => row.waterMl / 29.5735295625}
            theme={theme}
            days={days}
          />
          <DailyCard
            title="Caffeine"
            unit="mg"
            rows={data.daily}
            value={row => row.caffeineMg}
            theme={theme}
            days={days}
          />
          <DailyCard
            title="Exercise"
            unit="min"
            rows={data.daily}
            value={row => row.exerciseMinutes}
            detail={row => `${row.exerciseCount} sessions`}
            theme={theme}
            days={days}
          />
          <SeriesCard
            title="Weight"
            unit="kg"
            values={data.weights.map(row => ({ label: row.time, value: row.kilograms }))}
            theme={theme}
            days={days}
          />
          <PressureCard
            values={data.bloodPressures}
            theme={theme}
            days={days}
          />
        </>
      ) : null}
      <Text style={styles.footnote}>
        Trends are read directly from Health Connect. HealthEntry does not keep a second health history.
      </Text>
    </ScrollView>
  );
}

function DailyCard({
  title, unit, rows, value, detail, theme, days,
}: {
  title: string;
  unit: string;
  rows: DailyTrend[];
  value: (row: DailyTrend) => number;
  detail?: (row: DailyTrend) => string;
  theme: Theme;
  days: TrendRangeDays;
}) {
  const values = rows.map(value);
  const latest = rows[rows.length - 1];
  return (
    <ChartCard
      title={title}
      summary={`${format(values[values.length - 1] ?? 0)} ${unit}`}
      detail={latest && detail ? detail(latest) : undefined}
      values={values}
      labels={rows.map(row => axisLabel(row.date, days))}
      theme={theme}
    />
  );
}

function SeriesCard({
  title, unit, values, theme, days,
}: {
  title: string;
  unit: string;
  values: { label: string; value: number }[];
  theme: Theme;
  days: TrendRangeDays;
}) {
  return (
    <ChartCard
      title={title}
      summary={values.length ? `${format(values[values.length - 1].value)} ${unit}` : 'No data'}
      values={values.map(item => item.value)}
      labels={values.map(item => axisLabel(item.label, days))}
      theme={theme}
    />
  );
}

function PressureCard({
  values, theme, days,
}: {
  values: { time: string; systolic: number; diastolic: number }[];
  theme: Theme;
  days: TrendRangeDays;
}) {
  const latest = values[values.length - 1];
  return (
    <ChartCard
      title="Blood pressure"
      summary={latest ? `${format(latest.systolic)}/${format(latest.diastolic)} mmHg` : 'No data'}
      values={values.map(item => item.systolic)}
      secondaryValues={values.map(item => item.diastolic)}
      labels={values.map(item => axisLabel(item.time, days))}
      theme={theme}
    />
  );
}

function ChartCard({
  title, summary, detail, values, secondaryValues, labels, theme,
}: {
  title: string;
  summary: string;
  detail?: string;
  values: number[];
  secondaryValues?: number[];
  labels?: string[];
  theme: Theme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const all = [...values, ...(secondaryValues ?? [])];
  const max = Math.max(1, ...all);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View>
          <Text style={styles.summary}>{summary}</Text>
          {!!detail && <Text style={styles.detail}>{detail}</Text>}
        </View>
      </View>
      {values.length ? (
        <View
          style={styles.chart}
          accessibilityLabel={`${title} trend chart`}
        >
          {values.map((value, index) => (
            <View key={index} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max(value > 0 ? 4 : 0, (value / max) * 100)}%` },
                ]}
              />
              {secondaryValues && (
                <View
                  style={[
                    styles.secondaryBar,
                    { height: `${Math.max(secondaryValues[index] > 0 ? 4 : 0, (secondaryValues[index] / max) * 100)}%` },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.secondary}>No records in this range.</Text>
      )}
      {!!labels?.length && values.length > 0 && (
        <View style={styles.axis}>
          {labels.map((label, index) => (
            <Text key={index} style={styles.axisLabel} numberOfLines={1}>{label}</Text>
          ))}
        </View>
      )}
      {!values.length ? (
        <Text style={styles.secondary}>No records in this range.</Text>
      ) : null}
    </View>
  );
}

function axisLabel(value: string, days: TrendRangeDays) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (days === 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
  if (days === 30) return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return date.toLocaleDateString(undefined, { month: 'short' });
}

function format(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const createStyles = (theme: Theme) => StyleSheet.create({
  content: { padding: 18, paddingBottom: 32, gap: 14, backgroundColor: theme.background, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  ranges: { flexDirection: 'row', gap: 8 },
  loading: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 10 },
  card: { borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, gap: 12, backgroundColor: theme.inputBackground },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  summary: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, textAlign: 'right' },
  detail: { fontSize: 13, color: theme.textSecondary, textAlign: 'right' },
  chart: { height: 112, flexDirection: 'row', alignItems: 'flex-end', gap: 2, overflow: 'hidden' },
  barSlot: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  bar: { flex: 1, minWidth: 1, borderRadius: 2, backgroundColor: theme.accent },
  secondaryBar: { flex: 1, minWidth: 1, borderRadius: 2, backgroundColor: theme.textSecondary },
  axis: { flexDirection: 'row', minHeight: 18, gap: 2 },
  axisLabel: { flex: 1, color: theme.textSecondary, fontSize: 9, textAlign: 'center' },
  secondary: { color: theme.textSecondary, fontSize: 14 },
  error: { color: theme.error, fontSize: 15, lineHeight: 21 },
  footnote: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
});
