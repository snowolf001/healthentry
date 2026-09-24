import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import { getProState, loadProProducts, purchasePro, restorePro, type ProProduct, type ProState } from '../pro/pro';

type Props = { onBack: () => void; theme: Theme; weightUnit: 'lb' | 'kg' };
type DisplayRangeDays = 1 | TrendRangeDays;
const ranges: DisplayRangeDays[] = [1, 7, 30, 90];

export function TrendsScreen({ onBack, theme, weightUnit, startInPaywall = false }: Props & { startInPaywall?: boolean }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [days, setDays] = useState<DisplayRangeDays>(1);
  const [pro, setPro] = useState<ProState>({ isPro: false, widgetTrialStarted: false, widgetTrialDaysRemaining: 14 });
  const [showPaywall, setShowPaywall] = useState(startInPaywall);
  const [data, setData] = useState<TrendData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await systemHealth.readTrends(days === 1 ? 7 : days);
      if (days === 1) {
        const today = new Date().toLocaleDateString('en-CA');
        setData({
          daily: loaded.daily.filter(row => row.date === today),
          weights: loaded.weights.filter(row => new Date(row.time).toLocaleDateString('en-CA') === today),
          bloodPressures: loaded.bloodPressures.filter(row => new Date(row.time).toLocaleDateString('en-CA') === today),
        });
      } else {
        setData(loaded);
      }
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void getProState().then(setPro);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  if (showPaywall) {
    return <ProPaywall theme={theme} pro={pro} onState={state => { setPro(state); if (state.isPro) setShowPaywall(false); }} onBack={() => setShowPaywall(false)} />;
  }

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
            title={value === 1 ? 'Today' : `${value}D`}
            compact
            selected={days === value}
            onPress={() => { if (value === 1 || pro.isPro) setDays(value); else setShowPaywall(true); }}
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
            days={days === 1 ? 7 : days}
          />
          <DailyCard
            title="Caffeine"
            unit="mg"
            rows={data.daily}
            value={row => row.caffeineMg}
            theme={theme}
            days={days === 1 ? 7 : days}
          />
          <DailyCard
            title="Exercise"
            unit="min"
            rows={data.daily}
            value={row => row.exerciseMinutes}
            detail={row => `${row.exerciseCount} sessions`}
            theme={theme}
            days={days === 1 ? 7 : days}
          />
          <SeriesCard
            title="Weight"
            unit={weightUnit}
            values={dailyWeightAverages(data.weights, weightUnit)}
            theme={theme}
            days={days === 1 ? 7 : days}
          />
          <PressureCard
            values={data.bloodPressures}
            theme={theme}
            days={days === 1 ? 7 : days}
          />
        </>
      ) : null}
      <Text style={styles.footnote}>
        Trends are read directly from Health Connect. HealthEntry does not keep a second health history.
      </Text>
    </ScrollView>
  );
}

