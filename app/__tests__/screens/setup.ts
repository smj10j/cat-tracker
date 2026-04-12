/**
 * Test setup for React Native screen smoke tests.
 *
 * Strategy: mock react-native components as DOM elements so we can render
 * screens with @testing-library/react in a jsdom environment. This catches
 * JavaScript-level crashes (null refs, bad imports, render errors) without
 * needing a native runtime.
 */
import { vi } from 'vitest';
import React from 'react';

// ---------------------------------------------------------------------------
// Helper: create a mock React component that renders a DOM element
// ---------------------------------------------------------------------------
function mockComponent(name: string) {
  return React.forwardRef(({ children, testID, ...props }: any, ref: any) => {
    return React.createElement(
      'div',
      { 'data-testid': testID, 'data-component': name, ref, ...filterDomProps(props) },
      children,
    );
  });
}

function mockTextComponent(name: string) {
  return React.forwardRef(({ children, testID, ...props }: any, ref: any) => {
    return React.createElement(
      'span',
      { 'data-testid': testID, 'data-component': name, ref, ...filterDomProps(props) },
      children,
    );
  });
}

// Strip RN-specific props that would cause DOM warnings
function filterDomProps(props: Record<string, any>) {
  const domSafe: Record<string, any> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'function' && k.startsWith('on')) {
      domSafe[k.toLowerCase()] = v;
    } else if (['className', 'style', 'id', 'role', 'title'].includes(k)) {
      domSafe[k] = v;
    }
    // Drop everything else (RN-specific props like numberOfLines, etc.)
  }
  return domSafe;
}

// ---------------------------------------------------------------------------
// Mock: react-native
// ---------------------------------------------------------------------------
vi.mock('react-native', () => {
  return {
    View: mockComponent('View'),
    Text: mockTextComponent('Text'),
    ScrollView: mockComponent('ScrollView'),
    FlatList: React.forwardRef(({ data, renderItem, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, testID, ...props }: any, ref: any) => {
      const header = ListHeaderComponent ? (typeof ListHeaderComponent === 'function' ? React.createElement(ListHeaderComponent) : ListHeaderComponent) : null;
      const footer = ListFooterComponent ? (typeof ListFooterComponent === 'function' ? React.createElement(ListFooterComponent) : ListFooterComponent) : null;
      const empty = (!data || data.length === 0) && ListEmptyComponent
        ? (typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent) : ListEmptyComponent)
        : null;
      return React.createElement('div', { 'data-testid': testID, 'data-component': 'FlatList', ref },
        header,
        empty || (data ?? []).map((item: any, index: number) => renderItem?.({ item, index })),
        footer,
      );
    }),
    Pressable: React.forwardRef(({ children, testID, onPress, ...props }: any, ref: any) => {
      return React.createElement('button', { 'data-testid': testID, 'data-component': 'Pressable', onClick: onPress, ref },
        typeof children === 'function' ? children({ pressed: false }) : children,
      );
    }),
    Image: mockComponent('Image'),
    TextInput: React.forwardRef(({ testID, ...props }: any, ref: any) => {
      return React.createElement('input', { 'data-testid': testID, 'data-component': 'TextInput', ref });
    }),
    Modal: ({ children, visible, testID }: any) => {
      if (!visible) return null;
      return React.createElement('div', { 'data-testid': testID, 'data-component': 'Modal' }, children);
    },
    Alert: { alert: vi.fn() },
    Platform: { OS: 'ios', select: (obj: any) => obj.ios ?? obj.default },
    StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
    Dimensions: {
      get: () => ({ width: 393, height: 852 }),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Linking: { openURL: vi.fn() },
    Keyboard: { dismiss: vi.fn(), addListener: vi.fn(() => ({ remove: vi.fn() })) },
    KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
    RefreshControl: mockComponent('RefreshControl'),
    ActivityIndicator: mockComponent('ActivityIndicator'),
    Animated: {
      View: mockComponent('Animated.View'),
      Text: mockTextComponent('Animated.Text'),
      Value: vi.fn(() => ({ interpolate: vi.fn() })),
      timing: vi.fn(() => ({ start: vi.fn() })),
      spring: vi.fn(() => ({ start: vi.fn() })),
      parallel: vi.fn(() => ({ start: vi.fn() })),
    },
    PanResponder: {
      create: () => ({ panHandlers: {} }),
    },
    SectionList: React.forwardRef(({ sections, renderItem, renderSectionHeader, ListHeaderComponent, ListEmptyComponent, testID, ...props }: any, ref: any) => {
      const header = ListHeaderComponent ? (typeof ListHeaderComponent === 'function' ? React.createElement(ListHeaderComponent) : ListHeaderComponent) : null;
      const empty = (!sections || sections.length === 0 || sections.every((s: any) => s.data.length === 0))
        && ListEmptyComponent ? (typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent) : ListEmptyComponent) : null;
      return React.createElement('div', { 'data-testid': testID, 'data-component': 'SectionList', ref },
        header,
        empty || (sections ?? []).map((section: any, si: number) =>
          React.createElement('div', { key: si },
            renderSectionHeader?.({ section }),
            section.data.map((item: any, ii: number) => renderItem?.({ item, index: ii, section })),
          ),
        ),
      );
    }),
    Share: { share: vi.fn().mockResolvedValue({ action: 'sharedAction' }) },
    PixelRatio: { get: () => 2, getFontScale: () => 1, getPixelSizeForLayoutSize: (n: number) => n * 2, roundToNearestPixel: (n: number) => n },
    useWindowDimensions: () => ({ width: 393, height: 852 }),
  };
});

