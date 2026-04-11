# Cat Tracker — Cross-Platform Architecture TDD

> **Status: Implemented — iOS app in TestFlight.**
> The Expo/React Native app lives in `app/`. It shares business logic with the web frontend (`frontend/`).
> The Worker API and D1 schema described in [web.md](web.md) remain authoritative for all platforms.
> Product requirements: [PRD-ios-app-store.md](../PRDs/PRD-ios-app-store.md). App name: **Whisker Health** (Bundle ID: `me.01j.whisker`).

---

## Goals

1. Ship Cat Tracker to the iOS App Store and Google Play Store
2. Serve the web version from the same codebase, not a separate project
3. Maximize shared code — business logic, API client, types, and most UI
4. Keep the Cloudflare Worker unchanged as the backend for all platforms

---

## Framework Decision

### Options evaluated

**Option A — Capacitor (wrap existing Vite/React app)**
Wraps the current SPA in a native WebView shell. Near-zero migration cost.

| Pros | Cons |
|---|---|
| Minimal changes to existing code | WebView is not truly native; perceptible on scroll/animation |
| Auth cookies work as-is | App store reviewers increasingly reject pure-WebView apps |
| Recharts, Tailwind, React Router unchanged | Camera, push, and file access need Capacitor plugins |
| Fastest to ship | Performance ceiling for charts and gestures |

Verdict: viable shortcut, but accrues significant UX debt. Not recommended.

**Option B — Flutter**
Full rewrite in Dart.

| Pros | Cons |
|---|---|
| Best native UI fidelity | Zero code reuse from existing frontend |
| Excellent performance | Dart — complete context switch |
| Strong iOS/Android parity | Longest time to feature parity |

Verdict: best long-term native quality, but the rewrite cost is too high given the existing TypeScript investment.

**Option C — Expo (React Native) with Expo Router**
React Native UI layer; shared TypeScript business logic; Expo Router targets iOS, Android, and web from a single file tree.

| Pros | Cons |
|---|---|
| ~80% of `lib/` code is pure TS — zero changes needed | UI components must be rewritten (RN primitives, not HTML) |
| Expo Router web target replaces the Vite SPA entirely | Recharts is DOM-only; needs replacement chart library |
| Auth redesign is scoped (middleware only) | httpOnly cookies don't work in native; bearer token path needed |
| EAS Build compiles iOS/Android in cloud — no local Xcode/Android Studio required | |
| NativeWind carries Tailwind syntax into React Native | |

Verdict: **recommended**. Best balance of code reuse, native quality, and implementation speed.

### Decision: Expo SDK 52+ + Expo Router v4 + NativeWind v4

> **Version note:** Pin to the latest stable Expo SDK at time of project init (`npx create-expo-app@latest`). SDK 52 was current when this TDD was written; use whatever is stable at implementation time. The architecture decisions below are SDK-version-independent.

- **Expo Router v4** — file-based routing (same mental model as current React Router); ships web support that generates a static site deployable to Cloudflare Pages
- **NativeWind v4** — Tailwind utility classes in React Native via `className` prop; design tokens from the existing `tailwind.config.ts` carry over directly
- **Victory Native XL** — Skia-based chart library; replaces Recharts; same data shapes. **Risk:** Skia WASM adds to web bundle size — measure in Phase 3 and evaluate a platform split (Victory on native, Recharts on web via `.web.tsx` / `.native.tsx` files) if the increase exceeds 500 KB
- **EAS Build + EAS Submit** — cloud compilation and App Store / Play Store submission without local native toolchains
- **EAS Update** — over-the-air JS bundle updates for post-release fixes without App Store review (see OTA Updates section)

---

## Repository Structure After Migration

The `frontend/` directory is retired. An `app/` directory (the Expo project) takes its place.
`worker/` is untouched.

