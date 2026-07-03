import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import type { Cat, Measurement, AckRecord, AckSeverity, AckDirection } from '../lib/api';
import { STATUS_COLORS } from '@shared/lib/healthMetrics';
import type { HealthAssessment } from '@shared/lib/healthMetrics';
import { detectCorrelations, describeCorrelation, detectConfluence } from '@shared/lib/correlations';
import type { CorrelationResult } from '@shared/lib/correlations';
import { getPresetLabel } from '@shared/lib/measurementPresets';
import { applyAcknowledgment, assessmentDirection } from '@shared/lib/alertAck';
import { LIMITS } from '@shared/lib/constants';
import { formatDateShort } from '@shared/lib/preferences';
import LineChart from './LineChart';
import { ErrorBoundary } from './ErrorBoundary';
import { useThemeColors } from '../hooks/useThemeColors';
import { usePreferences } from '../contexts/PreferencesContext';

const STATUS_ICON: Record<string, string> = {
  watch: '\uD83D\uDC40',
  concerning: '\u26A0\uFE0F',
  urgent: '\uD83D\uDEA8',
};

const MEAS_LABELS: Record<string, string> = {
  weight: 'Weight', food: 'Food', water: 'Water',
  grooming: 'Grooming', activity: 'Activity', vomiting: 'Vomiting', litter: 'Litter',
};

interface Props {
  cat: Cat;
  status: string;
  health: HealthAssessment;
  measurementsByType: Record<string, Measurement[]>;
  availableTypes: string[];
  hasWeightData: boolean;
  acknowledgment?: AckRecord | null;
  onAcknowledge: (severity: AckSeverity, direction: AckDirection, note: string) => Promise<void> | void;
  onWithdraw: () => Promise<void> | void;
  latestMeasuredAt: string;
}

