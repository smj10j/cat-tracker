import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../lib/api';
import type { Cat } from '../../../lib/api';

export default function CatProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cat, setCat] = useState<Cat | null>(null);
  const [activeTab, setActiveTab] = useState<'health' | 'care' | 'about'>('health');

  useEffect(() => {
    if (id) {
      api.getCat(id).then(setCat).catch(console.error);
    }
  }, [id]);

  if (!cat) {
    return (
      <SafeAreaView className="flex-1 bg-night items-center justify-center">
        <Text className="text-ink-mid">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-night">
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold flex-1" numberOfLines={1}>{cat.name}</Text>
      </View>

      {/* Tab bar */}
      <View className="flex-row border-b border-rim px-4">
        {(['health', 'care', 'about'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`py-3 px-4 ${activeTab === tab ? 'border-b-2 border-lavender' : ''}`}
          >
            <Text className={`text-sm font-medium capitalize ${activeTab === tab ? 'text-lavender' : 'text-ink-dim'}`}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {activeTab === 'health' && (
          <View className="gap-4">
            <View className="bg-surface rounded-card p-4 border border-rim">
              <Text className="text-ink font-semibold">Health Dashboard</Text>
              <Text className="text-ink-mid text-sm mt-2">
                Weight chart, insights panel, and measurement history will appear here.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'care' && (
          <View className="gap-4">
            <View className="bg-surface rounded-card p-4 border border-rim">
              <Text className="text-ink font-semibold">Care Schedule</Text>
              <Text className="text-ink-mid text-sm mt-2">
                Medications and care items will appear here.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'about' && (
          <View className="gap-4">
            <View className="bg-surface rounded-card p-4 border border-rim">
              <Text className="text-ink font-semibold">About {cat.name}</Text>
              <View className="mt-3 gap-2">
                {cat.breed ? (
                  <Text className="text-ink-mid text-sm">Breed: {cat.breed}</Text>
                ) : null}
                <Text className="text-ink-mid text-sm">Born: {cat.birthdate}</Text>
                {cat.sex ? (
                  <Text className="text-ink-mid text-sm">Sex: {cat.sex}</Text>
                ) : null}
                {cat.microchip_id ? (
                  <Text className="text-ink-mid text-sm">Microchip: {cat.microchip_id}</Text>
                ) : null}
                {cat.notes ? (
                  <Text className="text-ink-mid text-sm mt-2">{cat.notes}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