```
cat-tracker/
├── worker/               # Cloudflare Worker — UNCHANGED
│   └── src/
│       ├── index.ts
│       ├── middleware/auth.ts   # gains Bearer token support (see Auth section)
│       ├── routes/
│       │   ├── auth.ts          # gains ?mode=native path (see Auth section)
│       │   ├── cats.ts
│       │   ├── measurements.ts
│       │   ├── medications.ts
│       │   ├── household.ts
│       │   └── import.ts
│       └── db/schema.sql        # gains device_tokens table (see Push Notifications)
│
├── app/                  # Expo project — replaces frontend/
│   ├── app/              # Expo Router file-based routes
│   │   ├── _layout.tsx              # Root layout: auth gate, navigation shell
│   │   ├── (auth)/
│   │   │   └── login.tsx            # Google sign-in (platform-specific impl)
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx          # Tab bar: Cats | Log | Compare
│   │   │   ├── index.tsx            # Home screen
│   │   │   └── compare.tsx          # CompareChart
│   │   ├── cats/
│   │   │   ├── new.tsx              # AddEditCat (new)
│   │   │   └── [id]/
│   │   │       ├── index.tsx        # CatProfile
│   │   │       ├── edit.tsx         # AddEditCat (edit)
│   │   │       ├── health.tsx       # CatHealthGuidance
│   │   │       ├── export.tsx       # CatExportPage
│   │   │       ├── medications/
│   │   │       │   └── new.tsx      # MedicationFormPage (new)
│   │   │       └── medications/
│   │   │           └── [medId]/edit.tsx
│   │   ├── household.tsx
│   │   ├── notifications.tsx
│   │   ├── invite.tsx
│   │   ├── import.tsx
│   │   └── wellness.tsx
│   │
│   ├── components/        # React Native component ports of frontend/src/components/
│   │   ├── WeightChart.tsx          # Victory Native XL line chart
│   │   ├── MeasurementChart.tsx     # Victory Native XL scale chart
│   │   ├── CorrelationChart.tsx     # Victory Native XL dual-line
│   │   ├── InsightsPanel.tsx        # Pure logic port — trivial
│   │   ├── QuickAdd.tsx             # @gorhom/bottom-sheet
│   │   ├── CatAvatar.tsx            # expo-image + emoji fallback
│   │   ├── CropModal.tsx            # expo-image-manipulator (replaces Canvas)
│   │   └── MeasurementForm.tsx
│   │
│   ├── lib/               # Direct copy from frontend/src/lib/ — zero changes
│   │   ├── api.ts                   # URL config updated; Bearer token injected
│   │   ├── correlations.ts          # Unchanged
│   │   ├── healthMetrics.ts         # Unchanged
│   │   └── measurementPresets.ts   # Unchanged
│   │
│   ├── functions/          # Cloudflare Pages Functions (web target only)
│   │   └── api/[[path]].ts          # Same proxy as frontend/functions/api/[[path]].ts
│   │
│   ├── hooks/
│   │   └── useAuth.ts               # Session token from expo-secure-store; web falls back to cookie
│   │
│   ├── app.json            # Expo config: bundle IDs, icons, splash, permissions
│   ├── eas.json            # EAS Build profiles (development, preview, production)
│   ├── tailwind.config.ts  # Copied from frontend/; same brand-* tokens
│   ├── metro.config.js     # NativeWind requires Metro config
│   ├── babel.config.js     # NativeWind Babel preset
│   ├── tsconfig.json
│   └── package.json
│
├── docs/
│   ├── TDD/
│   │   ├── README.md
│   │   ├── web.md
│   │   └── cross-platform.md  (this file)
│   ├── PRDs/
│   ├── API.md
│   ├── DESIGN.md
│   └── SECURITY.md
├── CLAUDE.md
├── TODO.md
└── .gitignore
```

---

## Shared Code Strategy

### What is shared without modification

| File | Why it's portable |
|---|---|
| `lib/correlations.ts` | Pure TypeScript math — no DOM, no RN, no I/O |
| `lib/healthMetrics.ts` | Pure TypeScript — thresholds, status logic |
| `lib/measurementPresets.ts` | Pure TypeScript — label/value maps |
| All TypeScript types | Interfaces, enums, API response shapes |
| `worker/` (entire) | The backend is platform-agnostic by design |

### What is shared with minor adaptation

| File | Change |
|---|---|
| `lib/api.ts` | Base URL: env var instead of hardcoded; Bearer token injected from `useAuth` hook instead of relying on cookies |

### What uses Expo's platform file extension system

Expo Router resolves files in this priority order:
`.native.tsx` → `.ios.tsx` / `.android.tsx` → `.tsx`

Components or screens with meaningful platform differences get split files:

| Shared file | `.native.tsx` variant | `.web.tsx` variant |
|---|---|---|
| `(auth)/login.tsx` | `expo-auth-session` OAuth | Redirect to `/api/auth/login` (browser flow) |
| `CropModal.tsx` | `expo-image-manipulator` | Canvas API (existing implementation) |
| `cats/[id]/export.tsx` | `expo-print` + share sheet | `window.print()` (existing) |
| `import.tsx` | `expo-document-picker` | `<input type="file">` (existing) |
| `QuickAdd.tsx` | `@gorhom/bottom-sheet` | CSS bottom sheet (existing) |
| `CatAvatar.tsx` (camera button) | `expo-image-picker` | `<input type="file" accept="image/*">` |

Files without a `.native.tsx` or `.web.tsx` sibling render on both platforms using React Native primitives (which Expo Router maps to DOM equivalents on web via `react-native-web`).

### Component porting pattern

Every `<div>` → `<View>`, `<p>` / `<span>` → `<Text>`, `<button>` → `<Pressable>`, `<img>` → `<Image>` (expo-image). Class names carry over via NativeWind's `className` prop. State, hooks, and event handlers are unchanged.

Before (web):
```tsx
<div className="flex flex-col gap-2 p-4 bg-zinc-900 rounded-xl">
  <p className="text-white font-semibold">{cat.name}</p>
  <button className="bg-brand-500 text-white px-4 py-2 rounded-lg" onPress={onPress}>
    Log measurement
  </button>
</div>
```

After (cross-platform with NativeWind):
```tsx
<View className="flex flex-col gap-2 p-4 bg-zinc-900 rounded-xl">
  <Text className="text-white font-semibold">{cat.name}</Text>
  <Pressable className="bg-brand-500 px-4 py-2 rounded-lg" onPress={onPress}>
    <Text className="text-white">Log measurement</Text>
  </Pressable>
</View>
```

---

## Authentication

This is the most structurally significant change. httpOnly session cookies are a browser primitive; native apps use bearer tokens.

### Dual-path auth in the Worker

The Worker gains Bearer token support alongside existing cookie support. **No schema changes needed** — the `sessions` table is unchanged.

#### `worker/src/middleware/auth.ts` change

```typescript
// Current: reads only from Cookie header
const sessionId = getCookie(c, 'session');

// After: also checks Authorization header (native clients)
const authHeader = c.req.header('Authorization');
const bearerToken = authHeader?.startsWith('Bearer ')
  ? authHeader.slice(7)
  : undefined;
const sessionId = getCookie(c, 'session') ?? bearerToken;
```

Cookie-based auth continues to work unchanged for web. Native clients send `Authorization: Bearer <sessionId>`.

#### `worker/src/routes/auth.ts` change

