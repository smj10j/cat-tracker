import { View, Text, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-night">
      <View className="flex-1 items-center justify-center px-8">
        {/* Hero */}
        <Text className="text-5xl mb-4">🐱</Text>
        <Text className="text-ink text-3xl font-bold text-center">
          Whisker Health
        </Text>
        <Text className="text-ink-mid text-base mt-2 text-center">
          Track your cat's health with the care they deserve
        </Text>

        {/* Sign-in buttons */}
        <View className="w-full mt-12 gap-4">
          <Pressable
            onPress={signInWithGoogle}
            className="bg-white rounded-xl py-4 px-6 flex-row items-center justify-center"
          >
            <Text className="text-gray-800 text-base font-semibold">
              Sign in with Google
            </Text>
          </Pressable>

          {Platform.OS === 'ios' || Platform.OS === 'web' ? (
            <Pressable
              onPress={signInWithApple}
              className="bg-black rounded-xl py-4 px-6 flex-row items-center justify-center border border-white/20"
            >
              <Text className="text-white text-base font-semibold">
                 Sign in with Apple
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Privacy note */}
        <Text className="text-ink-dim text-xs text-center mt-8">
          Free. No ads. No tracking. Your cats' data stays yours.
        </Text>
      </View>
    </SafeAreaView>
  );
}
