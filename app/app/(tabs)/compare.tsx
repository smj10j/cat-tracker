import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import type { Cat, Measurement } from '../../lib/api';
import { getPresetLabel, PRESET_TYPES } from '../../lib/measurementPresets';
import { assessHealth, STATUS_COLORS, STATUS_LABEL, STATUS_EMOJI } from '../../lib/healthMetrics';
import type { HealthStatus } from '../../lib/healthMetrics';
import LineChart, { type ChartDataPoint } from '../../components/LineChart';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useThemeColors } from '../../hooks/useThemeColors';

const LINE_COLORS = ['#c084fc', '#4ade80', '#f97316', '#fbbf24', '#fb923c', '#f87171'];

const TYPE_OPTIONS = [
  { value: 'weight', label: 'Weight' },
  { value: 'food', label: 'Food' },
  { value: 'water', label: 'Water' },
  { value: 'litter', label: 'Litter Box' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'activity', label: 'Activity' },
  { value: 'vomiting', label: 'Vomiting' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TableRow {
  date: string;
  rawDate: string;
  values: Record<string, number | null>;
}

function buildTableData(
  cats: Cat[],
  measurementsByCat: Map<string, Measurement[]>,
): TableRow[] {
  const dateMap = new Map<string, TableRow>();
  for (const cat of cats) {
    for (const m of measurementsByCat.get(cat.id) ?? []) {
      const key = m.measured_at.slice(0, 10);
      if (!dateMap.has(key)) {
        dateMap.set(key, { date: formatDate(m.measured_at), rawDate: key, values: {} });
      }
      dateMap.get(key)!.values[cat.id] = m.value;
    }
  }
  return Array.from(dateMap.values()).sort((a, b) => b.rawDate.localeCompare(a.rawDate));
}

export default function CompareScreen() {
  const colors = useThemeColors();
  const [cats, setCats] = useState<Cat[]>([]);
  const [measurementsByCat, setMeasurementsByCat] = useState<Map<string, Measurement[]>>(
    new Map(),
  );
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState('weight');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMeasurements = useCallback(async (allCats: Cat[], type: string) => {
    const entries = await Promise.all(
      allCats.map((cat) =>
        api.getMeasurements(cat.id, type).then((ms) => [cat.id, ms] as const),
      ),
    );
    setMeasurementsByCat(new Map(entries));
  }, []);

  const loadData = useCallback(async () => {
    try {
      const allCats = await api.getCats();
      setCats(allCats);
      setEnabled(new Set(allCats.map((c) => c.id)));
      await fetchMeasurements(allCats, selectedType);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [selectedType, fetchMeasurements]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  async function handleTypeChange(type: string) {
    setSelectedType(type);
    setLoading(true);
    try {
      await fetchMeasurements(cats, type);
    } finally {
      setLoading(false);
    }
  }

  function toggleCat(catId: string) {
    setEnabled((prev) => {
      const n = new Set(prev);
      n.has(catId) ? n.delete(catId) : n.add(catId);
      return n;
    });
  }

  const isWeightType = selectedType === 'weight';
  const isScaleType = PRESET_TYPES.has(selectedType);
  const enabledCats = cats.filter((c) => enabled.has(c.id));
  const tableData = buildTableData(enabledCats, measurementsByCat);

  // Build chart data: one point per date, one series per enabled cat
  const chartData: ChartDataPoint[] = [];
  const chartDateKeys: string[] = []; // parallel array of date strings for emoji mapping
  const dateSet = new Set<string>();
  for (const cat of enabledCats) {
    for (const m of measurementsByCat.get(cat.id) ?? []) {
      const dateKey = m.measured_at.slice(0, 10);
      dateSet.add(dateKey);
    }
  }
  const sortedDates = Array.from(dateSet).sort();
  for (const dateKey of sortedDates) {
    const point: ChartDataPoint = { date: new Date(dateKey + 'T12:00:00').getTime() };
    for (const cat of enabledCats) {
      const ms = measurementsByCat.get(cat.id) ?? [];
      const match = ms.find(m => m.measured_at.startsWith(dateKey));
      if (match) point[cat.id] = match.value;
    }
    // Only include points that have at least one value
    if (enabledCats.some(c => point[c.id] !== undefined)) {
      // Fill missing values with NaN so chart skips them
      for (const cat of enabledCats) {
        if (point[cat.id] === undefined) point[cat.id] = NaN;
      }
      chartData.push(point);
      chartDateKeys.push(dateKey);
    }
  }

  const chartSeriesKeys = enabledCats.map(c => c.id);
  const chartSeriesLabels = Object.fromEntries(enabledCats.map(c => [c.id, c.name]));
  const chartSeriesColors = Object.fromEntries(
    enabledCats.map((c) => [c.id, LINE_COLORS[cats.indexOf(c) % LINE_COLORS.length]!])
  );

  // Build emoji dot map for weight charts: map each chart data point index to a health emoji per cat
  const chartDotEmojis: Record<string, Record<number, string>> | undefined = (() => {
    if (!isWeightType) return undefined;
    const result: Record<string, Record<number, string>> = {};
    for (const cat of enabledCats) {
      const catMeasurements = (measurementsByCat.get(cat.id) ?? [])
        .slice()
        .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
      if (catMeasurements.length < 2) continue;
      const health = assessHealth(catMeasurements);
      // Build date→status map from periods (1:1 with sorted measurements)
      const dateStatusMap = new Map<string, HealthStatus>();
      for (let i = 0; i < catMeasurements.length; i++) {
        const period = health.periods[i];
        const dateKey = catMeasurements[i]!.measured_at.slice(0, 10);
        dateStatusMap.set(dateKey, period?.status ?? 'ok');
      }
      // Map chart data indices to emojis
      const catEmojis: Record<number, string> = {};
      for (let ci = 0; ci < chartDateKeys.length; ci++) {
        const status = dateStatusMap.get(chartDateKeys[ci]!);
        if (status) catEmojis[ci] = STATUS_EMOJI[status];
      }
      result[cat.id] = catEmojis;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  })();

  const healthByCat = isWeightType
    ? new Map(
        cats.map((cat) => [cat.id, assessHealth(measurementsByCat.get(cat.id) ?? [])]),
      )
    : new Map();

  function formatValue(catId: string, val: number | null | undefined): string {
    if (val == null) return '--';
    if (isWeightType) return `${val} lbs`;
    if (isScaleType) return getPresetLabel(selectedType, val);
    return String(val);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lavender} />
        }
      >
        {/* Header */}
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.ink, marginBottom: 20 }}>
          Compare
        </Text>

        {error && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.rose,
            }}
          >
            <Text style={{ color: colors.rose, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Type selector pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {TYPE_OPTIONS.map(({ value, label }) => {
            const active = selectedType === value;
            return (
              <Pressable
                key={value}
                onPress={() => handleTypeChange(value)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  marginRight: 8,
                  backgroundColor: active ? colors.lavender : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.lavender : colors.rim,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: active ? colors.night : colors.inkMid,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.lavender} />
          </View>
        ) : (
          <>
            {/* Cat toggle pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {cats.map((cat, i) => {
                const lineColor = LINE_COLORS[i % LINE_COLORS.length]!;
                const on = enabled.has(cat.id);
                const catHealth = healthByCat.get(cat.id);
                const healthStatus = (catHealth?.overallStatus ?? 'ok') as HealthStatus;
                const showBadge =
                  isWeightType &&
                  catHealth &&
                  healthStatus !== 'ok' &&
                  catHealth.periods.filter(Boolean).length > 0;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => toggleCat(cat.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 20,
                      marginRight: 8,
                      borderWidth: 1.5,
                      borderColor: lineColor,
                      backgroundColor: on ? `${lineColor}22` : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: on ? lineColor : colors.inkDim,
                      }}
                    >
                      {cat.name}
                    </Text>
                    {showBadge && (
                      <View
                        style={{
                          marginLeft: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 10,
                          backgroundColor: `${STATUS_COLORS[healthStatus]}25`,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: STATUS_COLORS[healthStatus],
                          }}
                        >
                          {STATUS_EMOJI[healthStatus]} {STATUS_LABEL[healthStatus]}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Chart */}
            {enabledCats.length > 0 && chartData.length > 1 && (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.rim,
                padding: 12,
                marginBottom: 16,
              }}>
                <ErrorBoundary>
                <LineChart
                  data={chartData}
                  seriesKeys={chartSeriesKeys}
                  seriesLabels={chartSeriesLabels}
                  seriesColors={chartSeriesColors}
                  dotEmojis={chartDotEmojis}
                  height={240}
                  yLabel={isWeightType ? 'lbs' : undefined}
                  formatY={isScaleType
                    ? (v) => getPresetLabel(selectedType, Math.round(v))
                    : (v) => String(Math.round(v * 10) / 10)
                  }
                />
              </ErrorBoundary>
              </View>
            )}

            {/* Data table */}
            {enabledCats.length === 0 ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🐱</Text>
                <Text style={{ color: colors.inkDim, fontSize: 14 }}>
                  Select cats above to compare
                </Text>
              </View>
            ) : tableData.length === 0 ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
                <Text style={{ color: colors.inkDim, fontSize: 14 }}>
                  No {selectedType} measurements yet
                </Text>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.rim,
                  overflow: 'hidden',
                }}
              >
                {/* Table header */}
                <View
                  style={{
                    flexDirection: 'row',
                    borderBottomWidth: 1,
                    borderBottomColor: colors.rim,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: colors.surfaceHi,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontWeight: '700',
                      color: colors.inkDim,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Date
                  </Text>
                  {enabledCats.map((cat, i) => (
                    <Text
                      key={cat.id}
                      style={{
                        flex: 1,
                        fontSize: 11,
                        fontWeight: '700',
                        color: LINE_COLORS[cats.indexOf(cat) % LINE_COLORS.length],
                        textAlign: 'right',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {cat.name}
                    </Text>
                  ))}
                </View>

                {/* Table rows */}
                {tableData.map((row, rowIdx) => (
                  <View
                    key={row.rawDate}
                    style={{
                      flexDirection: 'row',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderBottomWidth: rowIdx < tableData.length - 1 ? 1 : 0,
                      borderBottomColor: colors.rim,
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: 13, color: colors.inkMid }}>
                      {row.date}
                    </Text>
                    {enabledCats.map((cat) => (
                      <Text
                        key={cat.id}
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: '600',
                          color:
                            row.values[cat.id] != null
                              ? colors.ink
                              : colors.inkDim,
                          textAlign: 'right',
                        }}
                      >
                        {formatValue(cat.id, row.values[cat.id])}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {/* Weight legend */}
            {isWeightType && tableData.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.rim,
                }}
              >
                <Text style={{ color: colors.inkDim, fontSize: 11, fontWeight: '500' }}>
                  Status:
                </Text>
                {(['ok', 'watch', 'concerning', 'urgent'] as const).map((s) => (
                  <Text key={s} style={{ color: colors.inkDim, fontSize: 11 }}>
                    {STATUS_EMOJI[s]} {s}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