`GET /api/auth/callback` gains a `?mode=native` query parameter. When present, instead of setting a cookie and redirecting to `/`, the Worker returns JSON:

```typescript
if (c.req.query('mode') === 'native') {
  return c.json({ sessionId: session.id, userId: user.id });
}
// existing: Set-Cookie + 302 redirect
```

The native OAuth flow (via `expo-auth-session`) passes `mode=native` and reads `sessionId` from the response body.

### Native auth flow (step by step)

1. App calls `useAuthRequest()` from `expo-auth-session` with the Google OAuth config
2. User taps "Continue with Google"; `expo-auth-session` opens a secure in-app browser (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android)
3. The browser navigates to `GET /api/auth/login?mode=native` (Worker stores state in D1 as usual, then redirects to Google with `redirect_uri` pointing to the app's custom scheme: `me.01j.cattracker:/oauth`)
4. Google redirects to `me.01j.cattracker:/oauth?code=...&state=...`; the OS hands control back to the app
5. `expo-auth-session` receives the code; app calls `GET /api/auth/callback?code=...&state=...&mode=native`
6. Worker validates state, exchanges code, upserts user, creates session, returns `{ sessionId, userId }`
7. App stores `sessionId` in `expo-secure-store` (encrypted native keychain/keystore)
8. `useAuth` hook reads from `expo-secure-store`; all API calls in `lib/api.ts` inject `Authorization: Bearer <sessionId>`

### Google Cloud Console change required

A new OAuth 2.0 Client ID (type: iOS or Android) must be created in Google Cloud Console with the custom scheme redirect URI:
- iOS: `me.01j.cattracker:/oauth`
- Android: `me.01j.cattracker:/oauth`

The existing web client ID (`cat-tracker.pages.dev/api/auth/callback`) is unchanged and continues to serve the web target.

### Sign in with Apple (required for App Store)

Apple Review Guideline 4.8 requires apps offering any social login (Google) to also offer Sign in with Apple. This is **not optional** — submission will be rejected without it.

Apple OAuth differs significantly from Google OAuth:
- **Callback is `POST` with `application/x-www-form-urlencoded` body**, not a `GET` with query params
- **Apple returns a JWT `id_token` directly** — no token exchange step. Verify against Apple's JWKS (`https://appleid.apple.com/auth/keys`)
- **User's name is delivered only on the first authorization** — the Worker must persist `display_name` on first callback; subsequent logins only provide the `sub` (user ID) and email
- **"Hide My Email"** generates a `@privaterelay.appleid.com` address — household invites via Resend must work with these relay addresses (Resend supports them, but test explicitly)

Worker changes:
1. Register a Service ID in Apple Developer portal (Certificates, Identifiers & Profiles)
2. Generate a client secret (ES256 JWT signed with Apple's private key, rotated every 6 months)
3. `GET /api/auth/login?provider=apple` → redirect to `appleid.apple.com/auth/authorize`
4. `POST /api/auth/callback` handler (Apple POSTs) — verify `id_token` JWT, upsert user with `oauth_provider='apple'`
5. `users` table: `oauth_provider` column now accepts `'apple'` in addition to `'google'`

Native app (iOS): use `expo-apple-authentication` for the native Sign in with Apple sheet.
Web: use Apple JS SDK or redirect-based flow (both work).

### `useAuth` hook

```typescript
// app/hooks/useAuth.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_KEY = 'cat_tracker_session';

export function useAuth() {
  // On web: session is in a cookie — no SecureStore needed
  // On native: session is in SecureStore
  async function getSessionId(): Promise<string | null> {
    if (Platform.OS === 'web') return null; // cookie is sent automatically
    return SecureStore.getItemAsync(SESSION_KEY);
  }
  async function saveSessionId(id: string) {
    if (Platform.OS === 'web') return;
    await SecureStore.setItemAsync(SESSION_KEY, id);
  }
  async function clearSession() {
    if (Platform.OS === 'web') return;
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
  return { getSessionId, saveSessionId, clearSession };
}
```

`lib/api.ts` wraps every fetch with a header injection:

```typescript
async function apiFetch(path: string, options: RequestInit = {}) {
  const sessionId = await getSessionId(); // from useAuth
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}),
    ...options.headers,
  };
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
```

---

## Navigation

Expo Router v4 uses a file-based system directly analogous to React Router's declarative routes.

| Current React Router path | Expo Router file |
|---|---|
| `/` | `app/(tabs)/index.tsx` |
| `/compare` | `app/(tabs)/compare.tsx` |
| `/cats/new` | `app/cats/new.tsx` |
| `/cats/:id` | `app/cats/[id]/index.tsx` |
| `/cats/:id/edit` | `app/cats/[id]/edit.tsx` |
| `/cats/:id/health` | `app/cats/[id]/health.tsx` |
| `/cats/:id/export` | `app/cats/[id]/export.tsx` |
| `/cats/:id/medications/new` | `app/cats/[id]/medications/new.tsx` |
| `/medications/:id/edit` | `app/medications/[id]/edit.tsx` |
| `/household` | `app/household.tsx` |
| `/notifications` | `app/notifications.tsx` |
| `/invite` | `app/invite.tsx` |
| `/import` | `app/import.tsx` |
| `/wellness` | `app/wellness.tsx` |
| `/login` | `app/(auth)/login.tsx` |

The `(tabs)` group renders the native tab bar (Cats | Log | Compare) on iOS/Android and the existing `BottomNav`-style bar on web. The `(auth)` group is excluded from the tab navigator and rendered without chrome.

**Auth gate** lives in `app/_layout.tsx`:

```tsx
export default function RootLayout() {
  const { sessionId } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!sessionId && !inAuthGroup) router.replace('/(auth)/login');
    if (sessionId && inAuthGroup) router.replace('/');
  }, [sessionId, segments]);

  return <Stack />;
}
```

### QuickAdd

The center "Log" tab button opens `QuickAdd` rather than navigating to a route. On native, `@gorhom/bottom-sheet` renders a true native bottom sheet. On web, the existing CSS sheet is used via `QuickAdd.web.tsx`. The `window.dispatchEvent(new CustomEvent('measurementAdded'))` event bus is replaced with a React context (`MeasurementRefreshContext`) that screens subscribe to.

---

## Styling

NativeWind v4 enables Tailwind utility classes on React Native components via the `className` prop.

### Setup

```bash
npm install nativewind tailwindcss
```

`tailwind.config.ts` — copied from `frontend/tailwind.config.ts` with one addition:

```typescript
content: [
  './app/**/*.{ts,tsx}',
  './components/**/*.{ts,tsx}',
],
// existing theme.extend with brand-* colors unchanged
```

`metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

`global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`babel.config.js`:

```javascript
module.exports = {
  presets: [
    ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    'nativewind/babel',
  ],
};
```

### Design token continuity

The existing `brand-*` color scale and dark glass design system in `tailwind.config.ts` carry over without change. Components that were `className="bg-brand-500 text-white"` continue to use the same tokens.

---

## Charts

Recharts depends on `react-dom` SVG and cannot run on React Native. Replacement: **Victory Native XL** (built on React Native Skia).

```bash
npm install victory-native @shopify/react-native-skia
npx pod-install  # iOS only; handled by EAS Build in CI
```

### API comparison

| Recharts | Victory Native XL |
|---|---|
| `<LineChart data={data}>` | `<CartesianChart data={data}>` |
| `<Line dataKey="value" />` | `<Line y="value" />` inside render prop |
| `<XAxis dataKey="date" />` | `xKey="date"` prop on `CartesianChart` |
| `<Tooltip />` | `useChartPressState` hook |
| `<ResponsiveContainer>` | Not needed; fills parent by default |

### WeightChart port

```tsx
// components/WeightChart.tsx
import { CartesianChart, Line, useChartPressState } from 'victory-native';
import { Circle } from '@shopify/react-native-skia';

export function WeightChart({ data }: { data: WeightPoint[] }) {
  const { state, isActive } = useChartPressState({ x: 0, y: { value: 0 } });

  return (
    <CartesianChart
      data={data}
      xKey="timestamp"
      yKeys={['value']}
      domainPadding={{ top: 20 }}
    >
      {({ points }) => (
        <>
          <Line points={points.value} color="#7c3aed" strokeWidth={2} />
          {points.value.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y ?? 0}
              r={5}
              color={healthStatusColor(data[i])}
            />
          ))}
        </>
      )}
    </CartesianChart>
  );
}
```

The data transformation logic (`bucketByWeek`, `getHealthStatus`) in `healthMetrics.ts` is unchanged.

### Web rendering

Victory Native XL renders via Skia WASM on web, so the same `WeightChart.tsx` works on all three platforms with no `.web.tsx` split needed.

---

## Photo Upload

| Step | Web (current) | Native (new) |
|---|---|---|
| Select image | `<input type="file" accept="image/*">` | `expo-image-picker` (`launchImageLibraryAsync` or `launchCameraAsync`) |
| Crop / resize | Canvas API in `CropModal.tsx` | `expo-image-manipulator` (`manipulateAsync`) |
| Upload | `FormData` POST to `/api/cats/:id/photo` | Same — `FormData` with the manipulated image URI |
| Display | `<img src={photoUrl}>` | `<Image source={{ uri: photoUrl }}>` from `expo-image` |

The Worker endpoint `POST /api/cats/:id/photo` (multipart, stores to R2) requires no changes.

`CropModal.native.tsx` replaces the Canvas-based `CropModal.tsx` on native:

```typescript
import * as ImageManipulator from 'expo-image-manipulator';

async function cropAndUpload(uri: string, crop: CropRect) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop }, { resize: { width: 400, height: 400 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  // result.uri is a local file URI — attach to FormData and POST
}
```

`app.json` permissions required:
```json
{
  "plugins": [
    ["expo-image-picker", {
      "photosPermission": "Cat Tracker uses your photo library to set cat profile photos.",
      "cameraPermission": "Cat Tracker uses your camera to take cat profile photos."
    }]
  ]
}
```

---

## Push Notifications

Current Phase B (web push/VAPID) was deferred. Native replaces it with `expo-notifications`, which handles both APNS (iOS) and FCM (Android) via Expo's push proxy — no direct APNS/FCM credentials needed initially.

### New D1 table

```sql
CREATE TABLE IF NOT EXISTS device_tokens (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL,   -- 'ios' | 'android'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, token)
);
```

### New Worker route

```
POST /api/device-tokens
Body: { token: string, platform: 'ios' | 'android' }
Auth: required
```

Upserts a push token for the authenticated user. Called on app launch after notification permission is granted.

### Worker cron change

The existing cron job (generates medication doses, purges sessions) gains a push notification step:

```typescript
// For each overdue/due-today dose, find the cat's household members
// Look up their device_tokens
// POST to https://exp.host/--/api/v2/push/send with the token + message
```

Expo's push proxy fans out to APNS and FCM. The payload:

```json
{
  "to": "<ExponentPushToken[...]>",
  "title": "Medication due",
  "body": "Simba's flea prevention is due today",
  "data": { "catId": "...", "medicationId": "..." }
}
```

### App-side registration

```typescript
// Called once on app launch (in _layout.tsx)
async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  await apiFetch('/api/device-tokens', {
    method: 'POST',
    body: JSON.stringify({ token: token.data, platform: Platform.OS }),
  });
}
```

`app.json` permissions:
```json
{
  "plugins": ["expo-notifications"]
}
```

### Notification tap handling

Tapping a push notification should deep-link to the relevant cat's Care tab:

```typescript
Notifications.addNotificationResponseReceivedListener(response => {
  const { catId } = response.notification.request.content.data;
  router.push(`/cats/${catId}?tab=care`);
});
```

---

## Vet Export

Current: `window.print()` → browser print dialog → "Save as PDF".

Native: `expo-print` generates a PDF from the same HTML template, then `expo-sharing` opens the native share sheet (AirDrop, Files, email, etc.).

`export.native.tsx` (native-only variant):

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

async function exportToPDF(html: string) {
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share vet summary',
  });
}
```

`export.web.tsx` (web-only variant): unchanged — calls `window.print()`.

The HTML template in `generateExportHtml(cat, measurements)` is shared between both variants.

---

## CSV Import

Current: `<input type="file">` in `ImportPage.tsx`.

`import.native.tsx`:

```typescript
import * as DocumentPicker from 'expo-document-picker';

