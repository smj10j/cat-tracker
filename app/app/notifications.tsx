import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api, CARE_TYPE_ICONS } from '../lib/api';
import type { DoseWithContext, Medication, NotificationInbox } from '../lib/api';
import { utcToLocal } from '../../shared/lib/dates';
import { useThemeColors } from '../hooks/useThemeColors';

type SectionItem =
  | { kind: 'dose'; data: DoseWithContext }
  | { kind: 'refill'; data: Medication & { cat_name: string } };

interface Section {
  title: string;
  accent: string;
  data: SectionItem[];
}

export default function NotificationsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [inbox, setInbox] = useState<NotificationInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setInbox(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchInbox().finally(() => setLoading(false));
  }, [fetchInbox]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInbox();
    setRefreshing(false);
  }, [fetchInbox]);

  async function handleAdminister(dose: DoseWithContext) {
    setProcessingId(dose.id);
    try {
      await api.logDose(dose.id, 'administer');
      await fetchInbox();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setProcessingId(null);
    }
  }

  function handleSkip(dose: DoseWithContext) {
    if (Platform.OS === 'web') {
      const reason = prompt('Reason for skipping (optional):');
      doSkip(dose, reason ?? undefined);
      return;
    }
    Alert.alert('Skip Dose', `Skip ${dose.med_name} for ${dose.cat_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Skip',
        style: 'destructive',
        onPress: () => doSkip(dose),
      },
    ]);
  }

  async function doSkip(dose: DoseWithContext, reason?: string) {
    setProcessingId(dose.id);
    try {
      await api.logDose(dose.id, 'skip', reason);
      await fetchInbox();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setProcessingId(null);
    }
  }

  const sections: Section[] = inbox
    ? [
        ...(inbox.overdue.length > 0
          ? [
              {
                title: 'Overdue',
                accent: colors.rose,
                data: inbox.overdue.map((d) => ({ kind: 'dose' as const, data: d })),
              },
            ]
          : []),
        ...(inbox.due_today.length > 0
          ? [
              {
                title: 'Due Today',
                accent: colors.honey,
                data: inbox.due_today.map((d) => ({ kind: 'dose' as const, data: d })),
              },
            ]
          : []),
        ...(inbox.upcoming.length > 0
          ? [
              {
                title: 'Upcoming',
                accent: colors.inkMid,
                data: inbox.upcoming.map((d) => ({ kind: 'dose' as const, data: d })),
              },
            ]
          : []),
        ...(inbox.refill_alerts.length > 0
          ? [
              {
                title: 'Refill Needed',
                accent: colors.amber,
                data: inbox.refill_alerts.map((r) => ({
                  kind: 'refill' as const,
                  data: r,
                })),
              },
            ]
          : []),
      ]
    : [];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <ActivityIndicator color={colors.lavender} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.rim,
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.lavender, fontSize: 15 }}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}>
          Notifications
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) =>
          item.kind === 'dose' ? item.data.id : `refill-${item.data.id}`
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.lavender}
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: section.accent,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          if (item.kind === 'refill') {
            const med = item.data;
            return (
              <Pressable
                onPress={() => router.push(`/cats/${med.cat_id}` as never)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(251,146,60,0.2)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 24 }}>
                  {CARE_TYPE_ICONS[med.type] ?? '\uD83D\uDCC5'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>
                    {med.name}
                  </Text>
                  <Text style={{ color: colors.inkMid, fontSize: 13, marginTop: 2 }}>
                    {med.cat_name}
                  </Text>
                  <Text style={{ color: colors.amber, fontSize: 12, marginTop: 2 }}>
                    {med.doses_remaining ?? 0} doses remaining
                    {med.refill_alert_threshold
                      ? ` (threshold: ${med.refill_alert_threshold})`
                      : ''}
                  </Text>
                </View>
              </Pressable>
            );
          }

          const dose = item.data;
          const isProcessing = processingId === dose.id;
          return (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 14,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.rim,
              }}
            >
              <Pressable
                onPress={() => router.push(`/cats/${dose.cat_id}` as never)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Text style={{ fontSize: 24 }}>
                  {CARE_TYPE_ICONS[dose.med_type] ?? '\uD83D\uDCC5'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>
                    {dose.med_name}
                  </Text>
                  <Text style={{ color: colors.inkMid, fontSize: 13, marginTop: 2 }}>
                    {dose.cat_name}
                  </Text>
                  {dose.dose && (
                    <Text style={{ color: colors.inkDim, fontSize: 12, marginTop: 2 }}>
                      {dose.dose}
                    </Text>
                  )}
                </View>
                <Text style={{ color: colors.inkDim, fontSize: 12 }}>
                  {utcToLocal(dose.due_at).time}
                </Text>
              </Pressable>

              {/* Action buttons */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.card,
                }}
              >
                <Pressable
                  onPress={() => handleAdminister(dose)}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: isProcessing
                      ? 'rgba(74,222,128,0.1)'
                      : 'rgba(74,222,128,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(74,222,128,0.25)',
                  }}
                >
                  <Text
                    style={{
                      color: colors.jade,
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    {isProcessing ? 'Saving...' : 'Done'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSkip(dose)}
                  disabled={isProcessing}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.rim,
                  }}
                >
                  <Text style={{ color: colors.inkDim, fontSize: 13, fontWeight: '500' }}>
                    Skip
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83D\uDD14'}</Text>
            <Text style={{ color: colors.inkMid, fontSize: 16, fontWeight: '600' }}>
              All caught up!
            </Text>
            <Text
              style={{
                color: colors.inkDim,
                fontSize: 14,
                marginTop: 6,
                textAlign: 'center',
                paddingHorizontal: 40,
              }}
            >
              Medication reminders and refill alerts will appear here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
