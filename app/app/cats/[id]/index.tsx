import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { api, CARE_TYPE_ICONS } from '../../../lib/api';
import type { Cat, Measurement, Medication } from '../../../lib/api';
import CatAvatar from '../../../components/CatAvatar';
import InsightsPanel from '../../../components/InsightsPanel';
import MeasurementForm from '../../../components/MeasurementForm';
import { assessHealth, STATUS_COLORS, STATUS_LABEL, STATUS_EMOJI } from '../../../lib/healthMetrics';
import type { HealthStatus } from '../../../lib/healthMetrics';
import { getPresetLabel } from '../../../lib/measurementPresets';
import { catAge, formatLocalDate } from '../../../lib/dates';
import LineChart from '../../../components/LineChart';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDayLabel(dateStr: string): string {
  const today = new Date().toLocaleDateString('en-CA');
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface DayGroup {
  dateStr: string;
  label: string;
  items: Measurement[];
}

function groupByDay(measurements: Measurement[]): DayGroup[] {
  const map = new Map<string, Measurement[]>();
  for (const m of measurements) {
    const dateStr = new Date(m.measured_at).toLocaleDateString('en-CA');
    const bucket = map.get(dateStr) ?? [];
    bucket.push(m);
    map.set(dateStr, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, items]) => ({
      dateStr,
      label: formatDayLabel(dateStr),
      items: items.sort((a, b) => b.measured_at.localeCompare(a.measured_at)),
    }));
}

const BEHAVIORAL_TYPES = new Set(['grooming', 'play', 'activity', 'vomiting', 'litter']);

const MEAS_TYPE_LABELS: Record<string, string> = {
  weight: 'Weight', food: 'Food', water: 'Water',
  grooming: 'Grooming', play: 'Play', activity: 'Activity',
  vomiting: 'Vomiting', litter: 'Litter Box',
};

type ProfileTab = 'health' | 'care' | 'about';

const FREQ_SHORT: Record<string, string> = {
  daily: 'daily', twice_daily: 'twice daily', weekly: 'weekly',
  monthly: 'monthly', custom: 'every N days',
};