async function pickCSV() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'text/csv',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return;
  const text = await FileSystem.readAsStringAsync(result.assets[0].uri);
  // existing CSV parsing and preview logic unchanged
}
```

---

## Build and Deployment

### Local development

```bash
cd app
npm install
npx expo start           # starts Metro bundler
# then press:
#   i  → iOS Simulator
#   a  → Android Emulator
#   w  → web browser (http://localhost:8081)
```

The Worker must also be running locally:
```bash
cd worker && npm run dev   # http://localhost:8787
```

`app/lib/api.ts` reads `API_BASE` from environment:
```typescript
const API_BASE = process.env.EXPO_PUBLIC_API_BASE
  ?? (Platform.OS === 'web' ? '' : 'http://localhost:8787');
```

On web, the empty string means same-origin (Pages Functions proxy handles it). On native simulator, it points directly to the local Worker. In production, `EXPO_PUBLIC_API_BASE` is set to `https://cat-tracker-api.stevej-67b.workers.dev` for native builds.

### Web deployment (Cloudflare Pages)

```bash
cd app
npx expo export --platform web   # outputs to dist/
npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true
```

The `functions/` directory inside `app/` is picked up by Wrangler Pages and deploys as Pages Functions, preserving the `/api/*` proxy to the Worker. This is identical to how `frontend/functions/` worked.

