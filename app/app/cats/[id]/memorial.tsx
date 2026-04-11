import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../lib/api';
import type { Cat } from '../../../lib/api';

export default function MemorialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cat, setCat] = useState<Cat | null>(null);

  useEffect(() => {
    if (id) {
      api.getCat(id).then(setCat).catch(console.error);
    }
  }, [id]);

  if (!cat) return null;

  const birthYear = cat.birthdate ? new Date(cat.birthdate).getFullYear() : null;
  const passedYear = cat.deceased_at ? new Date(cat.deceased_at).getFullYear() : null;

  return (
    <SafeAreaView className="flex-1 bg-night">
      <View className="px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-6 py-8" contentContainerStyle={{ alignItems: 'center', gap: 24 }}>
        <Text className="text-5xl">🕊️</Text>
        <Text className="text-ink text-2xl font-bold text-center">{cat.name}</Text>
        {birthYear && passedYear ? (
          <Text className="text-ink-mid text-base">{birthYear} — {passedYear}</Text>
        ) : null}

        {cat.memorial_note ? (
          <View className="bg-surface rounded-card p-6 border border-rim w-full">
            <Text className="text-ink text-base leading-relaxed text-center italic">
              "{cat.memorial_note}"
            </Text>
          </View>
        ) : null}

        <Text className="text-ink-dim text-sm text-center max-w-[280px]">
          {cat.name}'s health records are preserved here as a lasting tribute.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