// ---------------------------------------------------------------------------
// Mock: react-native-safe-area-context
// ---------------------------------------------------------------------------
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: mockComponent('SafeAreaView'),
  SafeAreaProvider: ({ children }: any) => React.createElement('div', null, children),
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

// ---------------------------------------------------------------------------
// Mock: react-native-svg (used by LineChart)
// ---------------------------------------------------------------------------
vi.mock('react-native-svg', () => {
  const c = mockComponent;
  return {
    __esModule: true,
    default: c('Svg'),
    Svg: c('Svg'),
    Path: c('Path'),
    Circle: c('Circle'),
    Line: c('Line'),
    Text: mockTextComponent('SvgText'),
    Defs: c('Defs'),
    LinearGradient: c('LinearGradient'),
    Stop: c('Stop'),
    G: c('G'),
    Rect: c('Rect'),
    ClipPath: c('ClipPath'),
  };
});

// ---------------------------------------------------------------------------
// Mock: react-native-reanimated
// ---------------------------------------------------------------------------
vi.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (comp: any) => comp,
    View: mockComponent('Reanimated.View'),
  },
  useSharedValue: (init: any) => ({ value: init }),
  useAnimatedStyle: (fn: any) => fn(),
  withTiming: (val: any) => val,
  withSpring: (val: any) => val,
  FadeIn: { duration: () => ({}) },
  FadeOut: { duration: () => ({}) },
}));

// ---------------------------------------------------------------------------
// Mock: expo-router
// ---------------------------------------------------------------------------
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
};

vi.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: 'test-cat-123' }),
  useFocusEffect: (cb: any) => {
    // Stable mock: always calls useEffect (matches the real hook's internal structure).
    // Empty deps = run once on mount. This is sufficient for smoke testing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, []);
  },
  Link: ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children),
  router: mockRouter,
}));

// ---------------------------------------------------------------------------
// Mock: expo-secure-store
// ---------------------------------------------------------------------------
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock: expo-image-picker
// ---------------------------------------------------------------------------
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn().mockResolvedValue({ canceled: true, assets: null }),
  MediaTypeOptions: { Images: 'Images' },
}));

// ---------------------------------------------------------------------------
// Mock: expo-apple-authentication
// ---------------------------------------------------------------------------
vi.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: mockComponent('AppleAuthButton'),
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1 },
  signInAsync: vi.fn(),
  AppleAuthenticationScope: { EMAIL: 0, FULL_NAME: 1 },
}));

// ---------------------------------------------------------------------------
// Mock: expo-auth-session
// ---------------------------------------------------------------------------
vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'https://test.redirect.uri'),
  useAuthRequest: vi.fn(() => [null, null, vi.fn()]),
}));

// ---------------------------------------------------------------------------
// Mock: expo-web-browser
// ---------------------------------------------------------------------------
vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn().mockResolvedValue({ type: 'cancel' }),
}));