### iOS and Android (EAS Build)

```bash
npm install -g eas-cli
eas login

# First time — links to Expo account and generates EAS project ID
eas build:configure

# Development build (runs on simulator or physical device via Expo Go)
eas build --platform ios --profile development
eas build --platform android --profile development

# Production build (for App Store / Play Store)
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios      # uploads .ipa to App Store Connect
eas submit --platform android  # uploads .aab to Google Play
```

### `eas.json`

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_BASE": "http://localhost:8787"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_BASE": "https://cat-tracker-api.stevej-67b.workers.dev"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_BASE": "https://cat-tracker-api.stevej-67b.workers.dev"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "FILL_IN",
        "ascAppId": "FILL_IN",
        "appleTeamId": "FILL_IN"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "production"
      }
    }
  }
}
```

### `app.json` (key fields)

```json
{
  "expo": {
    "name": "Cat Tracker",
    "slug": "cat-tracker",
    "version": "1.0.0",
    "scheme": "me.01j.cattracker",
    "ios": {
      "bundleIdentifier": "me.01j.cattracker",
      "supportsTablet": false
    },
    "android": {
      "package": "me.01j.cattracker",
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png" }
    },
    "web": {
      "output": "static",
      "bundler": "metro"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-image-picker", {
        "photosPermission": "Cat Tracker uses your photo library to set cat profile photos.",
        "cameraPermission": "Cat Tracker uses your camera to take cat profile photos."
      }],
      "expo-notifications"
    ],
    "extra": {
      "eas": { "projectId": "FILL_IN_AFTER_eas_build:configure" }
    }
  }
}
```

---

## Testing

### Unit tests (shared lib)

`lib/correlations.ts`, `lib/healthMetrics.ts`, and `lib/measurementPresets.ts` are pure functions.
Existing tests in `frontend/src/__tests__/lib/` are copied to `app/__tests__/lib/` and run with Vitest. No test changes required.

### Component tests

`@testing-library/react-native` replaces `@testing-library/react`. Query patterns are the same (`getByText`, `getByRole`); element names change (`View`, `Text`, `Pressable`). Existing component tests are rewritten alongside their component ports.

### Worker tests

Unchanged. `worker/src/__tests__/` continues to use `@cloudflare/vitest-pool-workers`.

### End-to-end tests

`maestro` (YAML-based native E2E framework) or `detox` for critical flows:
- Login → view cat list
- QuickAdd measurement → verify on cat profile
- Medication reminder notification tap → deep-link to care tab

These are written after Phase 4 stabilizes.

### Running tests

```bash
cd worker && npm test          # Worker routes + lib
cd app && npm test             # Lib + components (vitest + @testing-library/react-native)
```

---

## App Store Requirements

### Accounts and registration
| Item | Notes |
|---|---|
| Apple Developer Program | $99/yr — required for App Store distribution |
| Google Play Developer | $25 one-time |
| Expo account | Free — required for EAS Build |

### Google OAuth — native client IDs

Two new OAuth 2.0 client IDs in Google Cloud Console (in addition to the existing web client):

| Platform | Client type | Redirect URI |
|---|---|---|
| iOS | iOS | `me.01j.cattracker:/oauth` |
| Android | Android | SHA-1 of debug/release keystore + package name |

### Required assets
| Asset | Spec |
|---|---|
| App icon | 1024×1024 PNG, no alpha, no rounded corners (Apple rounds them) |
| Adaptive icon (Android) | Foreground 1024×1024 PNG on transparent background |
| Splash screen | 1284×2778 PNG (Expo generates all device sizes) |
| Privacy policy URL | Required by both stores; must be publicly accessible |
| App Store screenshots | At least iPhone 6.7" and 6.5"; can use Simulator |
| Google Play screenshots | At least 2 phone screenshots |

### Permission justifications (in `app.json` / store listing)

| Permission | Justification |
|---|---|
| Camera | "Take a photo of your cat for their profile" |
| Photo library | "Choose a photo from your library for your cat's profile" |
| Notifications | "Receive reminders when your cat's medications are due" |

### Review risk factors
- **Not a health app for humans** — no HealthKit, no HIPAA. Cat health data only. No special review category.
- **Google sign-in** — Apple requires apps that offer social login to also offer Sign in with Apple. This must be addressed before iOS App Store submission (add Apple OAuth to the Worker's auth routes).
- **WebView flag** — Using Expo Router native rendering, not a WebView, so this is not a concern.

---

## OTA Updates (EAS Update)

EAS Update enables over-the-air JS bundle updates. When a fix is JS-only (no native module changes), it can be pushed to all installed apps without going through App Store review.

```bash
# Push an OTA update to all production iOS users
cd app && eas update --branch production --platform ios --message "Fix weight chart Y-axis label"
```

### How it works
1. On app launch, `expo-updates` checks for a new JS bundle from EAS
2. If found, it downloads in the background
3. On the next app restart, the new bundle loads
4. If the new bundle crashes, `expo-updates` automatically rolls back to the previous working bundle

### When to use OTA vs full build
| Change type | OTA (EAS Update) | Full build (EAS Build + Submit) |
|---|---|---|
| Bug fix in TypeScript/JSX | Yes | No |
| Copy/text change | Yes | No |
| New Expo plugin or native module | No | Yes |
| `app.json` change (permissions, scheme, etc.) | No | Yes |
| New npm package with native code | No | Yes |

### Configuration
```json
// app.json
{
  "expo": {
    "updates": {
      "url": "https://u.expo.dev/<project-id>",
      "fallbackToCacheTimeout": 3000
    },
    "runtimeVersion": { "policy": "sdkVersion" }
  }
}
```

`runtimeVersion` ensures OTA updates only apply to compatible native builds. When the SDK version changes, old builds won't receive incompatible updates.

---

## Deep Linking & Universal Links

### Why this matters
Household invite emails contain links like `https://cat-tracker.pages.dev/invite?token=abc123`. On iOS, these should open in the native app if installed, falling back to the web app if not.

