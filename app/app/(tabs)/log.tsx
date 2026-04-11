import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LogScreen() {
  return (
    <SafeAreaView className="flex-1 bg-night">
      <View className="flex-1 items-center justify-center">
        <Text className="text-ink text-xl font-bold">Daily Check-In</Text>
        <Text className="text-ink-mid mt-2">Coming in Phase 2</Text>
      </View>
    </SafeAreaView>
  );
}
