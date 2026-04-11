import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import type { Cat, Measurement } from '../../lib/api';
import CatAvatar from '../../components/CatAvatar';
import { assessHealth, STATUS_COLORS, STATUS_LABEL } from '../../lib/healthMetrics';
import type { HealthStatus } from '../../lib/healthMetrics';
import { detectCorrelations, getHomeBadge } from '../../lib/correlations';
import { catAge, formatLocalDate } from '../../lib/dates';
import { useThemeColors } from '../../hooks/useThemeColors';

const STATUS_RANK: Record<string, number> = { urgent: 3, concerning: 2, watch: 1, ok: 0 };

interface CatCardData {
  cat: Cat;
  latestWeight: number | null;
  latestUnit: string;
  healthStatus: string;
  correlationBadge: string | null;
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const [catData, setCatData] = useState<CatCardData[]>([]);
  const [memorialCats, setMemorialCats] = useState<Cat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);

  const fetchCats = useCallback(async () => {
    try {
      const allCats = await api.getCats('all');
      const activeCats = allCats.filter(c => !c.deceased_at);
      setMemorialCats(allCats.filter(c => !!c.deceased_at));

      const enriched = await Promise.all(
        activeCats.map(async (cat): Promise<CatCardData> => {
          try {
            const ms = await api.getMeasurements(cat.id);
            const weightMs = ms.filter((m: Measurement) => m.type === 'weight');
            const sorted = [...weightMs].sort((a, b) => b.measured_at.localeCompare(a.measured_at));
            const health = assessHealth(weightMs);
            const byType: Record<string, Measurement[]> = {};
            for (const m of ms) {
              if (!byType[m.type]) byType[m.type] = [];
              byType[m.type]!.push(m);
            }
            const correlations = detectCorrelations(byType);
            const correlationBadge = getHomeBadge(correlations);
            return {
              cat,
              latestWeight: sorted[0]?.value ?? null,
              latestUnit: sorted[0]?.unit ?? 'lbs',
              healthStatus: health.overallStatus,
              correlationBadge,
            };
          } catch {
            return { cat, latestWeight: null, latestUnit: 'lbs', healthStatus: 'ok', correlationBadge: null };
          }
        })
      );
      enriched.sort((a, b) => (STATUS_RANK[b.healthStatus] ?? 0) - (STATUS_RANK[a.healthStatus] ?? 0));
      setCatData(enriched);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotifCount = useCallback(async () => {
    try {
      const inbox = await api.getNotifications();
      setNotifCount(inbox.overdue.length + inbox.due_today.length);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchCats();
    loadNotifCount();
  }, [fetchCats, loadNotifCount]);

  // Re-fetch when tab regains focus (e.g. returning from edit with new photo or new measurements)
  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      fetchCats();
      loadNotifCount();
    }, [fetchCats, loadNotifCount, loading]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCats(), loadNotifCount()]);
    setRefreshing(false);
  }, [fetchCats, loadNotifCount]);

  async function handleClaimCats() {
    setClaiming(true);
    try {
      await api.claimCats();
      await fetchCats();
    } finally {
      setClaiming(false);
    }
  }

  const catCount = catData.length + memorialCats.length;
  const initial = (user?.display_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  const CARD_BG: Record<string, string> = {
    ok: colors.surface,
    watch: colors.surface,
    concerning: 'rgba(249,115,22,0.07)',
    urgent: 'rgba(248,113,113,0.09)',
  };

  const CARD_BORDER: Record<string, string> = {
    ok: colors.rim,
    watch: 'rgba(251,191,36,0.4)',
    concerning: 'rgba(249,115,22,0.5)',
    urgent: 'rgba(248,113,113,0.6)',
  };

  const AVATAR_BG: Record<string, string> = {
    ok: 'rgba(192,132,252,0.15)',
    watch: 'rgba(251,191,36,0.12)',
    concerning: 'rgba(249,115,22,0.15)',
    urgent: 'rgba(248,113,113,0.15)',
  };

  const AVATAR_BORDER: Record<string, string> = {
    ok: 'rgba(192,132,252,0.3)',
    watch: 'rgba(251,191,36,0.5)',
    concerning: 'rgba(249,115,22,0.6)',
    urgent: 'rgba(248,113,113,0.7)',
  };

  function renderCatCard({ item }: { item: CatCardData }) {
    const { cat, latestWeight, latestUnit, healthStatus, correlationBadge } = item;
    const isOk = healthStatus === 'ok';
    const statusColor = STATUS_COLORS[healthStatus as HealthStatus] ?? '#4ade80';
    const isUrgent = healthStatus === 'urgent';
    const isConcerning = healthStatus === 'concerning';

    return (
      <Pressable
        onPress={() => router.push(`/cats/${cat.id}` as never)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          padding: 20,
          borderRadius: 20,
          backgroundColor: CARD_BG[healthStatus] ?? CARD_BG.ok,
          borderWidth: healthStatus === 'urgent' ? 2 : healthStatus === 'ok' ? 1 : 1.5,
          borderColor: CARD_BORDER[healthStatus] ?? CARD_BORDER.ok,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: AVATAR_BG[healthStatus] ?? AVATAR_BG.ok,
            borderWidth: healthStatus === 'ok' ? 1 : 2,
            borderColor: AVATAR_BORDER[healthStatus] ?? AVATAR_BORDER.ok,
          }}
        >
          <CatAvatar photoUrl={cat.photo_url} name={cat.name} size={56} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }} numberOfLines={1}>
              {cat.name}
            </Text>
            {!isOk && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: `${statusColor}20`,
                  borderWidth: 1,
                  borderColor: `${statusColor}50`,
                }}
              >
                <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {isUrgent ? '\u26A0 ' : isConcerning ? '! ' : ''}
                  {STATUS_LABEL[healthStatus as HealthStatus]}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={{ color: colors.inkMid, fontSize: 12 }}>{catAge(cat.birthdate)}</Text>
            {cat.breed ? <Text style={{ color: colors.inkMid, fontSize: 12 }}>{'\u00B7'} {cat.breed}</Text> : null}
          </View>
          {!isOk && (
            <Text style={{ fontSize: 12, marginTop: 6, fontWeight: '500', color: statusColor }}>
              {isUrgent ? 'Vet visit recommended' : isConcerning ? 'Monitor closely' : 'Keep an eye on weight trend'}
            </Text>
          )}
          {correlationBadge && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: 'rgba(192,132,252,0.8)' }}>{'\u26A1'}</Text>
              <Text style={{ fontSize: 12, color: 'rgba(192,132,252,0.8)' }}>{correlationBadge}</Text>
            </View>
          )}
        </View>

        {latestWeight !== null && (
          <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: isOk ? '#fb923c' : statusColor }}>
              {latestWeight}
            </Text>
            <Text style={{ color: colors.inkDim, fontSize: 12 }}>{latestUnit}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  function renderMemorialCat({ item: cat }: { item: Cat }) {
    return (
      <Pressable
        onPress={() => router.push(`/cats/${cat.id}/memorial` as never)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.rim,
          opacity: 0.75,
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.rim }}>
          <CatAvatar photoUrl={cat.photo_url} name={cat.name} size={40} grayscale />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.inkMid }} numberOfLines={1}>{cat.name}</Text>
          {cat.deceased_at && (
            <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>
              {formatLocalDate(cat.deceased_at)}
            </Text>
          )}
        </View>
        <Text style={{ color: colors.inkDim, fontSize: 14 }}>{'\u2192'}</Text>
      </Pressable>
    );
  }

  const ListHeader = () => (
    <View style={{ gap: 12 }}>
      {error && (
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}>
          <Text style={{ color: '#f87171', fontSize: 14 }}>{error}</Text>
        </View>
      )}

      {user?.hasOrphanedCats && (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: 'rgba(192,132,252,0.25)',
          gap: 12,
        }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Existing cats found</Text>
            <Text style={{ fontSize: 12, color: colors.inkMid, marginTop: 2 }}>
              Some cats here aren't linked to your account yet
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={handleClaimCats}
              disabled={claiming}
              style={{
                backgroundColor: '#c084fc',
                borderRadius: 12,
                paddingVertical: 8,
                paddingHorizontal: 16,
                opacity: claiming ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
                {claiming ? 'Claiming\u2026' : 'Yes, claim them'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {/* dismiss */}}
              style={{ paddingVertical: 8, paddingHorizontal: 12 }}
            >
              <Text style={{ color: colors.inkDim, fontSize: 12 }}>Skip</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  const ListFooter = () => (
    <View style={{ gap: 12, marginTop: 4 }}>
      {/* Add cat card */}
      <Pressable
        onPress={() => router.push('/cats/new' as never)}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingVertical: 16,
          borderRadius: 20,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: 'rgba(192,132,252,0.25)',
        }}
      >
        <Text style={{ fontSize: 18, color: colors.inkDim }}>{'\uFF0B'}</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.inkDim }}>Add a cat</Text>
      </Pressable>

      {/* Wellness Guide */}
      <Pressable
        onPress={() => router.push('/wellness' as never)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderRadius: 20,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.rim,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 20 }}>{'\uD83D\uDC3E'}</Text>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Cat Wellness Guide</Text>
            <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>Monthly checks, vitals, vet signs</Text>
          </View>
        </View>
        <Text style={{ fontSize: 14, color: colors.inkDim }}>{'\u2192'}</Text>
      </Pressable>

      {/* In Memoriam */}
      {memorialCats.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{
            fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
            letterSpacing: 2, color: colors.inkDim, marginBottom: 12,
          }}>
            In Memoriam
          </Text>
          <View style={{ gap: 8 }}>
            {memorialCats.map((cat) => (
              <View key={cat.id}>{renderMemorialCat({ item: cat })}</View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      {/* Profile popover overlay */}
      {showProfile && (
        <Pressable
          onPress={() => setShowProfile(false)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 40,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 72,
              left: 16,
              minWidth: 180,
              borderRadius: 16,
              padding: 16,
              gap: 12,
              backgroundColor: colors.surfaceHi,
              borderWidth: 1,
              borderColor: colors.rim,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 32,
              elevation: 8,
              zIndex: 41,
            }}
          >
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }} numberOfLines={1}>
                {user?.display_name ?? 'You'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.inkDim }} numberOfLines={1}>{user?.email}</Text>
            </View>
            <Pressable
              onPress={() => { setShowProfile(false); router.push('/settings' as never); }}
              style={{ paddingVertical: 4 }}
            >
              <Text style={{ fontSize: 14, color: colors.inkDim }}>Settings {'\u2192'}</Text>
            </Pressable>
            <View style={{ borderTopWidth: 1, borderTopColor: colors.rim, marginVertical: 2 }} />
            <Pressable
              onPress={() => { setShowProfile(false); signOut(); }}
              style={{ paddingVertical: 4 }}
            >
              <Text style={{ fontSize: 14, color: '#f87171' }}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Pressable onPress={() => setShowProfile(prev => !prev)}>
          {user?.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={{
                width: 36, height: 36, borderRadius: 18,
                borderWidth: 1.5, borderColor: 'rgba(192,132,252,0.3)',
              }}
            />
          ) : (
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(192,132,252,0.2)',
              borderWidth: 1.5, borderColor: 'rgba(192,132,252,0.3)',
            }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: '#c084fc' }}>{initial}</Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.ink }}>My Cats</Text>
          <Text style={{ fontSize: 13, color: colors.inkDim, marginTop: 2 }}>
            {catCount > 0 ? `${catCount} cat${catCount !== 1 ? 's' : ''} tracked` : 'Add a cat to get started'}
          </Text>
        </View>

        {/* Notification bell */}
        <Pressable
          onPress={() => router.push('/notifications' as never)}
          style={{ padding: 8, position: 'relative' }}
        >
          <Text style={{ fontSize: 20, color: colors.inkDim }}>{'\uD83D\uDD14'}</Text>
          {notifCount > 0 && (
            <View style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 16, height: 16,
              borderRadius: 8,
              backgroundColor: '#f87171',
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 4,
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                {notifCount > 99 ? '99+' : notifCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Cat list */}
      <FlatList
        data={loading ? [] : catData}
        keyExtractor={(item) => item.cat.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lavender} />
        }
        ListHeaderComponent={<ListHeader />}
        ListFooterComponent={!loading ? <ListFooter /> : null}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 84,
                    borderRadius: 20,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.rim,
                  }}
                />
              ))}
            </View>
          ) : null
        }
        renderItem={renderCatCard}
      />
    </SafeAreaView>
  );
}