function ProPaywall({ theme, pro, onState, onBack }: { theme: Theme; pro: ProState; onState: (state: ProState) => void; onBack: () => void }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [products, setProducts] = useState<ProProduct[]>([]);
  const [message, setMessage] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [busy, setBusy] = useState(false);
  const loadPlans = useCallback(async () => {
    setLoadingPlans(true); setMessage('');
    try {
      const loaded = await loadProProducts();
      setProducts(loaded);
      if (!loaded.length) setMessage('Plans are unavailable. Install HealthEntry from a Google Play test or production track, then try again.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setLoadingPlans(false); }
  }, []);
  useEffect(() => { void loadPlans(); }, [loadPlans]);
  async function buy(productId: string) {
    setBusy(true); setMessage('');
    try { onState(await purchasePro(productId)); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function restore() {
    setBusy(true); setMessage('');
    try { const state = await restorePro(); onState(state); if (!state.isPro) setMessage('No active HealthEntry Pro subscription was found.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><ActionButton theme={theme} title="‹" compact onPress={onBack} accessibilityLabel="Back from HealthEntry Pro" /><Text style={styles.title}>HealthEntry Pro</Text></View>
      <Text style={styles.proHeadline}>See more. Log faster.</Text>
      <View style={styles.proBenefits}>
        <Text style={styles.proBenefit}>✓ 7, 30 & 90-day health trends</Text>
        <Text style={styles.proBenefit}>✓ Keep all 4 Home Screen widgets</Text>
      </View>
      <Text style={styles.secondary}>
        {!pro.widgetTrialStarted ? 'Widgets are free for 14 days starting with your first widget use.' : !pro.isPro ? `${pro.widgetTrialDaysRemaining} days left in your widget trial.` : 'HealthEntry Pro is active.'}
      </Text>
      {products.map(product => {
        const yearly = product.productId.endsWith('yearly');
        return (
          <View key={product.productId} style={styles.planCard}>
            <View style={styles.planCopy}>
              <Text style={styles.planTitle}>{yearly ? 'Yearly' : 'Monthly'}</Text>
              <Text style={styles.planPrice}>{product.price || product.title}</Text>
            </View>
            <ActionButton theme={theme} primary title="Choose" onPress={() => void buy(product.productId)} disabled={busy} />
          </View>
        );
      })}
      {loadingPlans && <View style={styles.planLoading}><ActivityIndicator color={theme.accent} /><Text style={styles.secondary}>Loading plans from Google Play…</Text></View>}
      {!!message && <Text style={styles.error}>{message}</Text>}
      {!loadingPlans && !products.length && <ActionButton theme={theme} compact title="Try again" onPress={() => void loadPlans()} disabled={busy} />}
      <Text accessibilityRole="button" style={styles.restoreLink} onPress={() => !busy && void restore()}>{busy ? 'Please wait…' : 'Restore purchases'}</Text>
      <Text style={styles.footnote}>Subscriptions renew automatically until cancelled in Google Play.</Text>
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
      showValues={days === 7}
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
      showValues={days === 7}
      scaledBars
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
  title, summary, detail, values, secondaryValues, labels, theme, showValues = false, scaledBars = false,
}: {
  title: string;
  summary: string;
  detail?: string;
  values: number[];
  secondaryValues?: number[];
  labels?: string[];
  theme: Theme;
  showValues?: boolean;
  scaledBars?: boolean;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const all = [...values, ...(secondaryValues ?? [])];
  const max = Math.max(1, ...all);
  const positiveValues = values.filter(value => value > 0);
  const scaledMin = positiveValues.length ? Math.min(...positiveValues) : 0;
  const scaledMax = positiveValues.length ? Math.max(...positiveValues) : 0;
  const scaledSpan = scaledMax - scaledMin;
  const barHeight = (value: number) => {
    if (value <= 0) return 0;
    if (!scaledBars) return Math.max(4, (value / max) * 100);
    if (scaledSpan === 0) return 70;
    return 28 + ((value - scaledMin) / scaledSpan) * 62;
  };
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
              {showValues && value > 0 && (
                <Text style={styles.barValue}>{format(value)}</Text>
              )}
              <View
                style={[
                  styles.bar,
                  { height: `${barHeight(value)}%` },
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

function dailyWeightAverages(
  values: { time: string; kilograms: number }[],
  unit: 'lb' | 'kg',
) {
  const groups = new Map<string, { total: number; count: number }>();
  for (const item of values) {
    const date = new Date(item.time);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const group = groups.get(key) ?? { total: 0, count: 0 };
    group.total += item.kilograms;
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, group]) => {
    const kilograms = group.total / group.count;
    return { label, value: unit === 'lb' ? kilograms / 0.45359237 : kilograms };
  });
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
  barSlot: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1, position: 'relative', paddingTop: 18 },
  barValue: { position: 'absolute', top: 0, alignSelf: 'center', color: theme.textSecondary, fontSize: 10, textAlign: 'center' },
  bar: { flex: 1, minWidth: 1, borderRadius: 2, backgroundColor: theme.accent },
  secondaryBar: { flex: 1, minWidth: 1, borderRadius: 2, backgroundColor: theme.textSecondary },
  axis: { flexDirection: 'row', minHeight: 18, gap: 2 },
  axisLabel: { flex: 1, color: theme.textSecondary, fontSize: 9, textAlign: 'center' },
  secondary: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
  proHeadline: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginTop: 4 },
  proBenefits: { gap: 8, paddingVertical: 4 },
  proBenefit: { fontSize: 17, lineHeight: 24, color: theme.textPrimary, fontWeight: '600' },
  planCard: { minHeight: 76, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, backgroundColor: theme.inputBackground, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  planCopy: { flex: 1, gap: 3 },
  planTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  planPrice: { fontSize: 15, color: theme.textSecondary },
  planLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  restoreLink: { color: theme.accent, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 10 },
  error: { color: theme.error, fontSize: 15, lineHeight: 21 },
  footnote: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
});
