import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api, setAuthToken } from '../lib/api';

WebBrowser.maybeCompleteAuthSession();

interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  oauth_provider: string;
  timezone: string | null;
  email_reminders?: number;
  hasOrphanedCats: boolean;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'cat-tracker-session';
const API_BASE = 'https://cat-tracker.pages.dev';

async function getStoredSession(): Promise<string | null> {
  if (Platform.OS === 'web') return null; // Web uses cookies
  try {
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}

async function storeSession(token: string): Promise<void> {
  if (Platform.OS === 'web') return; // Web uses cookies
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

/** Request notification permission and register the Expo push token with the backend. */
async function registerPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 'c62ccdf4-92f5-45fc-80e6-4cf56be6607b';
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;

  try {
    await api.registerDeviceToken(token, Platform.OS);
  } catch (e) {
    console.error('Failed to register push token:', e);
  }

  return token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pushTokenRef = useRef<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);

      // Sync device timezone to backend (fire-and-forget)
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedTz && detectedTz !== me.timezone) {
        api.updateMe({ timezone: detectedTz }).catch(() => { /* non-fatal */ });
      }
    } catch {
      setUser(null);
      await clearSession();
      setAuthToken(null);
    }
  }, []);

  // On mount: check for stored session (native) or cookie (web)
  useEffect(() => {
    (async () => {
      const storedSession = await getStoredSession();
      if (storedSession) {
        setAuthToken(storedSession);
      }
      await fetchUser();
      setIsLoading(false);
    })();
  }, [fetchUser]);

  // Register push notifications when user becomes authenticated
  useEffect(() => {
    if (user && Platform.OS !== 'web') {
      registerPushNotifications().then((token) => {
        pushTokenRef.current = token;
      }).catch(() => { /* non-fatal */ });
    }
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Web: redirect to Worker auth endpoint
      window.location.href = `${API_BASE}/api/auth/login?provider=google`;
      return;
    }

    // Native: use expo-auth-session
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'whiskerhealth' });
    const authUrl = `${API_BASE}/api/auth/login?provider=google&mode=native&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const sessionId = url.searchParams.get('session');
      if (sessionId) {
        await storeSession(sessionId);
        setAuthToken(sessionId);
        await fetchUser();
        router.replace('/');
      }
    }
  }, [fetchUser]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS === 'ios') {
      // Native iOS: use expo-apple-authentication for the native Sign in with Apple sheet
      try {
        const AppleAuthentication = require('expo-apple-authentication');
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        if (!credential.identityToken) {
          console.error('Apple Sign In: no identity token received');
          return;
        }

        // Send the identity token to our Worker for verification and session creation
        const res = await fetch(`${API_BASE}/api/auth/apple-native`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identityToken: credential.identityToken,
            fullName: credential.fullName,
          }),
        });

        if (res.ok) {
          const data = await res.json() as { sessionId: string };
          await storeSession(data.sessionId);
          setAuthToken(data.sessionId);
          await fetchUser();
          router.replace('/');
        } else {
          const err = await res.text().catch(() => '');
          console.error('Apple Sign In failed:', res.status, err);
        }
      } catch (e) {
        // Error code 1001 = user cancelled — not an error
        const code = (e as { code?: string })?.code;
        if (code !== 'ERR_REQUEST_CANCELED' && code !== '1001') {
          console.error('Apple Sign In error:', e);
        }
      }
      return;
    }

    // Web: redirect to Worker auth endpoint
    if (Platform.OS === 'web') {
      window.location.href = `${API_BASE}/api/auth/login?provider=apple`;
    }
  }, [fetchUser]);

  const signOut = useCallback(async () => {
    // Unregister push token before logging out
    if (pushTokenRef.current) {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/device-token`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(Platform.OS !== 'web' ? { 'Authorization': `Bearer ${await getStoredSession()}` } : {}),
          },
          body: JSON.stringify({ token: pushTokenRef.current }),
        });
        if (!resp.ok) console.error('Failed to unregister push token');
      } catch { /* ignore */ }
      pushTokenRef.current = null;
    }

    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    await clearSession();
    setAuthToken(null);
    setUser(null);
    router.replace('/(auth)/login');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signInWithGoogle,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
