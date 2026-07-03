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
import { api } from '../lib/api';

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

// WP4g: actionable lock-screen categories. `care_dose` is a single-dose
// reminder; `care_dose_group` covers multiple doses due the same hour. The
// cron sets the matching categoryId; the button identifiers are shared so the
// response handler treats both the same way.
const MARK_GIVEN_ACTION = 'MARK_GIVEN';
const SNOOZE_1H_ACTION = 'SNOOZE_1H';
Notifications.setNotificationCategoryAsync('care_dose', [
  { identifier: MARK_GIVEN_ACTION, buttonTitle: 'Mark given', options: { opensAppToForeground: false } },
  { identifier: SNOOZE_1H_ACTION, buttonTitle: 'Snooze 1h', options: { opensAppToForeground: false } },
]).catch(() => {});
Notifications.setNotificationCategoryAsync('care_dose_group', [
  { identifier: MARK_GIVEN_ACTION, buttonTitle: 'Mark all given', options: { opensAppToForeground: false } },
  { identifier: SNOOZE_1H_ACTION, buttonTitle: 'Snooze 1h', options: { opensAppToForeground: false } },
]).catch(() => {});

function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

// Screens that should NOT show the bottom nav
const HIDE_NAV_ROUTES = ['/(auth)/login', '/login'];

/** Fallback shown when a background "Mark given" couldn't reach the server. */
async function fireActionFailureNotice() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Couldn't update the care item",
        body: 'Tap to open Whisker Health and mark it given.',
        data: { url: '/notifications' },
      },
      trigger: null,
    });
  } catch {
    // best effort
  }
}

/**
 * Processes a notification response. An action-button tap ("Mark given" /
 * "Snooze 1h") runs in the background against the server without opening the
 * app; a plain body tap falls through to deep-link navigation. Returns true
 * when the response was consumed as a background action.
 */
async function processDoseResponse(response: Notifications.NotificationResponse): Promise<boolean> {
  const data = response.notification.request.content.data as { catId?: string; doseIds?: unknown } | undefined;
  const doseIds = Array.isArray(data?.doseIds)
    ? (data!.doseIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  if (response.actionIdentifier === MARK_GIVEN_ACTION && doseIds.length > 0) {
    try {
      // administer is idempotent, so a grouped "Mark all given" and any
      // double-tap are safe.
      await Promise.all(doseIds.map((id) => api.administerDose(id)));
    } catch {
      await fireActionFailureNotice();
    }
    return true;
  }

  if (response.actionIdentifier === SNOOZE_1H_ACTION && doseIds.length > 0) {
    try {
      await Promise.all(doseIds.map((id) => api.snoozeDose(id, 60)));
    } catch {
      // Graceful degradation: server unreachable — still nudge again locally in ~1h.
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Care reminder', body: 'A snoozed item is due again.', data: data ?? {} },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 3600,
            repeats: false,
          },
        });
      } catch {
        // best effort
      }
    }
    return true;
  }

  return false;
}

/** Listens for notification taps/actions: acts in the background or deep-links. */
function NotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    // Listener only (not getLastNotificationResponseAsync, which returns stale
    // responses on every cold start and would re-run old actions).
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      processDoseResponse(response).then((handled) => {
        if (handled) return;
        const data = response.notification.request.content.data as { catId?: string } | undefined;
        if (data?.catId) router.push(`/cats/${data.catId}?tab=care` as never);
        else router.push('/notifications' as never);
      });
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
          <Stack.Screen name="cats/[id]/sitter" />
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
