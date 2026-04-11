import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  return (
    <SafeAreaView className="flex-1 bg-night items-center justify-center">
      <ActivityIndicator color="#c084fc" size="large" />
      <Text className="text-ink mt-4">Accepting invite...</Text>
      <Text className="text-ink-dim text-sm mt-2">Token: {token?.slice(0, 8)}...</Text>
    </SafeAreaView>
  );
}
