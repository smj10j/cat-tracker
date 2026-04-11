import { View, Text, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, ThemePreference } from '../contexts/ThemeContext';
import { useThemeColors } from '../hooks/useThemeColors';
import { api } from '../lib/api';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'dark', label: 'Dark', icon: '\uD83C\uDF19' },
  { value: 'light', label: 'Light', icon: '\u2600\uFE0F' },
  { value: 'system', label: 'System', icon: '\u2699\uFE0F' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const colors = useThemeColors();

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      <View className="px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold">Settings</Text>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 16 }}>
        {/* User info */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}>
          <Text style={{ color: colors.ink, fontWeight: '600' }}>{user?.display_name ?? 'User'}</Text>
          <Text style={{ color: colors.inkMid, fontSize: 14 }}>{user?.email}</Text>
          <Text style={{ color: colors.inkDim, fontSize: 12, marginTop: 4 }}>
            Signed in with {user?.oauth_provider === 'apple' ? 'Apple' : 'Google'}
          </Text>
        </View>

        {/* Appearance */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}>
          <Text style={{ color: colors.inkMid, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            Appearance
          </Text>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Theme</Text>
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
                    backgroundColor: isActive ? '#c084fc' : undefined,
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

        {/* Household settings */}
        <Pressable
          onPress={() => router.push('/household')}
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}
        >
          <Text style={{ color: colors.ink, fontWeight: '600' }}>Household Settings</Text>
          <Text style={{ color: colors.inkDim, fontSize: 14, marginTop: 4 }}>
            Manage members, invites, and sharing
          </Text>
        </Pressable>

        {/* Data export */}
        <Pressable
          onPress={handleExportData}
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}
        >
          <Text style={{ color: colors.ink, fontWeight: '600' }}>Download My Data</Text>
          <Text style={{ color: colors.inkDim, fontSize: 14, marginTop: 4 }}>
            Export all your cats, measurements, and medications as JSON
          </Text>
        </Pressable>

        {/* Sign out */}
        <Pressable
          onPress={signOut}
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.rim }}
        >
          <Text style={{ color: colors.ink, fontWeight: '600' }}>Sign Out</Text>
        </Pressable>

        {/* Delete account */}
        <Pressable
          onPress={handleDeleteAccount}
          style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', marginTop: 32 }}
        >
          <Text style={{ color: '#f87171', fontWeight: '600' }}>Delete Account</Text>
          <Text style={{ color: 'rgba(248,113,113,0.6)', fontSize: 14, marginTop: 4 }}>
            Permanently delete your account and all associated data
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
