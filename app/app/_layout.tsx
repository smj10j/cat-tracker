import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="cats/[id]/index" />
        <Stack.Screen name="cats/[id]/edit" />
        <Stack.Screen name="cats/new" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="wellness" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="household" />
        <Stack.Screen name="import" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="cats/[id]/export" />
        <Stack.Screen name="cats/[id]/memorial" />
      </Stack>
    </AuthProvider>
  );
}