### Apple Universal Links
1. Host an `apple-app-site-association` file at `https://cat-tracker.pages.dev/.well-known/apple-app-site-association`:
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["<TEAM_ID>.me.01j.cattracker"],
        "paths": ["/invite*", "/cats/*"]
      }
    ]
  }
}
```
2. This file must be served with `Content-Type: application/json` (no redirect). Add it to `app/public/.well-known/` so it deploys with the Pages site.
3. In `app.json`, add the `associatedDomains` entitlement:
```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:cat-tracker.pages.dev"]
    }
  }
}
```

### Expo Router deep link handling
Expo Router handles deep links automatically — a universal link to `/invite?token=abc` routes to `app/invite.tsx` with the token available via `useLocalSearchParams()`. No manual linking configuration needed.

### Custom scheme fallback
For OAuth redirects and other in-app flows, the custom scheme `me.01j.cattracker://` is used. This is configured in `app.json` under `scheme` and works independently of universal links.

---

## Error Monitoring

Native apps crash silently. Without monitoring, bugs are invisible until a 1-star App Store review appears.

### Recommended: Sentry + `sentry-expo`
```bash
npx expo install sentry-expo
```

Configuration in `app/_layout.tsx`:
```typescript
import * as Sentry from 'sentry-expo';
Sentry.init({
  dsn: 'FILL_IN',
  enableInExpoDevelopment: false,
  debug: false,
});
```

### What to monitor
- Unhandled JS exceptions and native crashes
- API call failures (4xx/5xx from the Worker)
- Auth flow failures (OAuth redirect errors)
- Chart rendering errors (Skia is less battle-tested than DOM SVG)

### Source maps
EAS Build automatically uploads source maps to Sentry when configured, enabling readable stack traces from minified production JS.

---

## Versioning & Release Strategy

### Version scheme
```
{MAJOR}.{MINOR}.{PATCH}  (e.g., 1.0.0, 1.1.0, 1.1.1)
```

- `app.json` → `expo.version`: the human-readable version string
- `app.json` → `expo.ios.buildNumber`: auto-incremented by EAS Build (`autoIncrement: true` in `eas.json`)
- Display version in Settings page: `Constants.expoConfig?.version`

### Release flow
1. Bump version in `app.json` (manual decision: patch/minor/major)
2. `eas build --platform ios --profile production --non-interactive`
3. `eas submit --platform ios --latest --non-interactive` → TestFlight
4. Internal testing (minimum 1 day for non-critical, 1 week for major)
5. Promote to App Store review from App Store Connect (or via `eas submit` with release flag)
6. OTA-eligible fixes can skip steps 2–5 and go directly via `eas update`

### Rollback
- OTA updates can be rolled back by publishing a previous bundle version
- Binary builds cannot be rolled back — submit a new build with the fix
- Apple typically reviews expedited submissions within 24 hours for critical fixes

