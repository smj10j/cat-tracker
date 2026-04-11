import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { api, setAuthToken } from '../lib/api';

WebBrowser.maybeCompleteAuthSession();

interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  oauth_provider: string;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
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

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Web: redirect to Worker auth endpoint
      window.location.href = `${API_BASE}/api/auth/login?provider=google`;
      return;
    }

    // Native: use expo-auth-session
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'cattracker' });
    const authUrl = `${API_BASE}/api/auth/login?provider=google&mode=native&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const sessionId = url.searchParams.get('session');
      if (sessionId) {
        await storeSession(sessionId);
        setAuthToken(sessionId);
        await fetchUser();
      }
    }
  }, [fetchUser]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS === 'ios') {
      // Native iOS: use expo-apple-authentication
      try {
        const AppleAuthentication = require('expo-apple-authentication');
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        // Send the identity token to our Worker for verification
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
        }
      } catch {
        // User cancelled or error
      }
      return;
    }

    // Web: redirect to Worker auth endpoint
    if (Platform.OS === 'web') {
      window.location.href = `${API_BASE}/api/auth/login?provider=apple`;
    }
  }, [fetchUser]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    await clearSession();
    setAuthToken(null);
    setUser(null);
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
