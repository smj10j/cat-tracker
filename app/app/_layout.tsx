import '../global.css';
import { View, ActivityIndicator } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useThemeColors } from '../hooks/useThemeColors';
import BottomNav from '../components/BottomNav';

function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

// Screens that should NOT show the bottom nav
const HIDE_NAV_ROUTES = ['/(auth)/login', '/login'];

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const colors = useThemeColors();

  const isLoginScreen = HIDE_NAV_ROUTES.some((r) => pathname === r || pathname.startsWith('/(auth)'));
  const showNav = isAuthenticated && !isLoginScreen && !isLoading;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.lavender} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
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
      </View>
      {showNav && <BottomNav />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
