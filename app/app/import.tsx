import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ResponsiveContainer } from '../components/ResponsiveContainer';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export default function ImportScreen() {
  const router = useRouter();
  const { rv } = useResponsiveLayout();

  return (
    <SafeAreaView className="flex-1 bg-night" edges={['top']}>
      <View className="px-4 py-3 flex-row items-center gap-3 border-b border-rim">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold">Import Data</Text>
      </View>

      <ResponsiveContainer style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text className="text-3xl mb-4">📄</Text>
        <Text className="text-ink text-lg font-semibold text-center">CSV Import</Text>
        <Text className="text-ink-mid text-sm text-center mt-2">
          Import cat health data from CSV files. Full import screen with expo-document-picker coming in Phase 4.
        </Text>
      </ResponsiveContainer>
    </SafeAreaView>
  );
}
