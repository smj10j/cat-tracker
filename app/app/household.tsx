import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function HouseholdScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-night">
      <View className="px-4 py-3 flex-row items-center gap-3 border-b border-rim">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold">Household</Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl mb-4">🏠</Text>
        <Text className="text-ink text-lg font-semibold text-center">Household Management</Text>
        <Text className="text-ink-mid text-sm text-center mt-2">
          Invite members, manage roles, and share cat access. Full household screen coming in Phase 4.
        </Text>
      </View>
    </SafeAreaView>
  );
}