function formatNextDue(nextDueAt: string | null | undefined): string {
  if (!nextDueAt) return 'No upcoming dose';
  const [datePart, timePart] = nextDueAt.split(' ');
  if (!datePart) return 'Upcoming';
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [h, m] = (timePart ?? '09:00').split(':');
  const hour = parseInt(h ?? '9', 10);
  const minute = m ?? '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const timeStr = `${hour % 12 || 12}:${minute} ${ampm}`;
  if (datePart === today) return `Today at ${timeStr}`;
  if (datePart === tomorrow) return `Tomorrow at ${timeStr}`;
  const d = new Date(datePart + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

function formatSexNeuter(sex: string | null, isNeutered: number | null): string {
  if (!sex && isNeutered === null) return 'Unknown';
  const sexStr = sex ?? 'Unknown sex';
  if (isNeutered === 1) {
    const neuterStr = sex === 'Female' ? 'Spayed' : 'Neutered';
    return `${sexStr} \u00B7 ${neuterStr}`;
  }
  if (isNeutered === 0) return `${sexStr} \u00B7 Intact`;
  return sexStr;
}

export default function CatProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cat, setCat] = useState<Cat | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [profileTab, setProfileTab] = useState<ProfileTab>('health');
  const [chartTab, setChartTab] = useState<string>('weight');
  const [showOlderHistory, setShowOlderHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [transitionDone, setTransitionDone] = useState(false);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setTransitionDone(true);
    });
    return () => handle.cancel();
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getCat(id), api.getMeasurements(id), api.getMedications(id)])
      .then(([c, m, mds]) => { setCat(c); setMeasurements(m); setMeds(mds); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Re-fetch medications when returning from care-item form
  useFocusEffect(
    useCallback(() => {
      if (!id || loading) return;
      api.getMedications(id).then(setMeds).catch(() => {});
    }, [id, loading]),
  );

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#16111f', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#a899c0' }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#16111f', padding: 16 }}>
        <View style={{ backgroundColor: '#1f1830', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
          <Text style={{ color: '#f87171', fontSize: 14 }}>{error}</Text>
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

  const allDayGroups = groupByDay(measurements);
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
  const recentGroups = allDayGroups.filter((g) => g.dateStr >= cutoff);
  const olderGroups = allDayGroups.filter((g) => g.dateStr < cutoff);
  const defaultGroups = recentGroups.length > 0 ? recentGroups : allDayGroups.slice(0, 3);
  const visibleGroups = showOlderHistory ? allDayGroups : defaultGroups;
  const olderCount = olderGroups.reduce((sum, g) => sum + g.items.length, 0);

  const isUrgent = status === 'urgent';
  const hasRealMicrochip = cat.microchip_id && !cat.microchip_id.startsWith('temp-microchip-id-');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#16111f' }} edges={['top']}>
      <ScrollView style={{ flex: 1 }}>
        {/* Hero */}
        <View
          style={{
            height: 280,
            backgroundColor: '#1f1830',
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
              backgroundColor: isUrgent
                ? 'rgba(248,113,113,0.15)'
                : 'rgba(192,132,252,0.1)',
            }}>
              <CatAvatar photoUrl={null} name={cat.name} size={120} />
            </View>
          )}

          {/* Top gradient */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 80,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }} />
          {/* Bottom gradient */}
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
            backgroundColor: 'rgba(0,0,0,0.65)',
          }} />

          {/* Top nav */}
          <View style={{ position: 'absolute', top: 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 22 }}>{'\u2190'}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => router.push(`/cats/${cat.id}/edit` as never)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.45)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>Edit</Text>
            </Pressable>
          </View>

          {/* Bottom info */}
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontWeight: '700', fontSize: 28, color: '#fff', lineHeight: 34 }} numberOfLines={1}>
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
                <Text style={{ fontWeight: '700', fontSize: 24, color: status !== 'ok' ? statusColor : '#fb923c' }}>
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

        {/* In Memoriam banner */}
        {isDeceased && cat.memorial_note && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 16,
            padding: 16,
            borderRadius: 16,
            backgroundColor: 'rgba(192,132,252,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(192,132,252,0.15)',
          }}>
            <Text style={{ color: '#a899c0', fontSize: 14, fontStyle: 'italic', lineHeight: 20 }}>
              {cat.memorial_note}
            </Text>
          </View>
        )}

        {/* Profile tabs */}
        <View style={{
          flexDirection: 'row',
          gap: 4,
          marginHorizontal: 16,
          marginTop: 16,
          padding: 4,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.05)',
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
                color: profileTab === key ? '#c084fc' : '#6b5f85',
                textTransform: 'capitalize',
              }}>
                {key === 'health' ? 'Health' : key === 'care' ? 'Care' : 'About'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Health tab */}
        {profileTab === 'health' && (
          <View style={{ paddingHorizontal: 16, gap: 16, marginTop: 16, paddingBottom: 32 }}>
            {!isDeceased && transitionDone && (
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
                      backgroundColor: chartTab === t.key ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: chartTab === t.key ? 'rgba(192,132,252,0.4)' : 'rgba(255,255,255,0.07)',
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      color: chartTab === t.key ? '#c084fc' : '#6b5f85',
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
            {transitionDone && chartTab === 'weight' && weightMeasurements.length >= 2 && (
              <View style={{
                backgroundColor: '#1f1830',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
              }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: '#a899c0', marginBottom: 4 }}>
                  Weight Trend
                </Text>
                {health && (
                  <Text style={{ color: statusColor, fontSize: 13, marginBottom: 8 }}>
                    {STATUS_EMOJI[status]} {health.summary || 'Stable'}
                  </Text>
                )}
                <ErrorBoundary>
                  <LineChart
                    data={weightMeasurements
                      .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                      .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                    seriesKeys={['value']}
                    seriesLabels={{ value: cat.name }}
                    seriesColors={{ value: statusColor }}
                    height={180}
                    yLabel="lbs"
                  />
                </ErrorBoundary>
              </View>
            )}

            {/* Food chart */}
            {transitionDone && chartTab === 'food' && (() => {
              const foodMeasurements = measurements.filter(m => m.type === 'food');
              if (foodMeasurements.length < 2) return (
                <View style={{ backgroundColor: '#1f1830', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center' }}>
                  <Text style={{ color: '#6b5f85', fontSize: 14 }}>Not enough food data to chart</Text>
                </View>
              );
              return (
                <View style={{ backgroundColor: '#1f1830', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                  <Text style={{ fontWeight: '600', fontSize: 14, color: '#a899c0', marginBottom: 12 }}>Food Intake</Text>
                  <ErrorBoundary>
                    <LineChart
                      data={foodMeasurements
                        .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                        .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                      seriesKeys={['value']}
                      seriesLabels={{ value: 'Food' }}
                      seriesColors={{ value: '#4ade80' }}
                      height={180}
                      yLabel="scale"
                      formatY={(v) => getPresetLabel('food', Math.round(v))}
                    />
                  </ErrorBoundary>
                </View>
              );
            })()}

            {/* Water chart */}
            {transitionDone && chartTab === 'water' && (() => {
              const waterMeasurements = measurements.filter(m => m.type === 'water');
              if (waterMeasurements.length < 2) return (
                <View style={{ backgroundColor: '#1f1830', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center' }}>
                  <Text style={{ color: '#6b5f85', fontSize: 14 }}>Not enough water data to chart</Text>
                </View>
              );
              return (
                <View style={{ backgroundColor: '#1f1830', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                  <Text style={{ fontWeight: '600', fontSize: 14, color: '#a899c0', marginBottom: 12 }}>Water Intake</Text>
                  <ErrorBoundary>
                    <LineChart
                      data={waterMeasurements
                        .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                        .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                      seriesKeys={['value']}
                      seriesLabels={{ value: 'Water' }}
                      seriesColors={{ value: '#38bdf8' }}
                      height={180}
                      yLabel="scale"
                      formatY={(v) => getPresetLabel('water', Math.round(v))}
                    />
                  </ErrorBoundary>
                </View>
              );
            })()}

            {/* Behavior charts */}
            {transitionDone && chartTab === 'behavior' && (() => {
              const behaviorTypes = ['grooming', 'activity', 'litter', 'vomiting'].filter(t => measurementsByType[t]?.length);
              const typeColors: Record<string, string> = { grooming: '#c084fc', activity: '#4ade80', litter: '#fbbf24', vomiting: '#f87171' };
              if (behaviorTypes.length === 0) return (
                <View style={{ backgroundColor: '#1f1830', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center' }}>
                  <Text style={{ color: '#6b5f85', fontSize: 14 }}>No behavioral data to chart</Text>
                </View>
              );
              return (
                <View style={{ gap: 12 }}>
                  {behaviorTypes.map(type => {
                    const typeMeasurements = measurementsByType[type] ?? [];
                    if (typeMeasurements.length < 2) return null;
                    return (
                      <View key={type} style={{ backgroundColor: '#1f1830', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                        <Text style={{ fontWeight: '600', fontSize: 14, color: '#a899c0', marginBottom: 12 }}>
                          {MEAS_TYPE_LABELS[type] ?? type}
                        </Text>
                        <ErrorBoundary>
                          <LineChart
                            data={typeMeasurements
                              .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
                              .map(m => ({ date: new Date(m.measured_at).getTime(), value: m.value }))}
                            seriesKeys={['value']}
                            seriesLabels={{ value: MEAS_TYPE_LABELS[type] ?? type }}
                            seriesColors={{ value: typeColors[type] ?? '#c084fc' }}
                            height={150}
                            yLabel="scale"
                            formatY={(v) => getPresetLabel(type, Math.round(v))}
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
              const filteredDayGroups = groupByDay(filteredMeasurements);
              const filteredRecentGroups = filteredDayGroups.filter(g => g.dateStr >= cutoff);
              const filteredOlderGroups = filteredDayGroups.filter(g => g.dateStr < cutoff);
              const filteredDefaultGroups = filteredRecentGroups.length > 0 ? filteredRecentGroups : filteredDayGroups.slice(0, 3);
              const filteredVisibleGroups = showOlderHistory ? filteredDayGroups : filteredDefaultGroups;
              const filteredOlderCount = filteredOlderGroups.reduce((sum, g) => sum + g.items.length, 0);
              return filteredMeasurements.length > 0 && (
              <View style={{
                backgroundColor: '#1f1830',
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
              }}>
                <Text style={{ fontWeight: '600', fontSize: 16, color: '#ede9f6', marginBottom: 16 }}>
                  History
                </Text>

                {filteredVisibleGroups.map((group) => (
                  <View key={group.dateStr} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#6b5f85' }}>{group.label}</Text>
                      <Text style={{ fontSize: 12, color: 'rgba(107,95,133,0.6)' }}>
                        {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
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
                          borderBottomColor: 'rgba(255,255,255,0.05)',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <Text style={{ color: '#6b5f85', fontSize: 12, width: 64, flexShrink: 0 }}>
                            {formatTime(m.measured_at)}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                            <Text style={{ fontWeight: '600', fontSize: 14, color: '#ede9f6' }}>
                              {m.unit === 'scale' ? getPresetLabel(m.type, m.value) : `${m.value} ${m.unit}`}
                            </Text>
                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#1f1830' }}>
                              <Text style={{ fontSize: 11, color: '#6b5f85' }}>
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
                                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#1f1830' }}
                              >
                                <Text style={{ color: '#6b5f85', fontSize: 12 }}>Cancel</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => executeDeleteMeasurement(m.id)}
                                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.1)' }}
                              >
                                <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>Delete</Text>
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
                      backgroundColor: '#1f1830',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.07)',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b5f85' }}>
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
          <View style={{ paddingHorizontal: 16, gap: 16, marginTop: 16, paddingBottom: 32 }}>
            <View style={{
              backgroundColor: '#1f1830',
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontWeight: '600', fontSize: 16, color: '#ede9f6' }}>Care Schedule</Text>
                  {meds.reduce((sum, m) => sum + (m.overdue_count ?? 0), 0) > 0 && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(248,113,113,0.15)' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#f87171' }}>
                        {meds.reduce((sum, m) => sum + (m.overdue_count ?? 0), 0)} overdue
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {meds.length === 0 ? (
                <Text style={{ fontSize: 12, color: '#6b5f85', paddingVertical: 4 }}>No care items tracked yet.</Text>
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
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ede9f6' }} numberOfLines={1}>
                            {med.name}
                          </Text>
                          {(med.overdue_count ?? 0) > 0 && (
                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(248,113,113,0.15)' }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#f87171' }}>overdue</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 12, color: '#6b5f85', marginTop: 2 }}>
                          {FREQ_SHORT[med.frequency] ?? med.frequency} {'\u00B7'} {formatNextDue(med.next_due_at)}
                        </Text>
                      </View>
                      <Text style={{ color: '#6b5f85', fontSize: 14 }}>{'\u203A'}</Text>
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
                  <Text style={{ color: '#c084fc', fontSize: 14, fontWeight: '600' }}>
                    + Add Care Item
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Reminders link */}
            <Pressable
              onPress={() => router.push('/notifications' as never)}
              style={{
                backgroundColor: '#1f1830',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ede9f6' }}>Reminders & Notifications</Text>
                <Text style={{ fontSize: 12, color: '#6b5f85', marginTop: 2 }}>View upcoming doses and overdue items</Text>
              </View>
              <Text style={{ color: '#6b5f85', fontSize: 18 }}>{'\u203A'}</Text>
            </Pressable>
          </View>
        )}

        {/* About tab */}
        {profileTab === 'about' && (
          <View style={{ paddingHorizontal: 16, gap: 16, marginTop: 16, paddingBottom: 32 }}>
            <View style={{
              backgroundColor: '#1f1830',
              borderRadius: 16,
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
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
                  valueColor={status !== 'ok' ? statusColor : '#fb923c'}
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
                backgroundColor: '#1f1830',
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
              }}>
                <Text style={{ color: '#a899c0', fontSize: 14, fontStyle: 'italic' }}>{cat.notes}</Text>
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
              <Text style={{ color: '#c084fc', fontSize: 14, fontWeight: '600' }}>Edit profile</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: 'rgba(255,255,255,0.07)',
    }}>
      <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{icon}</Text>
      <Text style={{ fontSize: 12, color: '#6b5f85', width: 80, flexShrink: 0 }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 14, color: valueColor ?? '#ede9f6', fontWeight: valueColor ? '600' : '400' }}>
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
