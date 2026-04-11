import { useEffect, useState, useCallback } from 'react';
import { View, Text, SectionList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api, CARE_TYPE_ICONS } from '../lib/api';
import type { DoseWithContext, NotificationInbox } from '../lib/api';

export default function NotificationsScreen() {
  const router = useRouter();
  const [inbox, setInbox] = useState<NotificationInbox | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setInbox(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInbox();
    setRefreshing(false);
  }, [fetchInbox]);

  const sections = inbox ? [
    ...(inbox.overdue.length > 0 ? [{ title: 'Overdue', data: inbox.overdue }] : []),
    ...(inbox.due_today.length > 0 ? [{ title: 'Due Today', data: inbox.due_today }] : []),
    ...(inbox.upcoming.length > 0 ? [{ title: 'Upcoming', data: inbox.upcoming }] : []),
  ] : [];

  return (
    <SafeAreaView className="flex-1 bg-night">
      <View className="px-4 py-3 flex-row items-center gap-3 border-b border-rim">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold">Notifications</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c084fc" />
        }
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderSectionHeader={({ section }) => (
          <Text className={`text-sm font-semibold mt-4 mb-2 ${
            section.title === 'Overdue' ? 'text-rose' :
            section.title === 'Due Today' ? 'text-amber' : 'text-ink-mid'
          }`}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }: { item: DoseWithContext }) => (
          <Pressable
            onPress={() => router.push(`/cats/${item.cat_id}` as never)}
            className="bg-surface rounded-card p-4 border border-rim"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl">{CARE_TYPE_ICONS[item.med_type] ?? '📅'}</Text>
              <View className="flex-1">
                <Text className="text-ink font-semibold">{item.med_name}</Text>
                <Text className="text-ink-mid text-sm">{item.cat_name}</Text>
                {item.dose ? (
                  <Text className="text-ink-dim text-xs">{item.dose}</Text>
                ) : null}
              </View>
              <Text className="text-ink-dim text-xs">{item.due_at.slice(11, 16)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-3xl mb-4">🔔</Text>
            <Text className="text-ink-mid text-base">No notifications</Text>
            <Text className="text-ink-dim text-sm mt-1">Medication reminders will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
