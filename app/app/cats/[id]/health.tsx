import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../lib/api';
import type { Cat, Measurement } from '../../../lib/api';
import {
  assessHealth,
  STATUS_COLORS,
  STATUS_LABEL,
  STATUS_EMOJI,
  WATCH_ATTENTION,
  CONCERNING_ATTENTION,
  URGENT_VET_SIGNS,
} from '@shared/lib/healthMetrics';
import { catAge } from '@shared/lib/dates';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { ResponsiveContainer } from '../../../components/ResponsiveContainer';

export default function HealthGuidanceScreen() {
  const colors = useThemeColors();
  const { rv } = useResponsiveLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [cat, setCat] = useState<Cat | null>(null);
  const [weightMs, setWeightMs] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getCat(id), api.getMeasurements(id, 'weight')])
      .then(([c, m]) => {
        setCat(c);
        setWeightMs(m);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.lavender} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !cat) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
        <View style={{ padding: 16 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.lavender, fontSize: 14 }}>{'\u2190'} Back</Text>
          </Pressable>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              marginTop: 16,
              borderWidth: 1,
              borderColor: colors.rim,
            }}
          >
            <Text style={{ color: colors.rose, fontSize: 14 }}>{error ?? 'Cat not found'}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const health = assessHealth(weightMs);
  const status = health.overallStatus;
  const statusColor = STATUS_COLORS[status];
  const isUrgent = status === 'urgent';
  const isConcerning = status === 'concerning';

  const payAttentionItems =
    isConcerning || isUrgent
      ? [...WATCH_ATTENTION, ...CONCERNING_ATTENTION]
      : WATCH_ATTENTION;

  const showVetNow = isConcerning || isUrgent;

  const headerBg = isUrgent
    ? 'rgba(248,113,113,0.14)'
    : isConcerning
    ? 'rgba(249,115,22,0.12)'
    : 'rgba(251,191,36,0.1)';

  const sectionBorder = isUrgent
    ? 'rgba(248,113,113,0.2)'
    : isConcerning
    ? 'rgba(249,115,22,0.2)'
    : 'rgba(251,191,36,0.15)';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ paddingTop: 16, paddingBottom: 24, backgroundColor: headerBg }}>
        <ResponsiveContainer>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Pressable
              onPress={() => router.back()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text style={{ fontSize: 18, color: colors.inkDim }}>{'\u2190'}</Text>
              <Text style={{ fontSize: 14, color: colors.inkDim }}>{cat.name}</Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/cats/${cat.id}/export` as never)}>
              <Text style={{ fontSize: 12, color: colors.inkDim }}>Export for vet</Text>
            </Pressable>
          </View>

          {/* Status badge + age */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: `${statusColor}18`,
                borderWidth: 1,
                borderColor: `${statusColor}40`,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: statusColor,
                }}
              >
                {STATUS_EMOJI[status]} {STATUS_LABEL[status]}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.inkDim }}>{catAge(cat.birthdate)}</Text>
          </View>

          {/* Headline */}
          <Text style={{ fontWeight: '700', fontSize: rv(20, 24), color: colors.ink, lineHeight: rv(26, 30) }}>
            {isUrgent
              ? `${cat.name}'s weight needs immediate attention`
              : isConcerning
              ? `${cat.name}'s weight trend is concerning`
              : `${cat.name}'s weight is worth watching`}
            {health.peakLossPct > 0 && (
              <Text style={{ color: statusColor }}> — {health.peakLossPct}% below peak</Text>
            )}
          </Text>

          {/* Summary */}
          <Text style={{ color: colors.inkMid, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
            {health.summary}
          </Text>
        </ResponsiveContainer>
        </View>

        <ResponsiveContainer style={{ gap: 16, marginTop: 16 }}>
          {/* Urgent vet signs */}
          {showVetNow && (
            <View
              style={{
                borderRadius: 16,
                padding: rv(20, 24),
                backgroundColor: 'rgba(248,113,113,0.07)',
                borderWidth: isUrgent ? 2 : 1,
                borderColor: 'rgba(248,113,113,0.4)',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 16,
                  color: colors.rose,
                }}
              >
                Go to the vet now if you see any of these
              </Text>
              {URGENT_VET_SIGNS.map((sign, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i < URGENT_VET_SIGNS.length - 1 ? 12 : 0 }}>
                  <Text style={{ color: colors.rose, fontWeight: '700', fontSize: 14, marginTop: 1 }}>!</Text>
                  <Text style={{ flex: 1, color: colors.inkMid, fontSize: 14, lineHeight: 20 }}>{sign}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Pay attention to */}
          <View
            style={{
              borderRadius: 16,
              padding: 20,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: sectionBorder,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 16,
                color: statusColor,
              }}
            >
              Pay attention to
            </Text>
            {payAttentionItems.map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i < payAttentionItems.length - 1 ? 12 : 0 }}>
                <Text style={{ color: statusColor, fontSize: 14, marginTop: 1 }}>{'\u00B7'}</Text>
                <Text style={{ flex: 1, color: colors.inkMid, fontSize: 14, lineHeight: 20 }}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Reassurance */}
          <View
            style={{
              borderRadius: 16,
              paddingHorizontal: rv(20, 24),
              paddingVertical: rv(16, 20),
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.rim,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.inkMid, lineHeight: 20 }}>
              {isUrgent
                ? 'These thresholds are based on feline veterinary guidelines. A loss of more than 10% of body weight or a rate faster than 2%/week warrants prompt evaluation \u2014 not because something is definitely wrong, but because catching issues early makes a real difference.'
                : isConcerning
                ? "Cats are good at hiding discomfort. These behavioral signals can appear before weight loss becomes severe, which is exactly when intervention is most effective. If you're seeing several of these, a vet visit is worthwhile even without an emergency."
                : "A mild weight change isn't always a problem \u2014 it could be a diet shift, seasonal variation, or measurement timing. The goal is to notice a trend early, not to panic at a single reading. Keep logging and see if the pattern continues."}
            </Text>
          </View>

          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: 'center',
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.rim,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.inkDim }}>
              {'\u2190'} Back to {cat.name}'s profile
            </Text>
          </Pressable>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}
