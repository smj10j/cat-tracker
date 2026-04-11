import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import type { Cat, Measurement } from '../lib/api';
import { STATUS_COLORS } from '../lib/healthMetrics';
import type { HealthAssessment } from '../lib/healthMetrics';
import { detectCorrelations, describeCorrelation, detectConfluence } from '../lib/correlations';

const STATUS_ICON: Record<string, string> = {
  watch: '\uD83D\uDC40',
  concerning: '\u26A0\uFE0F',
  urgent: '\uD83D\uDEA8',
};

interface Props {
  cat: Cat;
  status: string;
  health: HealthAssessment;
  measurementsByType: Record<string, Measurement[]>;
  availableTypes: string[];
  hasWeightData: boolean;
}

export default function InsightsPanel({
  cat, status, health, measurementsByType, availableTypes, hasWeightData,
}: Props) {
  const router = useRouter();
  const [patternsOpen, setPatternsOpen] = useState(false);

  const isUrgent = status === 'urgent';
  const isConcerning = status === 'concerning';
  const isWatch = status === 'watch';
  const showHealthAlert = (isUrgent || isConcerning || isWatch) && hasWeightData;

  const correlations = availableTypes.length >= 2
    ? detectCorrelations(measurementsByType).filter((r) => r.strength !== 'none')
    : [];

  const confluence = correlations.length >= 2
    ? detectConfluence(correlations, cat.name)
    : null;

  const hasPatterns = availableTypes.length >= 2;
  const hasInsights = showHealthAlert || hasPatterns;

  if (!hasInsights) return null;

  const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? '#c084fc';

  const panelBg = isUrgent
    ? 'rgba(248,113,113,0.08)'
    : isConcerning
    ? 'rgba(249,115,22,0.07)'
    : isWatch
    ? 'rgba(251,191,36,0.07)'
    : 'rgba(192,132,252,0.06)';

  const panelBorderColor = isUrgent
    ? 'rgba(248,113,113,0.5)'
    : isConcerning
    ? 'rgba(249,115,22,0.45)'
    : isWatch
    ? 'rgba(251,191,36,0.35)'
    : 'rgba(192,132,252,0.2)';

  const panelBorderWidth = isUrgent ? 2 : isConcerning ? 1.5 : isWatch ? 1.5 : 1;

  const dividerColor = isUrgent
    ? 'rgba(248,113,113,0.15)'
    : isConcerning
    ? 'rgba(249,115,22,0.15)'
    : isWatch
    ? 'rgba(251,191,36,0.12)'
    : 'rgba(255,255,255,0.07)';

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
      {showHealthAlert && (
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
              <Text style={{ color: '#a899c0', fontSize: 14 }}>{health.summary}</Text>
            </View>
          </View>

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
            }}
          >
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>
                What to watch for & when to go to the vet
              </Text>
              <Text style={{ fontSize: 12, color: '#6b5f85', marginTop: 2 }}>
                Behavioral signs, vet thresholds, and what this means
              </Text>
            </View>
            <Text style={{ fontSize: 14, marginLeft: 12, color: statusColor }}>{'\u2192'}</Text>
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
            }}
          >
            <Text style={{ fontSize: 14, flexShrink: 0 }}>{'\uD83D\uDCC8'}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#a899c0', flex: 1 }}>Patterns</Text>

            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: correlations.length > 0 ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: correlations.length > 0 ? 'rgba(192,132,252,0.25)' : 'rgba(255,255,255,0.07)',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: correlations.length > 0 ? '#c084fc' : '#6b5f85',
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
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#f97316' }}>
                  {'\u26A0\uFE0F'} Multiple signals
                </Text>
              </View>
            )}

            <Text
              style={{
                color: '#6b5f85',
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
                  <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, color: '#f97316', textTransform: 'uppercase' }}>
                    Multiple signals \u2014 {confluence.clusterName}
                  </Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: '#fdba74' }}>
                    {confluence.ownerMessage}
                  </Text>
                </View>
              )}

              {correlations.length === 0 ? (
                <Text style={{ fontSize: 14, color: '#6b5f85' }}>
                  No patterns detected yet \u2014 keep logging to see trends emerge.
                </Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {correlations.map((r) => (
                    <View key={`${r.typeA}-${r.typeB}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          marginTop: 5,
                          backgroundColor: r.strength === 'notable' ? '#c084fc' : '#fb923c',
                        }}
                      />
                      <Text style={{ flex: 1, fontSize: 14, color: '#a899c0', lineHeight: 20 }}>
                        {describeCorrelation(r, cat.name, cat.sex)}
                      </Text>
                    </View>
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
