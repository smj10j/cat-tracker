import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { api, CARE_TYPE_ICONS } from '../../../lib/api';
import type { Cat, Measurement, Medication } from '../../../lib/api';
import CatAvatar from '../../../components/CatAvatar';
import InsightsPanel from '../../../components/InsightsPanel';
import MeasurementForm from '../../../components/MeasurementForm';
import { assessHealth, STATUS_COLORS, STATUS_LABEL, STATUS_EMOJI } from '@shared/lib/healthMetrics';
import type { HealthStatus } from '@shared/lib/healthMetrics';
import { getPresetLabel } from '@shared/lib/measurementPresets';
import { catAge, formatLocalDate } from '@shared/lib/dates';
import LineChart from '../../../components/LineChart';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { ChartExpandButton } from '../../../components/ChartExpandButton';
import { FullScreenChartModal } from '../../../components/FullScreenChartModal';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { ResponsiveContainer } from '../../../components/ResponsiveContainer';
import { useAutoLandscape } from '../../../hooks/useAutoLandscape';
import { usePreferences } from '../../../contexts/PreferencesContext';
import {
  formatTime as formatTimePref,
  formatDateShort,
} from '@shared/lib/preferences';
import { groupByDay, formatFreqShort, formatNextDue, formatSexNeuter } from '@shared/lib/formatting';
import { MEASUREMENT_TYPE_LABELS as MEAS_TYPE_LABELS, BEHAVIOR_CHART_TYPES as BEHAVIORAL_TYPES } from '@shared/lib/constants';

type ProfileTab = 'health' | 'care' | 'about';