export default function InsightsPanel({
  cat, status, health, measurementsByType, availableTypes, hasWeightData,
  acknowledgment, onAcknowledge, onWithdraw,
}: Props) {
  const colors = useThemeColors();
  const router = useRouter();
  const { prefs } = usePreferences();
  const [patternsOpen, setPatternsOpen] = useState(false);
  const [ackExpanded, setAckExpanded] = useState(false);
  const [ackNote, setAckNote] = useState('');
  const [ackSubmitting, setAckSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const isUrgent = status === 'urgent';
  const isConcerning = status === 'concerning';
  const isWatch = status === 'watch';
  const alertWorthy = (isUrgent || isConcerning || isWatch) && hasWeightData;

  // Acknowledgment suppression — superseded/expired acks yield suppressed=false.
  const suppressed = applyAcknowledgment(health, acknowledgment).suppressed && alertWorthy;
  const showFullAlert = alertWorthy && !suppressed;
  const showAckMuted = alertWorthy && suppressed;

  const correlations = availableTypes.length >= 2
    ? detectCorrelations(measurementsByType).filter((r) => r.strength !== 'none')
    : [];

  const confluence = correlations.length >= 2
    ? detectConfluence(correlations, cat.name)
    : null;

  const hasPatterns = availableTypes.length >= 2;
  const hasInsights = alertWorthy || hasPatterns;

  if (!hasInsights) return null;

  const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? colors.lavender;

  const ackDateShort = acknowledgment ? formatDateShort(acknowledgment.created_at.slice(0, 10), prefs) : '';

  async function handleConfirmAck() {
    if (ackSubmitting) return;
    setAckSubmitting(true);
    try {
      await onAcknowledge(status as AckSeverity, assessmentDirection(health), ackNote.trim());
      setAckExpanded(false);
      setAckNote('');
    } catch {
      // Leave the input open so the user can retry.
    } finally {
      setAckSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      await onWithdraw();
    } catch {
      // no-op — parent surfaces refresh failures
    } finally {
      setWithdrawing(false);
    }
  }

  // When acknowledged, mute the whole panel to a neutral card (no accent rim).
  const panelBg = suppressed
    ? colors.surface
    : isUrgent
    ? 'rgba(248,113,113,0.08)'
    : isConcerning
    ? 'rgba(249,115,22,0.07)'
    : isWatch
    ? 'rgba(251,191,36,0.07)'
    : 'rgba(192,132,252,0.06)';

  const panelBorderColor = suppressed
    ? colors.rim
    : isUrgent
    ? 'rgba(248,113,113,0.5)'
    : isConcerning
    ? 'rgba(249,115,22,0.45)'
    : isWatch
    ? 'rgba(251,191,36,0.35)'
    : 'rgba(192,132,252,0.2)';

  const panelBorderWidth = suppressed ? 1 : isUrgent ? 2 : isConcerning ? 1.5 : isWatch ? 1.5 : 1;

  const dividerColor = suppressed
    ? colors.rim
    : isUrgent
    ? 'rgba(248,113,113,0.15)'
    : isConcerning
    ? 'rgba(249,115,22,0.15)'
    : isWatch
    ? 'rgba(251,191,36,0.12)'
    : colors.rim;

  return (
    <View
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: panelBg,
        borderWidth: panelBorderWidth,
        borderColor: panelBorderColor,
      }}
    >
      {/* Health headline */}
      {showFullAlert && (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Text style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>
              {STATUS_ICON[status]}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, lineHeight: 20, marginBottom: 4, color: statusColor }}>
                {isUrgent
                  ? `${cat.name}'s weight needs immediate attention`
                  : isConcerning
                  ? `${cat.name}'s weight trend is concerning`
                  : `${cat.name}'s weight is worth watching`}
                {health.peakLossPct > 0 ? ` \u2014 ${health.peakLossPct}% below recent weight` : ''}
              </Text>
              <Text style={{ color: colors.inkMid, fontSize: 14 }}>{health.summary}</Text>
            </View>
          </View>

          {/* "I'm on it" \u2014 acknowledge this alert */}
          {!ackExpanded ? (
            <Pressable
              onPress={() => setAckExpanded(true)}
              style={{
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: `${statusColor}12`,
                borderWidth: 1,
                borderColor: `${statusColor}35`,
                minHeight: 48,
              }}
            >
              <Text style={{ fontSize: 14 }}>{'\ud83d\udc40'}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: statusColor }}>
                I{'\u2019'}m on it
              </Text>
            </Pressable>
          ) : (
            <View style={{ marginTop: 12, gap: 8 }}>
              <TextInput
                value={ackNote}
                onChangeText={setAckNote}
                placeholder="Add a note for your household (optional)"
                placeholderTextColor={colors.inkDim}
                multiline
                maxLength={LIMITS.ACK_NOTE}
                editable={!ackSubmitting}
                style={{
                  minHeight: 64,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.rim,
                  backgroundColor: colors.surface,
                  color: colors.ink,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  textAlignVertical: 'top',
                }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => { setAckExpanded(false); setAckNote(''); }}
                  disabled={ackSubmitting}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 16,
                    justifyContent: 'center',
                    borderRadius: 12,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.rim,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkDim }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmAck}
                  disabled={ackSubmitting}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 12,
                    backgroundColor: `${statusColor}20`,
                    borderWidth: 1,
                    borderColor: `${statusColor}50`,
                    opacity: ackSubmitting ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: statusColor }}>
                    {ackSubmitting ? 'Saving\u2026' : 'Confirm'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* CTA */}
          <Pressable
            onPress={() => router.push(`/cats/${cat.id}/health` as never)}
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: `${statusColor}12`,
              borderWidth: 1,
              borderColor: `${statusColor}35`,
              minHeight: 48,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>
                What to watch for & when to go to the vet
              </Text>
              <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>
                Behavioral signs, vet thresholds, and what this means
              </Text>
            </View>
            <Text style={{ fontSize: 14, marginLeft: 12, color: statusColor }}>{'\u2192'}</Text>
          </Pressable>

          {/* Wellness Guide link */}
          <Pressable
            onPress={() => router.push('/wellness' as never)}
            style={{
              marginTop: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: 'rgba(192,132,252,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(192,132,252,0.15)',
              minHeight: 44,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>{'\uD83D\uDC3E'}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.lavender }}>
                Cat Wellness Guide
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.lavender }}>{'\u2192'}</Text>
          </Pressable>
        </View>
      )}

      {/* Acknowledged (muted) \u2014 keeps the real status but tones down the alert */}
      {showAckMuted && (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Text style={{ fontSize: 20, flexShrink: 0, marginTop: 2, opacity: 0.7 }}>
              {STATUS_ICON[status]}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, lineHeight: 20, marginBottom: 4, color: colors.inkMid }}>
                {isUrgent
                  ? `${cat.name}'s weight needs immediate attention`
                  : isConcerning
                  ? `${cat.name}'s weight trend is concerning`
                  : `${cat.name}'s weight is worth watching`}
                {health.peakLossPct > 0 ? ` \u2014 ${health.peakLossPct}% below recent weight` : ''}
              </Text>
              <Text style={{ color: colors.inkMid, fontSize: 14 }}>{health.summary}</Text>
            </View>
          </View>

          {/* Acknowledgment receipt */}
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.rim,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.inkDim }}>
              {'\ud83d\udc40'} Acknowledged by {acknowledgment?.acknowledged_by_name ?? 'a household member'}
              {ackDateShort ? ` \u00b7 ${ackDateShort}` : ''}
            </Text>
            {acknowledgment?.note ? (
              <Text style={{ fontSize: 13, color: colors.inkMid, marginTop: 6, fontStyle: 'italic' }}>
                {`\u201c${acknowledgment.note}\u201d`}
              </Text>
            ) : null}
            <Pressable
              onPress={handleWithdraw}
              disabled={withdrawing}
              style={{ marginTop: 8, minHeight: 44, justifyContent: 'center' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.lavender }}>
                {withdrawing ? 'Undoing\u2026' : 'Undo'}
              </Text>
            </Pressable>
          </View>

          {/* CTA \u2014 still available while acknowledged */}
          <Pressable
            onPress={() => router.push(`/cats/${cat.id}/health` as never)}
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.rim,
              minHeight: 48,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkMid }}>
                What to watch for & when to go to the vet
              </Text>
              <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>
                Behavioral signs, vet thresholds, and what this means
              </Text>
            </View>
            <Text style={{ fontSize: 14, marginLeft: 12, color: colors.inkMid }}>{'\u2192'}</Text>
          </Pressable>
        </View>
      )}

      {/* Patterns section */}
      {hasPatterns && (
        <View style={{ borderTopWidth: 1, borderTopColor: dividerColor }}>
          <Pressable
            onPress={() => setPatternsOpen((o) => !o)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              minHeight: 48,
            }}
          >
            <Text style={{ fontSize: 14, flexShrink: 0 }}>{'\uD83D\uDCC8'}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkMid, flex: 1 }}>Patterns</Text>

            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: correlations.length > 0 ? 'rgba(192,132,252,0.15)' : colors.card,
                borderWidth: 1,
                borderColor: correlations.length > 0 ? 'rgba(192,132,252,0.25)' : colors.rim,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: correlations.length > 0 ? colors.lavender : colors.inkDim,
                }}
              >
                {correlations.length > 0 ? `${correlations.length} detected` : 'None yet'}
              </Text>
            </View>

            {confluence && !patternsOpen && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: 'rgba(249,115,22,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(249,115,22,0.35)',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.coral }}>
                  {'\u26A0\uFE0F'} Multiple signals
                </Text>
              </View>
            )}

            <Text
              style={{
                color: colors.inkDim,
                fontSize: 14,
                marginLeft: 4,
                transform: [{ rotate: patternsOpen ? '180deg' : '0deg' }],
              }}
            >
              {'\u2193'}
            </Text>
          </Pressable>

          {patternsOpen && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
              {confluence && (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: 'rgba(249,115,22,0.08)',
                    borderWidth: 1.5,
                    borderColor: 'rgba(249,115,22,0.4)',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, color: colors.coral, textTransform: 'uppercase' }}>
                    Multiple signals \u2014 {confluence.clusterName}
                  </Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: colors.coral }}>
                    {confluence.ownerMessage}
                  </Text>
                </View>
              )}

              {correlations.length === 0 ? (
                <Text style={{ fontSize: 14, color: colors.inkDim }}>
                  No patterns detected yet \u2014 keep logging to see trends emerge.
                </Text>
              ) : (
                <View style={{ gap: 16 }}>
                  {correlations.map((r) => (
                    <CorrelationCard
                      key={`${r.typeA}-${r.typeB}`}
                      correlation={r}
                      cat={cat}
                      measurementsByType={measurementsByType}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function CorrelationCard({
  correlation,
  cat,
  measurementsByType,
}: {
  correlation: CorrelationResult;
  cat: Cat;
  measurementsByType: Record<string, Measurement[]>;
}) {
  const colors = useThemeColors();
  const { typeA, typeB, strength } = correlation;
  const dataA = measurementsByType[typeA] ?? [];
  const dataB = measurementsByType[typeB] ?? [];

  const dotColor = strength === 'notable' ? colors.lavender : colors.amber;
  const typeAColor = colors.lavender;
  const typeBColor = colors.jade;

  const labelA = MEAS_LABELS[typeA] ?? typeA;
  const labelB = MEAS_LABELS[typeB] ?? typeB;

  // Build combined chart data — merge both types by date for a dual-line mini chart
  const chartData = buildCorrelationChartData(dataA, dataB, typeA, typeB);
  const hasEnoughData = chartData.length >= 2;

  const isBehavioral = (t: string) => ['grooming', 'activity', 'vomiting', 'litter', 'food', 'water'].includes(t);
  const formatYA = isBehavioral(typeA) ? (v: number) => getPresetLabel(typeA, Math.round(v)) : undefined;
  const formatYB = isBehavioral(typeB) ? (v: number) => getPresetLabel(typeB, Math.round(v)) : undefined;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: hasEnoughData ? 8 : 0 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginTop: 5,
            backgroundColor: dotColor,
          }}
        />
        <Text style={{ flex: 1, fontSize: 14, color: colors.inkMid, lineHeight: 20 }}>
          {describeCorrelation(correlation, cat.name, cat.sex)}
        </Text>
      </View>

      {/* Mini correlation chart */}
      {hasEnoughData && (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.rim,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeAColor }} />
              <Text style={{ fontSize: 11, color: colors.inkDim }}>{labelA}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeBColor }} />
              <Text style={{ fontSize: 11, color: colors.inkDim }}>{labelB}</Text>
            </View>
          </View>
          <ErrorBoundary>
            <LineChart
              data={chartData}
              seriesKeys={['a', 'b']}
              seriesLabels={{ a: labelA, b: labelB }}
              seriesColors={{ a: typeAColor, b: typeBColor }}
              height={120}
              formatY={(v) => String(Math.round(v * 10) / 10)}
            />
          </ErrorBoundary>
        </View>
      )}
    </View>
  );
}