// ---------------------------------------------------------------------------
// Mock: expo-file-system/next
// ---------------------------------------------------------------------------
vi.mock('expo-file-system/next', () => ({
  File: vi.fn(),
  Paths: { cache: { uri: '/tmp/cache' } },
}));

// ---------------------------------------------------------------------------
// Mock: expo-sharing
// ---------------------------------------------------------------------------
vi.mock('expo-sharing', () => ({
  shareAsync: vi.fn(),
  isAvailableAsync: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Mock: expo-status-bar
// ---------------------------------------------------------------------------
vi.mock('expo-status-bar', () => ({
  StatusBar: mockComponent('StatusBar'),
}));

// ---------------------------------------------------------------------------
// Mock: expo-notifications
// ---------------------------------------------------------------------------
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'undetermined' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: vi.fn().mockResolvedValue({ data: 'test-token' }),
  setNotificationHandler: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: @react-native-community/datetimepicker
// ---------------------------------------------------------------------------
vi.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: mockComponent('DateTimePicker'),
}));

// ---------------------------------------------------------------------------
// Mock: NativeWind global CSS (no-op)
// ---------------------------------------------------------------------------
vi.mock('../../global.css', () => ({}));
vi.mock('../global.css', () => ({}));

// ---------------------------------------------------------------------------
// Mock: nativewind
// ---------------------------------------------------------------------------
vi.mock('nativewind', () => ({
  useColorScheme: () => ({
    colorScheme: 'dark',
    setColorScheme: vi.fn(),
    toggleColorScheme: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock: @react-native-async-storage/async-storage
// ---------------------------------------------------------------------------
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve('dark')),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

// ---------------------------------------------------------------------------
// Mock: AuthContext
// ---------------------------------------------------------------------------
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  display_name: 'Test User',
  avatar_url: null,
  oauth_provider: 'google',
  hasOrphanedCats: false,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
    signInWithGoogle: vi.fn(),
    signInWithApple: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => React.createElement('div', null, children),
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: any) => React.createElement('div', null, children),
}));

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: any) => React.createElement('div', null, children),
}));

// Also mock the relative path used by deeper screens
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
    signInWithGoogle: vi.fn(),
    signInWithApple: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => React.createElement('div', null, children),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
export const fixtures = {
  cat: {
    id: 'test-cat-123',
    name: 'Luna',
    birthdate: '2022-03-15',
    breed: 'Domestic Shorthair',
    coloring: 'Tabby',
    sex: 'Female',
    microchip_id: 'chip-123',
    is_neutered: 1,
    notes: 'Friendly and playful',
    photo_url: null,
    emoji: '🐱',
    user_id: 'user-1',
    household_id: 'household-1',
    deceased_at: null,
    memorial_note: null,
    created_at: '2024-01-01T00:00:00Z',
  } as any,

  measurements: [
    { id: 'm1', cat_id: 'test-cat-123', type: 'weight', value: 9.4, unit: 'lbs', measured_at: '2026-04-01T12:00:00Z', notes: null, created_at: '2026-04-01T12:00:00Z' },
    { id: 'm2', cat_id: 'test-cat-123', type: 'weight', value: 9.6, unit: 'lbs', measured_at: '2026-03-15T12:00:00Z', notes: null, created_at: '2026-03-15T12:00:00Z' },
    { id: 'm3', cat_id: 'test-cat-123', type: 'weight', value: 9.8, unit: 'lbs', measured_at: '2026-03-01T12:00:00Z', notes: null, created_at: '2026-03-01T12:00:00Z' },
    { id: 'm4', cat_id: 'test-cat-123', type: 'food', value: 2, unit: 'scale', measured_at: '2026-04-01T12:00:00Z', notes: null, created_at: '2026-04-01T12:00:00Z' },
  ] as any[],

  medications: [
    {
      id: 'med1', cat_id: 'test-cat-123', name: 'Flea Prevention',
      type: 'flea', frequency: 'monthly', dosage: '1 pipette',
      start_date: '2026-01-01', end_date: null, notes: null,
      is_active: 1, next_due_at: '2026-05-01 09:00',
      created_at: '2026-01-01T00:00:00Z',
    },
  ] as any[],

  cats: [] as any[], // populated in init
  user: mockUser,
};

fixtures.cats = [fixtures.cat];

