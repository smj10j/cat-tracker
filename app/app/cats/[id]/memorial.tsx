import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../lib/api';
import type { Cat, Measurement } from '../../../lib/api';
import CatAvatar from '../../../components/CatAvatar';
import LineChart, { type ChartDataPoint } from '../../../components/LineChart';
import { assessHealth, STATUS_COLORS, STATUS_LABEL } from '../../../lib/healthMetrics';
import type { HealthStatus } from '../../../lib/healthMetrics';
import { parseLocalDate, formatLocalDate } from '../../../lib/dates';
import { useThemeColors } from '../../../hooks/useThemeColors';

function catLifespan(birthdate: string, deceasedAt: string): string {
  const birth = parseLocalDate(birthdate);
  const death = parseLocalDate(deceasedAt);
  const months =
    (death.getFullYear() - birth.getFullYear()) * 12 +
    (death.getMonth() - birth.getMonth());
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0
    ? `${years} year${years !== 1 ? 's' : ''} and ${rem} month${rem !== 1 ? 's' : ''}`
    : `${years} year${years !== 1 ? 's' : ''}`;
}

export default function MemorialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const [cat, setCat] = useState<Cat | null>(null);
  const [weightMs, setWeightMs] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getCat(id), api.getMeasurements(id)])
      .then(([c, ms]) => {
        setCat(c);
        const weights = ms
          .filter((m: Measurement) => m.type === 'weight')
          .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
        setWeightMs(weights);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
        <View style={{ padding: 24, gap: 16 }}>
          <View style={{ height: 32, width: 128, borderRadius: 8, backgroundColor: colors.surface }} />
          <View style={{ height: 256, borderRadius: 16, backgroundColor: colors.surface }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!cat) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: colors.inkDim, fontSize: 14 }}>Cat not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#c084fc', fontSize: 14 }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const health = assessHealth(weightMs);
  const peakWeight = weightMs.length > 0 ? Math.max(...weightMs.map(m => m.value)) : null;
  const peakUnit = weightMs.length > 0 ? (weightMs[weightMs.length - 1]?.unit ?? 'lbs') : 'lbs';

  const chartData: ChartDataPoint[] = weightMs.map(m => ({
    date: new Date(m.measured_at).getTime(),
    weight: m.value,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 32, paddingHorizontal: 16 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.surfaceHi,
              borderWidth: 1,
              borderColor: colors.rim,
              borderRadius: 20,
              paddingVertical: 6,
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ color: colors.inkDim, fontSize: 14 }}>{'\u2190'} Back</Text>
          </Pressable>

          <View
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              overflow: 'hidden',
              borderWidth: 3,
              borderColor: 'rgba(192,132,252,0.3)',
              marginBottom: 20,
            }}
          >
            <CatAvatar photoUrl={cat.photo_url} name={cat.name} size={112} grayscale />
          </View>

          <Text style={{ fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>
            {cat.name}
          </Text>
          <Text style={{ fontSize: 14, color: colors.inkDim }}>{'\uD83D\uDD4A\uFE0F'}</Text>
          {cat.deceased_at && (
            <Text style={{ fontSize: 14, color: colors.inkDim, marginTop: 4 }}>
              {formatLocalDate(cat.birthdate)} {'\u2014'} {formatLocalDate(cat.deceased_at)}
            </Text>
          )}
          {cat.deceased_at && (
            <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>
              {catLifespan(cat.birthdate, cat.deceased_at)} of life
            </Text>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {/* Memorial note */}
          {cat.memorial_note ? (
            <View
              style={{
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 16,
                alignItems: 'center',
                backgroundColor: 'rgba(192,132,252,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(192,132,252,0.2)',
              }}
            >
              <Text style={{ fontSize: 14, color: colors.inkMid, fontStyle: 'italic', textAlign: 'center', lineHeight: 22 }}>
                "{cat.memorial_note}"
              </Text>
            </View>
          ) : null}

          {/* Life summary */}
          <View
            style={{
              borderRadius: 16,
              paddingHorizontal: 20,
              paddingVertical: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2, color: colors.inkDim }}>
              Life summary
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              {cat.breed ? (
                <View style={{ minWidth: '40%' }}>
                  <Text style={{ fontSize: 12, color: colors.inkDim }}>Breed</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{cat.breed}</Text>
                </View>
              ) : null}
              {weightMs.length > 0 && peakWeight !== null ? (
                <View style={{ minWidth: '40%' }}>
                  <Text style={{ fontSize: 12, color: colors.inkDim }}>Peak weight</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{peakWeight} {peakUnit}</Text>
                </View>
              ) : null}
              <View style={{ minWidth: '40%' }}>
                <Text style={{ fontSize: 12, color: colors.inkDim }}>Measurements logged</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{weightMs.length}</Text>
              </View>
              {health.overallStatus !== 'ok' ? (
                <View style={{ minWidth: '40%' }}>
                  <Text style={{ fontSize: 12, color: colors.inkDim }}>Last health status</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: STATUS_COLORS[health.overallStatus as HealthStatus] }}>
                    {STATUS_LABEL[health.overallStatus as HealthStatus]}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Collapsible weight history */}
          {weightMs.length > 0 ? (
            <View
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Pressable
                onPress={() => setHistoryOpen(o => !o)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                }}
              >
                <Text style={{ fontSize: 14 }}>{'\uD83D\uDCC8'}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Weight history
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.inkDim,
                    transform: [{ rotate: historyOpen ? '180deg' : '0deg' }],
                  }}
                >
                  {'\u2193'}
                </Text>
              </Pressable>
              {historyOpen ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                  <LineChart
                    data={chartData}
                    seriesKeys={['weight']}
                    seriesLabels={{ weight: 'Weight' }}
                    seriesColors={{ weight: '#c084fc' }}
                    height={200}
                    yLabel={peakUnit}
                    formatY={(v) => `${v}`}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Edit memorial link */}
          <Pressable
            onPress={() => router.push(`/cats/${cat.id}/edit` as never)}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.rim,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.inkDim }}>Edit memorial</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
