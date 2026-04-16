import { View, Text, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, ThemePreference } from '../contexts/ThemeContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useThemeColors } from '../hooks/useThemeColors';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { ResponsiveContainer } from '../components/ResponsiveContainer';
import { api } from '../lib/api';
import { THEME_FAMILIES, type ThemeFamily } from '@shared/lib/themeTokens';
import type { DateFormat, TimeFormat, WeightUnit } from '@shared/lib/preferences';

const DATE_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'MDY', label: 'MM/DD' },
  { value: 'DMY', label: 'DD/MM' },
  { value: 'YMD', label: 'YYYY-MM' },
];

const TIME_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
];

const WEIGHT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: 'lbs', label: 'lbs' },
  { value: 'kg', label: 'kg' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'dark', label: 'Dark', icon: '\uD83C\uDF19' },
  { value: 'light', label: 'Light', icon: '\u2600\uFE0F' },
  { value: 'system', label: 'System', icon: '\u2699\uFE0F' },
];

const FAMILY_META: Record<ThemeFamily, { label: string; description: string; swatches: { dark: string[]; light: string[] } }> = {
  lamplight: {
    label: 'Lamplight',
    description: 'Warm amber on aubergine',
    swatches: { dark: ['#1B1424', '#332444', '#F2A65A', '#9C6BD9'], light: ['#FAF5EC', '#F1E9D8', '#C8741F', '#6E4FA8'] },
  },
  warmnight: {
    label: 'Warm Night',
    description: 'The original nightshade purple',
    swatches: { dark: ['#1A1326', '#322547', '#B07BFF', '#FFB37A'], light: ['#F6F2FB', '#EFE8FA', '#7C3AED', '#C2410C'] },
  },
  forest: {
    label: 'Forest',
    description: 'Deep green with terracotta warmth',
    swatches: { dark: ['#141A14', '#27332A', '#5BAE7E', '#D6936A'], light: ['#F4F1E8', '#EAE6D8', '#2F6A4A', '#A75D34'] },
  },
  linen: {
    label: 'Linen',
    description: 'Cool teal on soft neutral',
    swatches: { dark: ['#15191A', '#2A3132', '#5FB3B0', '#E8B05C'], light: ['#FAFAFA', '#F0F2F3', '#2B7A78', '#A5731F'] },
  },
  almanac: {
    label: 'Almanac',
    description: 'Terracotta on warm paper',
    swatches: { dark: ['#1A1410', '#312721', '#D87850', '#C7A86B'], light: ['#F4EFE6', '#EBE3D2', '#B85C2E', '#8A6F3D'] },
  },
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, setTheme, family, setFamily } = useTheme();
  const { prefs, setPref, resetToLocale, isOverridden } = usePreferences();
  const colors = useThemeColors();
  const { rv } = useResponsiveLayout();
  const { colorScheme } = useColorScheme();
  const currentMode = colorScheme === 'light' ? 'light' : 'dark';
  const hasAnyOverride = isOverridden('dateFormat') || isOverridden('timeFormat') || isOverridden('weightUnit');

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
        api.deleteAccount().then(() => signOut());
      }
      return;
    }
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await api.deleteAccount();
            await signOut();
          },
        },
      ],
    );
  };

  const handleExportData = async () => {
    try {
      const data = await api.exportData();
      if (Platform.OS !== 'web') {
        const filename = `whisker-health-export-${new Date().toISOString().slice(0, 10)}.json`;
        const file = new File(Paths.cache, filename);
        file.write(data);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          UTI: 'public.json',
        });
        return;
      }
      // Web path
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whisker-health-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
      <ResponsiveContainer>
        <View style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.lavender, fontSize: 16 }}>← Back</Text>
          </Pressable>
          <Text style={{ color: colors.ink, fontSize: rv(20, 26), fontWeight: '700' }}>Settings</Text>
        </View>
      </ResponsiveContainer>

      <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <ResponsiveContainer style={{ gap: 16 }}>
        {/* User info */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: rv(16, 20), borderWidth: 1, borderColor: colors.rim }}>
          <Text style={{ color: colors.ink, fontWeight: '600' }}>{user?.display_name ?? 'User'}</Text>
          <Text style={{ color: colors.inkMid, fontSize: 14 }}>{user?.email}</Text>
          <Text style={{ color: colors.inkDim, fontSize: 12, marginTop: 4 }}>
            Signed in with {user?.oauth_provider === 'apple' ? 'Apple' : 'Google'}
          </Text>
        </View>

        {/* Appearance */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: rv(16, 20), borderWidth: 1, borderColor: colors.rim }}>
          <Text style={{ color: colors.inkMid, fontSize: rv(10, 12), fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            Appearance
          </Text>

          {/* Theme Family Picker */}
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Color theme</Text>
          <View style={{ gap: 6, marginBottom: 16 }}>
            {THEME_FAMILIES.map((fam) => {
              const meta = FAMILY_META[fam];
              const isActive = family === fam;
              const swatches = meta.swatches[currentMode];
              return (
                <Pressable
                  key={fam}
                  onPress={() => setFamily(fam)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: isActive ? colors.brandGlow : colors.card,
                    borderWidth: isActive ? 1.5 : 1,
                    borderColor: isActive ? colors.brand : colors.cardBorder,
                  }}
                >
                  {/* Swatches */}
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {swatches.map((color, i) => (
                      <View
                        key={i}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: color,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </View>
                  {/* Label + description */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: isActive ? colors.brand : colors.ink,
                      }}
                      numberOfLines={1}
                    >
                      {meta.label}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: colors.inkDim, marginTop: 1 }}
                      numberOfLines={1}
                    >
                      {meta.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Mode Picker */}
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Mode</Text>
          <View style={{ flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4, backgroundColor: colors.surfaceHi }}>
            {THEME_OPTIONS.map(({ value, label, icon }) => {
              const isActive = theme === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setTheme(value)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: isActive ? colors.lavender : undefined,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{icon}</Text>
                  <Text
                    style={{ fontSize: 14, fontWeight: '600', color: isActive ? '#ffffff' : colors.inkDim }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.inkDim, fontSize: 12, marginTop: 8 }}>
            {theme === 'system'
              ? "Follows your device\u2019s display settings."
              : theme === 'light'
              ? 'Always uses the light theme.'
              : 'Always uses the dark theme.'}
          </Text>
        </View>

        {/* Regional */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: rv(16, 20), borderWidth: 1, borderColor: colors.rim }}>
          <Text style={{ color: colors.inkMid, fontSize: rv(10, 12), fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            Regional
          </Text>

          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Date format</Text>
          <View style={{ flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4, backgroundColor: colors.surfaceHi, marginBottom: 4 }}>
            {DATE_OPTIONS.map(({ value, label }) => {
              const isActive = prefs.dateFormat === value;
              return (
                <Pressable key={value} onPress={() => setPref('dateFormat', value)}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8,
                    backgroundColor: isActive ? colors.lavender : undefined }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#ffffff' : colors.inkDim }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {!isOverridden('dateFormat') && <Text style={{ color: colors.inkDim, fontSize: 11, marginBottom: 12 }}>(auto-detected)</Text>}

          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 8 }}>Time format</Text>
          <View style={{ flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4, backgroundColor: colors.surfaceHi, marginBottom: 4 }}>
            {TIME_OPTIONS.map(({ value, label }) => {
              const isActive = prefs.timeFormat === value;
              return (
                <Pressable key={value} onPress={() => setPref('timeFormat', value)}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8,
                    backgroundColor: isActive ? colors.lavender : undefined }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: isActive ? '#ffffff' : colors.inkDim }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {!isOverridden('timeFormat') && <Text style={{ color: colors.inkDim, fontSize: 11, marginBottom: 12 }}>(auto-detected)</Text>}

          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 8 }}>Weight unit</Text>
          <View style={{ flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4, backgroundColor: colors.surfaceHi, marginBottom: 4 }}>
            {WEIGHT_OPTIONS.map(({ value, label }) => {
              const isActive = prefs.weightUnit === value;
              return (
                <Pressable key={value} onPress={() => setPref('weightUnit', value)}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8,
                    backgroundColor: isActive ? colors.lavender : undefined }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: isActive ? '#ffffff' : colors.inkDim }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {!isOverridden('weightUnit') && <Text style={{ color: colors.inkDim, fontSize: 11, marginBottom: 4 }}>(auto-detected)</Text>}

          {hasAnyOverride && (
            <Pressable onPress={resetToLocale} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.inkDim, fontSize: 14 }}>Reset to locale defaults</Text>
            </Pressable>
          )}
        </View>

        {/* Household settings */}
        <Pressable
          onPress={() => router.push('/household')}
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: rv(16, 20), borderWidth: 1, borderColor: colors.rim }}
        >
          <Text style={{ color: colors.ink, fontWeight: '600' }}>Household Settings</Text>
          <Text style={{ color: colors.inkDim, fontSize: 14, marginTop: 4 }}>
            Manage members, invites, and sharing
          </Text>
        </Pressable>

        {/* Data export */}
        <Pressable
          onPress={handleExportData}
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: rv(16, 20), borderWidth: 1, borderColor: colors.rim }}
        >
          <Text style={{ color: colors.ink, fontWeight: '600' }}>Download My Data</Text>
          <Text style={{ color: colors.inkDim, fontSize: 14, marginTop: 4 }}>
            Export all your cats, measurements, and medications as JSON
          </Text>
        </Pressable>

        {/* Sign out */}
        <Pressable
          onPress={signOut}
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: rv(16, 20), borderWidth: 1, borderColor: colors.rim }}
        >
          <Text style={{ color: colors.ink, fontWeight: '600' }}>Sign Out</Text>
        </Pressable>

        {/* Privacy policy */}
        <Pressable
          onPress={() => router.push('/privacy' as never)}
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: rv(16, 20), borderWidth: 1, borderColor: colors.rim }}
        >
          <Text style={{ color: colors.ink, fontWeight: '600' }}>Privacy Policy</Text>
        </Pressable>

        {/* Delete account */}
        <Pressable
          onPress={handleDeleteAccount}
          style={{ backgroundColor: `${colors.rose}1A`, borderRadius: 16, padding: rv(16, 20), borderWidth: 1, borderColor: `${colors.rose}33`, marginTop: 32 }}
        >
          <Text style={{ color: colors.rose, fontWeight: '600' }}>Delete Account</Text>
          <Text style={{ color: `${colors.rose}99`, fontSize: 14, marginTop: 4 }}>
            Permanently delete your account and all associated data
          </Text>
        </Pressable>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}
