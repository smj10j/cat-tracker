import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';

function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
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
          <Stack.Screen name="cats/[id]/care-item" />
          <Stack.Screen name="cats/[id]/export" />
          <Stack.Screen name="cats/[id]/memorial" />
          <Stack.Screen name="cats/[id]/health" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