// ---------------------------------------------------------------------------
// Mock: API client
// ---------------------------------------------------------------------------
vi.mock('../../lib/api', () => ({
  api: {
    getCats: vi.fn().mockResolvedValue(fixtures.cats),
    getCat: vi.fn().mockResolvedValue(fixtures.cat),
    getMeasurements: vi.fn().mockResolvedValue(fixtures.measurements),
    getMedications: vi.fn().mockResolvedValue(fixtures.medications),
    getNotificationInbox: vi.fn().mockResolvedValue({ overdue: [], dueToday: [], upcoming: [], refillSoon: [] }),
    deleteMeasurement: vi.fn().mockResolvedValue(undefined),
    createMeasurement: vi.fn().mockResolvedValue({ id: 'new-m' }),
    updateCat: vi.fn().mockResolvedValue(fixtures.cat),
    createCat: vi.fn().mockResolvedValue(fixtures.cat),
    deleteCat: vi.fn().mockResolvedValue(undefined),
    getMe: vi.fn().mockResolvedValue(fixtures.user),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getHousehold: vi.fn().mockResolvedValue({ household: { id: 'h1', name: 'Test Household', owner_user_id: 'user-1', created_at: '2026-01-01' }, members: [{ user_id: 'user-1', display_name: 'Test User', email: 'test@example.com', role: 'admin', avatar_url: null }], pendingInvites: [], myRole: 'admin', isOwner: true }),
    getNotifications: vi.fn().mockResolvedValue({ overdue: [], due_today: [], upcoming: [], refill_alerts: [] }),
    logDose: vi.fn().mockResolvedValue(undefined),
    renameHousehold: vi.fn().mockResolvedValue(undefined),
    sendInvite: vi.fn().mockResolvedValue(undefined),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    changeMemberRole: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
    exportData: vi.fn().mockResolvedValue('csv-data'),
    setAuthToken: vi.fn(),
  },
  CARE_TYPE_ICONS: {
    flea: '🪳', vaccine: '💉', medication: '💊', supplement: '🧴',
    dental: '🦷', exam: '🩺', bloodwork: '🧪', surgery: '🔪', other: '📋',
  },
}));

// Also mock the deeper relative path
vi.mock('../../../lib/api', () => ({
  api: {
    getCats: vi.fn().mockResolvedValue(fixtures.cats),
    getCat: vi.fn().mockResolvedValue(fixtures.cat),
    getMeasurements: vi.fn().mockResolvedValue(fixtures.measurements),
    getMedications: vi.fn().mockResolvedValue(fixtures.medications),
    getNotificationInbox: vi.fn().mockResolvedValue({ overdue: [], dueToday: [], upcoming: [], refillSoon: [] }),
    getNotifications: vi.fn().mockResolvedValue({ overdue: [], due_today: [], upcoming: [], refill_alerts: [] }),
    logDose: vi.fn().mockResolvedValue(undefined),
    deleteMeasurement: vi.fn().mockResolvedValue(undefined),
    createMeasurement: vi.fn().mockResolvedValue({ id: 'new-m' }),
    updateCat: vi.fn().mockResolvedValue(fixtures.cat),
    createCat: vi.fn().mockResolvedValue(fixtures.cat),
    deleteCat: vi.fn().mockResolvedValue(undefined),
    getMe: vi.fn().mockResolvedValue(fixtures.user),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getHousehold: vi.fn().mockResolvedValue({ household: { id: 'h1', name: 'Test Household', owner_user_id: 'user-1', created_at: '2026-01-01' }, members: [{ user_id: 'user-1', display_name: 'Test User', email: 'test@example.com', role: 'admin', avatar_url: null }], pendingInvites: [], myRole: 'admin', isOwner: true }),
    renameHousehold: vi.fn().mockResolvedValue(undefined),
    sendInvite: vi.fn().mockResolvedValue(undefined),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    changeMemberRole: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
    exportData: vi.fn().mockResolvedValue('csv-data'),
    setAuthToken: vi.fn(),
  },
  CARE_TYPE_ICONS: {
    flea: '🪳', vaccine: '💉', medication: '💊', supplement: '🧴',
    dental: '🦷', exam: '🩺', bloodwork: '🧪', surgery: '🔪', other: '📋',
  },
}));

// Re-export mockRouter for test assertions
export { mockRouter };
