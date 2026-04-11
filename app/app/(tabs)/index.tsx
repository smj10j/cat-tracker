import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import type { Cat } from '../../lib/api';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [cats, setCats] = useState<Cat[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCats = useCallback(async () => {
    try {
      const data = await api.getCats();
      setCats(data);
    } catch (err) {
      console.error('Failed to fetch cats:', err);
    }
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCats();
    setRefreshing(false);
  }, [fetchCats]);

  return (
    <SafeAreaView className="flex-1 bg-night">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center gap-3">
          {user?.avatar_url ? (
            <View className="w-8 h-8 rounded-full bg-surface-hi" />
          ) : null}
          <Text className="text-ink text-xl font-bold">Cats</Text>
        </View>
        <Pressable onPress={signOut}>
          <Text className="text-ink-dim text-sm">Sign Out</Text>
        </Pressable>
      </View>

      {/* Cat list */}
      <FlatList
        data={cats}
        keyExtractor={(cat) => cat.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c084fc" />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-5xl mb-4">🐱</Text>
            <Text className="text-ink-mid text-base">No cats yet</Text>
            <Pressable
              onPress={() => router.push('/cats/new' as never)}
              className="mt-4 bg-lavender rounded-xl py-3 px-6"
            >
              <Text className="text-white font-semibold">Add Your First Cat</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: cat }) => (
          <Pressable
            onPress={() => router.push(`/cats/${cat.id}` as never)}
            className="bg-surface rounded-card p-4 border border-rim"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-3xl">{cat.photo_url ? '📷' : '🐱'}</Text>
              <View className="flex-1">
                <Text className="text-ink text-lg font-semibold">{cat.name}</Text>
                {cat.breed ? (
                  <Text className="text-ink-mid text-sm">{cat.breed}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
