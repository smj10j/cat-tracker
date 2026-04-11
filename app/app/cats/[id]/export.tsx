import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function CatExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-night">
      <View className="px-4 py-3 flex-row items-center gap-3 border-b border-rim">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold">Vet Export</Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl mb-4">🩺</Text>
        <Text className="text-ink text-lg font-semibold text-center">Vet-Ready PDF Export</Text>
        <Text className="text-ink-mid text-sm text-center mt-2">
          Print-ready health report with weight history, behavioral trends, and clinical observations.
          Full export with expo-print + expo-sharing coming in Phase 4.
        </Text>
        <Text className="text-ink-dim text-xs mt-4">Cat ID: {id}</Text>
      </View>
    </SafeAreaView>
  );
}