export default function CatProfileScreen() {
  const colors = useThemeColors();
  const { rv } = useResponsiveLayout();
  const { prefs } = usePreferences();
  const insets = useSafeAreaInsets();

  const formatChartDate = useCallback((ts: number) => {
    const iso = new Date(ts).toISOString().slice(0, 10);
    return formatDateShort(iso, prefs);
  }, [prefs]);

  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const [cat, setCat] = useState<Cat | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [profileTab, setProfileTab] = useState<ProfileTab>(
    initialTab === 'care' || initialTab === 'about' ? initialTab : 'health'
  );
  const [chartTab, setChartTab] = useState<string>('weight');
  const [showOlderHistory, setShowOlderHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [measurementFormOpen, setMeasurementFormOpen] = useState(false);

  // Auto-expand chart when device rotates to landscape (Phase B)
  useAutoLandscape({
    isExpanded: expandedChart !== null,
    onExpand: () => setExpandedChart(chartTab === 'weight' ? 'weight' : chartTab),
    onCollapse: () => setExpandedChart(null),
    enabled: !measurementFormOpen,
  });

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getCat(id), api.getMeasurements(id), api.getMedications(id)])
      .then(([c, m, mds]) => { setCat(c); setMeasurements(m); setMeds(mds); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Re-fetch cat data when screen regains focus (e.g. returning from edit with new photo).
  // Failures surface as a stale-data banner instead of silently showing old data.
  useFocusEffect(
    useCallback(() => {
      if (!id || loading) return;
      Promise.allSettled([
        api.getCat(id).then(setCat),
        api.getMeasurements(id).then(setMeasurements),
        api.getMedications(id).then(setMeds),
      ]).then((results) => {
        setRefreshFailed(results.some((r) => r.status === 'rejected'));
      });
    }, [id, loading]),
  );

  // All hooks must be called before any early returns (Rules of Hooks).
  const availableChartTypes = useMemo(() => {
    const types = new Set(measurements.map(m => m.type));
    const result: { key: string; label: string }[] = [];
    if (types.has('weight')) result.push({ key: 'weight', label: 'Weight' });
    if (types.has('food')) result.push({ key: 'food', label: 'Food' });
    if (types.has('water')) result.push({ key: 'water', label: 'Water' });
    if (types.has('grooming') || types.has('activity') || types.has('litter') || types.has('vomiting'))
      result.push({ key: 'behavior', label: 'Behavior' });
    return result;
  }, [measurements]);

  async function executeDeleteMeasurement(measId: string) {
    try {
      await api.deleteMeasurement(measId);
      setMeasurements((prev) => prev.filter((x) => x.id !== measId));
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    setPendingDeleteId(null);
  }

  function handleMeasurementAdded(m: Measurement) {
    setMeasurements((prev) => [...prev, m].sort((a, b) => a.measured_at.localeCompare(b.measured_at)));
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <Text style={{ color: colors.inkMid }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night, padding: 16 }} edges={['top']}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}>
          <Text style={{ color: colors.rose, fontSize: 14 }}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!cat) return null;

  const isDeceased = !!cat.deceased_at;
  const weightMeasurements = measurements.filter((m) => m.type === 'weight');
  const latestWeight = [...weightMeasurements].sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0];
  const health = assessHealth(weightMeasurements);
  const status = health.overallStatus;
  const statusColor = STATUS_COLORS[status];

  const measurementsByType: Record<string, Measurement[]> = {};
  for (const m of measurements) {
    if (!measurementsByType[m.type]) measurementsByType[m.type] = [];
    measurementsByType[m.type]!.push(m);
  }
  const availableTypes = Object.keys(measurementsByType);

  const allDayGroups = groupByDay(measurements, prefs);
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
  const recentGroups = allDayGroups.filter((g) => g.dateStr >= cutoff);
  const olderGroups = allDayGroups.filter((g) => g.dateStr < cutoff);
  const defaultGroups = recentGroups.length > 0 ? recentGroups : allDayGroups.slice(0, 3);
  const visibleGroups = showOlderHistory ? allDayGroups : defaultGroups;
  const olderCount = olderGroups.reduce((sum, g) => sum + g.items.length, 0);

  const isUrgent = status === 'urgent';
  const hasRealMicrochip = cat.microchip_id && !cat.microchip_id.startsWith('temp-microchip-id-');

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      {refreshFailed && (
        <View
          accessibilityRole="alert"
          style={{
            position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 50,
            padding: 10, borderRadius: 12,
            backgroundColor: 'rgba(30,20,40,0.95)',
            borderWidth: 1, borderColor: 'rgba(244,200,73,0.35)',
          }}
        >
          <Text style={{ color: colors.honey, fontSize: 12, textAlign: 'center' }}>
            Couldn't refresh — showing saved data
          </Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }}>
        {/* Hero — extends behind status bar for edge-to-edge image */}
        <View
          style={{
            height: rv(280, 360) + insets.top,
            backgroundColor: isUrgent
              ? 'rgba(248,113,113,0.15)'
              : 'rgba(192,132,252,0.1)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {cat.photo_url ? (
            <Image
              source={{ uri: cat.photo_url }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              paddingTop: insets.top,
            }}>
              <CatAvatar photoUrl={null} name={cat.name} size={120} />
            </View>
          )}

          {/* Top gradient — fades from dark to transparent for status bar legibility */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 + insets.top }}
          />
          {/* Bottom gradient — fades from transparent to dark for text legibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 }}
          />

          {/* Top nav — positioned below the status bar */}
          <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: 'rgba(0,0,0,0.4)',
                alignItems: 'center', justifyContent: 'center',
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 20 }}>{'\u2190'}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => router.push(`/cats/${cat.id}/edit` as never)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.45)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.3)',
                minHeight: 36,
                justifyContent: 'center',
              }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>Edit</Text>
            </Pressable>
          </View>

          {/* Bottom info */}
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontWeight: '700', fontSize: rv(28, 34), color: '#fff', lineHeight: rv(34, 40) }} numberOfLines={1}>
                {cat.name}
              </Text>
              {isDeceased ? (
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 2 }}>
                  {'\uD83D\uDD4A\uFE0F'} {cat.deceased_at ? formatLocalDate(cat.deceased_at) : ''}
                </Text>
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 2 }}>
                  {catAge(cat.birthdate)}
                </Text>
              )}
            </View>
            {latestWeight && !isDeceased && (
              <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                <Text style={{ fontWeight: '700', fontSize: 24, color: status !== 'ok' ? statusColor : colors.amber }}>
                  {latestWeight.value}{' '}
                  <Text style={{ fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.4)' }}>{latestWeight.unit}</Text>
                </Text>
                {weightMeasurements.length >= 2 && (
                  <View style={{
                    marginTop: 4,
                    paddingHorizontal: 8, paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: `${statusColor}25`,
                    borderWidth: 1,
                    borderColor: `${statusColor}50`,
                  }}>
                    <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700' }}>
                      {STATUS_LABEL[status]}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <ResponsiveContainer>
        {/* In Memoriam banner */}
        {isDeceased && cat.memorial_note && (
          <View style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 16,
            backgroundColor: 'rgba(192,132,252,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(192,132,252,0.15)',
          }}>
            <Text style={{ color: colors.inkMid, fontSize: 14, fontStyle: 'italic', lineHeight: 20 }}>
              {cat.memorial_note}
            </Text>
          </View>
        )}

        {/* Profile tabs */}
        <View style={{
          flexDirection: 'row',
          gap: 4,
          marginTop: 16,
          padding: 4,
          borderRadius: 12,
          backgroundColor: colors.card,
        }}>
          {(['health', 'care', 'about'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => { setProfileTab(key); setPendingDeleteId(null); }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: profileTab === key ? 'rgba(192,132,252,0.15)' : 'transparent',
                borderWidth: profileTab === key ? 1 : 0,
                borderColor: 'rgba(192,132,252,0.25)',
              }}
            >
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: profileTab === key ? colors.lavender : colors.inkDim,
                textTransform: 'capitalize',
              }}>
                {key === 'health' ? 'Health' : key === 'care' ? 'Care' : 'About'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Health tab */}
        {profileTab === 'health' && (
          <View style={{ gap: 16, marginTop: 16, paddingBottom: 32 }}>
            {!isDeceased && (
              <InsightsPanel
                cat={cat}
                status={status}
                health={health}
                measurementsByType={measurementsByType}
                availableTypes={availableTypes}
                hasWeightData={weightMeasurements.length >= 2}
              />
            )}

            {/* Chart type selector */}
            {availableChartTypes.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
              >
                {availableChartTypes.map(t => (
                  <Pressable
                    key={t.key}
                    onPress={() => setChartTab(t.key)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: chartTab === t.key ? 'rgba(192,132,252,0.2)' : colors.card,
                      borderWidth: 1,
                      borderColor: chartTab === t.key ? 'rgba(192,132,252,0.4)' : colors.rim,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      color: chartTab === t.key ? colors.lavender : colors.inkDim,
                      fontSize: 13,
                      fontWeight: chartTab === t.key ? '600' : '400',
                    }}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Weight chart */}
            {chartTab === 'weight' && weightMeasurements.length >= 2 && (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.rim,
              }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: colors.inkMid, marginBottom: 4 }}>
                  Weight Trend
                </Text>
                {health && (
                  <Text style={{ color: statusColor, fontSize: 13, marginBottom: 8 }}>
                    {STATUS_EMOJI[status]} {health.summary || 'Stable'}
                  </Text>
                )}
                <View style={{ position: 'relative' }}>
                  <ChartExpandButton onPress={() => setExpandedChart('weight')} visible={weightMeasurements.length > 0} />
                  <ErrorBoundary>
                    <LineChart
                      data={weightMeasurements
                        .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                        .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                      seriesKeys={['value']}
                      seriesLabels={{ value: cat.name }}
                      seriesColors={{ value: statusColor }}
                      height={rv(180, 260)}
                      yLabel={prefs.weightUnit}
                      formatX={formatChartDate}
                    />
                  </ErrorBoundary>
                </View>
                <FullScreenChartModal
                  visible={expandedChart === 'weight'}
                  title={cat.name}
                  subtitle={prefs.weightUnit}
                  onClose={() => setExpandedChart(null)}
                >
                  {({ height }) => (
                    <ErrorBoundary>
                      <LineChart
                        data={weightMeasurements
                          .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                          .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                        seriesKeys={['value']}
                        seriesLabels={{ value: cat.name }}
                        seriesColors={{ value: statusColor }}
                        height={height - 16}
                        yLabel={prefs.weightUnit}
                        formatX={formatChartDate}
                      />
                    </ErrorBoundary>
                  )}
                </FullScreenChartModal>
              </View>
            )}

            {/* Food chart */}
            {chartTab === 'food' && (() => {
              const foodMeasurements = measurements.filter(m => m.type === 'food');
              if (foodMeasurements.length < 2) return (
                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim, alignItems: 'center' }}>
                  <Text style={{ color: colors.inkDim, fontSize: 14 }}>Not enough food data to chart</Text>
                </View>
              );
              return (
                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}>
                  <Text style={{ fontWeight: '600', fontSize: 14, color: colors.inkMid, marginBottom: 12 }}>Food Intake</Text>
                  <ErrorBoundary>
                    <LineChart
                      data={foodMeasurements
                        .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                        .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                      seriesKeys={['value']}
                      seriesLabels={{ value: 'Food' }}
                      seriesColors={{ value: colors.jade }}
                      height={rv(180, 260)}
                      yLabel="scale"
                      formatY={(v) => getPresetLabel('food', Math.round(v))}
                      formatX={formatChartDate}
                    />
                  </ErrorBoundary>
                </View>
              );
            })()}

            {/* Water chart */}
            {chartTab === 'water' && (() => {
              const waterMeasurements = measurements.filter(m => m.type === 'water');
              if (waterMeasurements.length < 2) return (
                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim, alignItems: 'center' }}>
                  <Text style={{ color: colors.inkDim, fontSize: 14 }}>Not enough water data to chart</Text>
                </View>
              );
              return (
                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}>
                  <Text style={{ fontWeight: '600', fontSize: 14, color: colors.inkMid, marginBottom: 12 }}>Water Intake</Text>
                  <ErrorBoundary>
                    <LineChart
                      data={waterMeasurements
                        .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                        .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                      seriesKeys={['value']}
                      seriesLabels={{ value: 'Water' }}
                      seriesColors={{ value: '#38bdf8' }}
                      height={rv(180, 260)}
                      yLabel="scale"
                      formatY={(v) => getPresetLabel('water', Math.round(v))}
                      formatX={formatChartDate}
                    />
                  </ErrorBoundary>
                </View>
              );
            })()}

            {/* Behavior charts */}
            {chartTab === 'behavior' && (() => {
              const behaviorTypes = ['grooming', 'activity', 'litter', 'vomiting'].filter(t => measurementsByType[t]?.length);
              const typeColors: Record<string, string> = { grooming: colors.lavender, activity: colors.jade, litter: colors.honey, vomiting: colors.rose };
              if (behaviorTypes.length === 0) return (
                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim, alignItems: 'center' }}>
                  <Text style={{ color: colors.inkDim, fontSize: 14 }}>No behavioral data to chart</Text>
                </View>
              );
              return (
                <View style={{ gap: 12 }}>
                  {behaviorTypes.map(type => {
                    const typeMeasurements = measurementsByType[type] ?? [];
                    if (typeMeasurements.length < 2) return null;
                    return (
                      <View key={type} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}>
                        <Text style={{ fontWeight: '600', fontSize: 14, color: colors.inkMid, marginBottom: 12 }}>
                          {MEAS_TYPE_LABELS[type] ?? type}
                        </Text>
                        <ErrorBoundary>
                          <LineChart
                            data={typeMeasurements
                              .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                              .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                            seriesKeys={['value']}
                            seriesLabels={{ value: MEAS_TYPE_LABELS[type] ?? type }}
                            seriesColors={{ value: typeColors[type] ?? colors.lavender }}
                            height={rv(150, 220)}
                            yLabel="scale"
                            formatY={(v) => getPresetLabel(type, Math.round(v))}
                            formatX={formatChartDate}
                          />
                        </ErrorBoundary>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Measurement form */}
            {id && !isDeceased && <MeasurementForm catId={id} onAdded={handleMeasurementAdded} />}

            {/* History */}
            {(() => {
              const behaviorTypeSet = new Set(['grooming', 'activity', 'litter', 'vomiting']);
              const filteredMeasurements = chartTab === 'behavior'
                ? measurements.filter(m => behaviorTypeSet.has(m.type))
                : measurements.filter(m => m.type === chartTab);
              const filteredDayGroups = groupByDay(filteredMeasurements, prefs);
              const filteredRecentGroups = filteredDayGroups.filter(g => g.dateStr >= cutoff);
              const filteredOlderGroups = filteredDayGroups.filter(g => g.dateStr < cutoff);
              const filteredDefaultGroups = filteredRecentGroups.length > 0 ? filteredRecentGroups : filteredDayGroups.slice(0, 3);
              const filteredVisibleGroups = showOlderHistory ? filteredDayGroups : filteredDefaultGroups;
              const filteredOlderCount = filteredOlderGroups.reduce((sum, g) => sum + g.items.length, 0);
              return filteredMeasurements.length > 0 && (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.rim,
              }}>
                <Text style={{ fontWeight: '600', fontSize: 16, color: colors.ink, marginBottom: 16 }}>
                  History
                </Text>

                {filteredVisibleGroups.map((group) => (
                  <View key={group.dateStr} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkDim }}>{group.label}</Text>
                      <Text style={{ fontSize: 12, color: 'rgba(107,95,133,0.6)' }}>
                        {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.rim }} />
                    </View>

                    {group.items.map((m, idx) => (
                      <View
                        key={m.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 10,
                          borderBottomWidth: idx < group.items.length - 1 ? 1 : 0,
                          borderBottomColor: colors.card,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <Text style={{ color: colors.inkDim, fontSize: 12, width: 64, flexShrink: 0 }}>
                            {formatTimePref(m.measured_at, prefs)}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                            <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>
                              {m.unit === 'scale' ? getPresetLabel(m.type, m.value) : `${m.value} ${m.unit}`}
                            </Text>
                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.surface }}>
                              <Text style={{ fontSize: 11, color: colors.inkDim }}>
                                {MEAS_TYPE_LABELS[m.type] ?? m.type}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {!isDeceased && (
                          pendingDeleteId === m.id ? (
                            <View style={{ flexDirection: 'row', gap: 4, marginLeft: 12 }}>
                              <Pressable
                                onPress={() => setPendingDeleteId(null)}
                                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.surface }}
                              >
                                <Text style={{ color: colors.inkDim, fontSize: 12 }}>Cancel</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => executeDeleteMeasurement(m.id)}
                                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.1)' }}
                              >
                                <Text style={{ color: colors.rose, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => setPendingDeleteId(m.id)}
                              style={{ marginLeft: 12 }}
                            >
                              <Text style={{ color: 'rgba(248,113,113,0.6)', fontSize: 12 }}>Delete</Text>
                            </Pressable>
                          )
                        )}
                      </View>
                    ))}
                  </View>
                ))}

                {!showOlderHistory && filteredOlderGroups.length > 0 && (
                  <Pressable
                    onPress={() => setShowOlderHistory(true)}
                    style={{
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.rim,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkDim }}>
                      View {filteredOlderCount} older {filteredOlderCount === 1 ? 'entry' : 'entries'}
                    </Text>
                  </Pressable>
                )}
              </View>
              );
            })()}
          </View>
        )}

        {/* Care tab */}
        {profileTab === 'care' && (
          <View style={{ gap: 16, marginTop: 16, paddingBottom: 32 }}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.rim,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontWeight: '600', fontSize: 16, color: colors.ink }}>Care Schedule</Text>
                  {meds.reduce((sum, m) => sum + (m.overdue_count ?? 0), 0) > 0 && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(248,113,113,0.15)' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.rose }}>
                        {meds.reduce((sum, m) => sum + (m.overdue_count ?? 0), 0)} overdue
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {meds.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.inkDim, paddingVertical: 4 }}>No care items tracked yet.</Text>
              ) : (
                <View style={{ gap: 4 }}>
                  {meds.map((med) => (
                    <Pressable
                      key={med.id}
                      onPress={() => router.push(`/cats/${cat.id}/care-item?medId=${med.id}` as never)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
                    >
                      <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                        {CARE_TYPE_ICONS[med.type] ?? '\uD83D\uDCC5'}
                      </Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }} numberOfLines={1}>
                            {med.name}
                          </Text>
                          {(med.overdue_count ?? 0) > 0 && (
                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(248,113,113,0.15)' }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.rose }}>overdue</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>
                          {formatFreqShort(med.frequency, med.frequency_days)} {'\u00B7'} {formatNextDue(med.next_due_at, prefs)}
                        </Text>
                      </View>
                      <Text style={{ color: colors.inkDim, fontSize: 14 }}>{'\u203A'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Add care item button */}
              {!isDeceased && (
                <Pressable
                  onPress={() => router.push(`/cats/${cat.id}/care-item` as never)}
                  style={{
                    marginTop: 12,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: 'rgba(192,132,252,0.3)',
                    backgroundColor: 'rgba(192,132,252,0.04)',
                  }}
                >
                  <Text style={{ color: colors.lavender, fontSize: 14, fontWeight: '600' }}>
                    + Add Care Item
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Reminders link */}
            <Pressable
              onPress={() => router.push('/notifications' as never)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.rim,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Reminders & Notifications</Text>
                <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>View upcoming doses and overdue items</Text>
              </View>
              <Text style={{ color: colors.inkDim, fontSize: 18 }}>{'\u203A'}</Text>
            </Pressable>

            {/* Sitter view link */}
            <Pressable
              onPress={() => router.push(`/cats/${cat.id}/sitter` as never)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.rim,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{'\uD83D\uDC3E'} Sitter view</Text>
                <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>Send a shareable PDF summary to your cat sitter</Text>
              </View>
              <Text style={{ color: colors.inkDim, fontSize: 18 }}>{'\u203A'}</Text>
            </Pressable>
          </View>
        )}

        {/* About tab */}
        {profileTab === 'about' && (
          <View style={{ gap: 16, marginTop: 16, paddingBottom: 32 }}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.rim,
            }}>
              {/* Breed */}
              <DetailRow icon={'\uD83D\uDC3E'} label="Breed" value={cat.breed ?? '\u2014'} />
              {/* Sex */}
              <DetailRow
                icon={cat.sex === 'Female' ? '\u2640' : cat.sex === 'Male' ? '\u2642' : '\u26A5'}
                label="Sex"
                value={formatSexNeuter(cat.sex, cat.is_neutered)}
              />
              {/* Coloring */}
              {cat.coloring && (
                <DetailRow icon={'\uD83C\uDFA8'} label="Coloring" value={cat.coloring} />
              )}
              {/* Age */}
              <DetailRow icon={'\uD83C\uDF82'} label="Age" value={catAge(cat.birthdate)} />
              {/* Latest weight */}
              {latestWeight && (
                <DetailRow
                  icon={'\u2696\uFE0F'}
                  label="Weight"
                  value={`${latestWeight.value} ${latestWeight.unit}`}
                  valueColor={status !== 'ok' ? statusColor : colors.amber}
                  statusBadge={weightMeasurements.length >= 2 ? STATUS_LABEL[status] : undefined}
                  statusColor={statusColor}
                />
              )}
              {/* Microchip */}
              {hasRealMicrochip && (
                <DetailRow icon="#" label="Microchip" value={cat.microchip_id!.replace(/(.{3})/g, '$1 ').trim()} isLast />
              )}
            </View>

            {cat.notes && (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderWidth: 1,
                borderColor: colors.rim,
              }}>
                <Text style={{ color: colors.inkMid, fontSize: 14, fontStyle: 'italic' }}>{cat.notes}</Text>
              </View>
            )}

            <Pressable
              onPress={() => router.push(`/cats/${cat.id}/edit` as never)}
              style={{
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(192,132,252,0.25)',
                backgroundColor: 'rgba(192,132,252,0.06)',
              }}
            >
              <Text style={{ color: colors.lavender, fontSize: 14, fontWeight: '600' }}>Edit profile</Text>
            </Pressable>
          </View>
        )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon, label, value, valueColor, statusBadge, statusColor, isLast,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  statusBadge?: string;
  statusColor?: string;
  isLast?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: colors.rim,
    }}>
      <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{icon}</Text>
      <Text style={{ fontSize: 12, color: colors.inkDim, width: 80, flexShrink: 0 }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 14, color: valueColor ?? colors.ink, fontWeight: valueColor ? '600' : '400' }}>
          {value}
        </Text>
        {statusBadge && statusColor && (
          <View style={{
            paddingHorizontal: 6, paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: `${statusColor}20`,
            borderWidth: 1,
            borderColor: `${statusColor}40`,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>
              {statusBadge}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