---

## CI/CD Pipeline (GitHub Actions)

Automates build and deployment on push to `main`. This is an enhancement over manual `eas build` commands.

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd worker && npm ci && npm test && npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd app && npm ci && npm test
      - run: cd app && npx expo export --platform web
      - run: cd app && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  ios:
    if: contains(github.event.head_commit.message, '[release-ios]')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: cd app && eas build --platform ios --profile production --non-interactive
      - run: cd app && eas submit --platform ios --latest --non-interactive
```

**Notes:**
- iOS builds are triggered only when the commit message contains `[release-ios]` (prevents burning EAS build minutes on every push)
- Worker and web deploy on every push to `main` (matching current behavior)
- `EXPO_TOKEN` is a personal access token from expo.dev
- `CLOUDFLARE_API_TOKEN` needs Pages + Workers permissions

---

## Performance Budgets

| Metric | Target | How to measure |
|---|---|---|
| iOS cold start → interactive | < 2s on iPhone 12+ | Xcode Instruments or `performance.now()` in `_layout.tsx` |
| JS bundle size (native) | < 5 MB | `npx expo export --dump-sourcemap` + analyze |
| Web bundle size delta | < 500 KB increase over current Vite build | Compare `frontend/dist` vs `app/dist` sizes |
| Chart render (200 data points) | < 500ms | `performance.now()` around chart mount |
| Memory (idle on Home screen) | < 100 MB | Xcode Memory Gauge |
| Skia WASM bundle (web) | < 1.5 MB | Network tab in DevTools |

If the Skia WASM budget is exceeded, the mitigation is a platform split:
- `WeightChart.native.tsx` → Victory Native XL (Skia)
- `WeightChart.web.tsx` → Recharts (current implementation, zero cost)

This adds maintenance overhead but preserves web performance. Decide in Phase 3 based on actual measurements.

---

## Account Deletion (App Store Requirement)

Apple Review Guideline 5.1.1(v) requires that apps offering account creation must allow in-app account deletion.

### Worker route
```
DELETE /api/auth/account
Auth: required
```

Cascade deletes (in order):
1. All `medication_doses` for the user's medications
2. All `medications` for the user's cats
3. All `measurements` for the user's cats
4. R2 objects: `cats/{cat_id}/photo.jpg` for each cat
5. All `cats` owned by the user
6. All `household_members` entries for the user
7. All `sessions` for the user
8. The `users` row

If the user is the sole Admin of a household, the household must either be transferred or dissolved. The API should return a `409 Conflict` with guidance if this precondition isn't met.

### UI
Settings page → "Delete Account" section → red button → confirmation dialog explaining what will be lost → type "DELETE" to confirm → execute → redirect to login screen.

---

## Migration Phases

> **Detailed phased delivery plan with exit criteria:** see [PRD-ios-app-store.md](../PRDs/PRD-ios-app-store.md).

Each phase is independently deployable and leaves the web app in a working state throughout.

### Phase 0 — Foundation (no user-visible changes)

Goal: get the Expo project compiling, running on simulator, and talking to the Worker.

1. Initialize Expo project in `app/` with `npx create-expo-app@latest --template blank-typescript`
2. Install and configure: Expo Router v4, NativeWind v4, `expo-secure-store`, `expo-auth-session`
3. Copy `lib/` files from `frontend/src/lib/` — zero changes, verify they compile
4. Update `lib/api.ts`: `EXPO_PUBLIC_API_BASE` env var, Bearer token injection stub
5. Copy `functions/api/[[path]].ts` from `frontend/functions/` into `app/functions/`
6. Worker: add `Authorization: Bearer` support to `requireAuth` middleware
7. Worker: add `?mode=native` path to `/api/auth/callback`
8. Verify: web target (`npx expo export --platform web`) deploys to Pages and works
9. Verify: `npm test` passes in both `worker/` and `app/`

Deliverable: Expo project exists, compiles for all three platforms, lib tests pass.

### Phase 1 — Auth and navigation shell

Goal: users can sign in on iOS/Android and see the tab navigator.

1. `app/(auth)/login.tsx` — native variant using `expo-auth-session`
2. `app/(auth)/login.web.tsx` — web variant redirecting to `/api/auth/login`
3. `app/_layout.tsx` — auth gate using `useAuth` hook
4. `app/(tabs)/_layout.tsx` — tab bar with Cats | Log | Compare tabs
5. `useAuth` hook: `expo-secure-store` on native, cookie-based on web
6. Stub `app/(tabs)/index.tsx` (empty Home screen) to verify navigation works
7. Test on iOS Simulator, Android Emulator, and web

Deliverable: sign-in works on all three platforms; tab navigator renders.

### Phase 2 — Core screens

Port screens in dependency order (each testable before the next):

1. `Home` — cat list, health badges, claim prompt, notification bell
2. `CatProfile` — 3-tab layout (Health / Care / About); sub-components as stubs initially
3. `AddEditCat` — form fields, photo picker (native: `expo-image-picker`)
4. `QuickAdd` — `QuickAdd.native.tsx` using `@gorhom/bottom-sheet`; `MeasurementRefreshContext` replaces window event bus

Deliverable: full cat management CRUD works on all platforms.

### Phase 3 — Charts and InsightsPanel

1. Install `victory-native` and `@shopify/react-native-skia`
2. Port `WeightChart` → Victory Native XL `CartesianChart` + `Line`
3. Port `MeasurementChart` → Victory Native XL bar or line
4. Port `CorrelationChart` → dual-line with `useChartPressState` tooltip
5. Wire `InsightsPanel` (logic unchanged; only JSX primitives change)

Deliverable: all charts render with correct health status indicators on all platforms.

### Phase 4 — Native features

1. Photo upload: `CropModal.native.tsx` using `expo-image-manipulator`
2. Push notifications: `device_tokens` table + Worker route + `registerForPushNotifications()` + notification tap deep-link
3. Vet export: `export.native.tsx` using `expo-print` + `expo-sharing`
4. CSV import: `import.native.tsx` using `expo-document-picker` + `expo-file-system`
5. Remaining screens: `HouseholdPage`, `NotificationsPage`, `MedicationFormPage`, `InvitePage`, `WellnessGuide`, `CatHealthGuidance`, `CatExportPage`, `CompareChart`

Deliverable: full feature parity with the web app.

### Phase 5 — App store submission

1. Create Apple Developer account; create app in App Store Connect
2. Create Google Play Developer account; create app in Play Console
3. Create native Google OAuth client IDs in Google Cloud Console
4. Add Sign in with Apple to Worker auth routes (required by Apple for apps with social login)
5. Generate app icons, splash screen, and store screenshots
6. Write App Store / Play Store descriptions and metadata
7. `eas build --platform all --profile production`
8. TestFlight internal test (iOS) + Play internal track (Android)
9. Fix any issues found in testing
10. Submit for App Store review and Google Play review

Deliverable: app live in both stores.

### Phase 6 — Retire `frontend/`

Once the Expo web target is verified in production:

1. Confirm `app/` web export matches `frontend/` functionality
2. Delete `frontend/` directory
3. Update `CLAUDE.md` deploy instructions to use `npx expo export --platform web`
4. Update Cloudflare Pages project to deploy from `app/dist/`

Deliverable: single codebase for all three platforms; no `frontend/` directory.

---

## Web Migration Safety Protocol

The `frontend/` directory is the production web app. It must not be deleted or degraded until the Expo web target is proven equivalent.

### Parallel running period
After Phase 4 (feature parity), deploy the Expo web export to a **preview URL** (e.g., `app-preview.cat-tracker.pages.dev`) and run it alongside the existing `frontend/` deployment for at least 2 weeks. Compare:
- Bundle size (must not exceed budget)
- Lighthouse scores (performance, accessibility, SEO)
- Manual walkthrough of all routes
- Chart rendering accuracy (pixel comparison not required, but visual sanity check)

### Rollback plan
If the Expo web export has issues post-cutover:
1. The `frontend/` directory is in git history — restore it
2. Redeploy: `cd frontend && npm run build && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true`
3. No data migration needed — the backend is unchanged

This is why Phase 8 (retire `frontend/`) is a separate phase after launch, not bundled with Phase 7.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Apple rejects for missing Sign in with Apple | **Certain** (if not implemented) | **Blocking** | Phase 5 is dedicated to this — do not submit without it |
| Victory Native XL rendering differs from Recharts (tooltip behavior, legend) | Medium | Medium | Prototype charts in Phase 3 before completing other screens; if unacceptable, use platform split (Victory on native, Recharts on web) |
| NativeWind v4 className prop missing in some RN core components | Medium | Low | Use `StyleSheet.create()` as a fallback for the specific component; don't block on it |
| `expo-auth-session` OAuth flow fails on Android (custom scheme not registered) | Medium | High | Test on physical Android device in Phase 1; custom scheme requires `intentFilters` in `app.json` |
| EAS Build free tier minute limits | Low | Medium | EAS free tier is 30 iOS + 30 Android builds/month — sufficient for development; upgrade if needed |
| Skia WASM adds significant web bundle size | Medium | Low | Measure bundle size after Phase 3; evaluate code-split or fallback if > 2MB increase |
| `expo-secure-store` unavailable in Expo Go (simulator) | Low | Medium | Use a development build (`eas build --profile development`) rather than Expo Go for auth testing |

---

## Open Questions

1. **App name**: "Cat Tracker" is generic and will rank poorly in App Store search. "Cat Tracker — Health Monitor" is more descriptive. Consider a unique brand name before submission.
2. **Web continuity during migration**: `frontend/` stays live until Phase 8. The web app is unaffected by Phases 0–7. See Web Migration Safety Protocol above.
3. **Android Google OAuth**: Requires the SHA-1 fingerprint of the release keystore, which EAS generates. This fingerprint must be registered in Google Cloud Console before Android submission.
4. **Sign in with Apple**: Apple requires it whenever an app offers other social login on iOS. Now fully scoped in the Authentication section above — plan for 2–3 days of work including testing.
5. **Pricing**: Both app stores are free to download. Cloudflare free tier covers the backend at personal scale. No monetization plan currently.
6. **Tablet support**: `supportsTablet: false` in `app.json` for now. Tablet layout would need a two-column design — future work.
7. **Account deletion**: Required by Apple (Review Guideline 5.1.1(v)). Now scoped in the Account Deletion section above. Must be implemented before submission.
8. **Privacy policy**: Must be publicly hosted and linked from both the App Store listing and in-app Settings. See PRD for requirements.
9. **Chart library platform split**: If Skia WASM exceeds the 500 KB web budget, we'll need to maintain both Victory Native XL (native) and Recharts (web). This doubles chart maintenance but preserves web performance. Decision point: Phase 3.
10. **EAS Build minutes**: Free tier is 30 iOS + 30 Android builds/month. Sufficient for development, but CI/CD on every push would exhaust it. The GitHub Actions workflow uses `[release-ios]` commit message gating to conserve minutes.

---

*Last updated: 2026-04-10. Supersedes `scratch/TDD-mobile.md`.*
