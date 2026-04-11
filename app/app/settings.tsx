import { View, Text, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

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
    <SafeAreaView className="flex-1 bg-night">
      <View className="px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold">Settings</Text>
      </View>

      <View className="px-4 mt-4 gap-4">
        {/* User info */}
        <View className="bg-surface rounded-card p-4 border border-rim">
          <Text className="text-ink font-semibold">{user?.display_name ?? 'User'}</Text>
          <Text className="text-ink-mid text-sm">{user?.email}</Text>
          <Text className="text-ink-dim text-xs mt-1">
            Signed in with {user?.oauth_provider === 'apple' ? 'Apple' : 'Google'}
          </Text>
        </View>

        {/* Household settings */}
        <Pressable
          onPress={() => router.push('/household')}
          className="bg-surface rounded-card p-4 border border-rim"
        >
          <Text className="text-ink font-semibold">Household Settings</Text>
          <Text className="text-ink-dim text-sm mt-1">
            Manage members, invites, and sharing
          </Text>
        </Pressable>

        {/* Data export */}
        <Pressable
          onPress={handleExportData}
          className="bg-surface rounded-card p-4 border border-rim"
        >
          <Text className="text-ink font-semibold">Download My Data</Text>
          <Text className="text-ink-dim text-sm mt-1">
            Export all your cats, measurements, and medications as JSON
          </Text>
        </Pressable>

        {/* Sign out */}
        <Pressable
          onPress={signOut}
          className="bg-surface rounded-card p-4 border border-rim"
        >
          <Text className="text-ink font-semibold">Sign Out</Text>
        </Pressable>

        {/* Delete account */}
        <Pressable
          onPress={handleDeleteAccount}
          className="bg-rose/10 rounded-card p-4 border border-rose/20 mt-8"
        >
          <Text className="text-rose font-semibold">Delete Account</Text>
          <Text className="text-rose/60 text-sm mt-1">
            Permanently delete your account and all associated data
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