/**
 * Build normalized chart data for two measurement types.
 * Normalizes both series to 0-1 range so they're visually comparable
 * regardless of their different units/scales.
 */
function buildCorrelationChartData(
  dataA: Measurement[],
  dataB: Measurement[],
  _typeA: string,
  _typeB: string,
): { date: number; a: number; b: number }[] {
  // Aggregate by date (use the date string as key, average values per day)
  const byDateA = aggregateByDate(dataA);
  const byDateB = aggregateByDate(dataB);

  // Find overlapping date range
  const allDates = new Set([...byDateA.keys(), ...byDateB.keys()]);
  const sortedDates = [...allDates].sort();

  if (sortedDates.length < 2) return [];

  // Get min/max for normalization
  const valsA = [...byDateA.values()];
  const valsB = [...byDateB.values()];
  const minA = Math.min(...valsA);
  const maxA = Math.max(...valsA);
  const minB = Math.min(...valsB);
  const maxB = Math.max(...valsB);
  const rangeA = maxA - minA || 1;
  const rangeB = maxB - minB || 1;

  // Fill forward: for dates where one type has data and the other doesn't,
  // use the last known value
  let lastA: number | null = null;
  let lastB: number | null = null;
  const result: { date: number; a: number; b: number }[] = [];

  for (const dateStr of sortedDates) {
    const rawA = byDateA.get(dateStr);
    const rawB = byDateB.get(dateStr);

    if (rawA !== undefined) lastA = rawA;
    if (rawB !== undefined) lastB = rawB;

    if (lastA !== null && lastB !== null) {
      result.push({
        date: new Date(dateStr + 'T12:00:00').getTime(),
        a: (lastA - minA) / rangeA,
        b: (lastB - minB) / rangeB,
      });
    }
  }

  return result;
}

function aggregateByDate(measurements: Measurement[]): Map<string, number> {
  const map = new Map<string, { sum: number; count: number }>();
  for (const m of measurements) {
    const dateStr = new Date(m.measured_at).toLocaleDateString('en-CA');
    const existing = map.get(dateStr);
    if (existing) {
      existing.sum += m.value;
      existing.count += 1;
    } else {
      map.set(dateStr, { sum: m.value, count: 1 });
    }
  }
  const result = new Map<string, number>();
  for (const [key, { sum, count }] of map) {
    result.set(key, sum / count);
  }
  return result;
}
