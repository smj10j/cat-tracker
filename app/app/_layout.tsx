import '../global.css';
import { useEffect } from 'react';
import { View, ActivityIndicator, Dimensions } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as Notifications from 'expo-notifications';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { useThemeColors } from '../hooks/useThemeColors';
import BottomNav from '../components/BottomNav';

// Lock phones to portrait; iPads get all orientations.
// FullScreenChartModal unlocks phones temporarily when open.
const { width, height } = Dimensions.get('screen');
const isTablet = Math.min(width, height) >= 768;
if (!isTablet) {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
}

// Configure foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

// Screens that should NOT show the bottom nav
const HIDE_NAV_ROUTES = ['/(auth)/login', '/login'];

/** Listens for notification taps and deep-links to the cat's Care tab. */
function NotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { catId?: string } | undefined;
      if (data?.catId) {
        router.push(`/cats/${data.catId}?tab=care` as never);
      }
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}

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
      {isAuthenticated && <NotificationHandler />}
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
      <PreferencesProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <AppContent />
      </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
