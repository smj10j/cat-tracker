import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { useThemeColors } from '../hooks/useThemeColors';
import type { InvitePreview } from '../lib/api';

const ROLE_DESC: Record<string, string> = {
  viewer: 'view cats and measurements',
  contributor: 'log measurements and mark medications',
  editor: 'add, edit, and delete cats and measurements',
  admin: 'fully manage the household including inviting members',
};

export default function InviteScreen() {
  const colors = useThemeColors();
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Fetch invite preview on mount
  useEffect(() => {
    if (!token) {
      setPreviewError('No invite token in this link.');
      setPreviewLoading(false);
      return;
    }
    api.getInvitePreview(token)
      .then((p) => setPreview(p))
      .catch((e: Error) => {
        const msg = e.message;
        if (msg.includes('invite_not_found') || msg.includes('404'))
          setPreviewError('This invite link is no longer valid.');
        else if (msg.includes('invite_expired'))
          setPreviewError('This invite link has expired. Ask the household admin to send a new one.');
        else setPreviewError('Could not load invite details.');
      })
      .finally(() => setPreviewLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.acceptInvite(token);
      setDone(true);
      setTimeout(() => router.replace('/'), 2000);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg.includes('email_mismatch')) {
        setActionError(
          `This invite was sent to ${preview?.invite_email ?? 'a different email'}. Sign in with that account, or ask the admin to resend to your current email.`
        );
      } else if (msg.includes('already_member')) {
        setActionError("You're already a member of this household.");
      } else {
        setActionError(msg || 'Failed to accept invite.');
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecline() {
    if (!token) return;
    setActionLoading(true);
    try {
      await api.declineInvite(token);
    } catch {
      // Decline failures are non-critical — navigate away regardless
    }
    router.replace('/');
  }

  // Loading state
  if (previewLoading || authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-night items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.lavender} size="large" />
        <Text className="text-ink-dim text-sm mt-4">Loading invite...</Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (previewError) {
    return (
      <SafeAreaView className="flex-1 bg-night items-center justify-center px-6" edges={['top']}>
        <Text className="text-3xl mb-4">🐱</Text>
        <Text className="text-ink font-semibold text-base mb-2">Invite not found</Text>
        <Text className="text-ink-dim text-sm text-center mb-6">{previewError}</Text>
        <Pressable
          onPress={() => router.replace('/')}
          className="bg-lavender/20 border border-lavender/40 rounded-2xl py-3 px-6"
        >
          <Text className="text-lavender font-semibold text-sm">Go to Whisker Health</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Success state
  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-night items-center justify-center px-6" edges={['top']}>
        <Text className="text-3xl mb-4">🐾</Text>
        <Text className="text-ink font-semibold text-base mb-2">
          Welcome to {preview?.household_name}!
        </Text>
        <Text className="text-ink-dim text-sm">Redirecting to your cats…</Text>
      </SafeAreaView>
    );
  }

  // Not logged in — prompt sign-in
  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView className="flex-1 bg-night items-center justify-center px-6" edges={['top']}>
        <View className="w-full max-w-sm bg-surface border border-rim rounded-3xl p-6">
          <View className="items-center mb-5">
            <Text className="text-3xl mb-3">🐱</Text>
            <Text className="text-ink-dim text-sm mb-1">You've been invited to</Text>
            <Text className="text-ink font-bold text-xl">{preview?.household_name}</Text>
          </View>

          <View className="bg-night/50 border border-rim rounded-2xl p-4 mb-5">
            {preview?.invited_by_name && (
              <Text className="text-ink-dim text-xs">
                Invited by <Text className="text-ink">{preview.invited_by_name}</Text>
              </Text>
            )}
            <Text className="text-ink-dim text-xs">
              Role: <Text className="text-ink capitalize">{preview?.role}</Text>
            </Text>
            <Text className="text-ink-dim text-xs mt-1">
              You'll be able to {ROLE_DESC[preview?.role ?? ''] ?? 'access the household'}.
            </Text>
          </View>

          <Text className="text-ink-dim text-xs text-center mb-4">
            Sign in to accept this invitation.
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            className="bg-lavender/20 border border-lavender/40 rounded-2xl py-3.5 items-center"
          >
            <Text className="text-lavender font-semibold text-sm">Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Logged in — show accept/decline
  const roleDesc = ROLE_DESC[preview?.role ?? ''] ?? 'access the household';

  return (
    <SafeAreaView className="flex-1 bg-night items-center justify-center px-6" edges={['top']}>
      <View className="w-full max-w-sm bg-surface border border-rim rounded-3xl p-6">
        <View className="items-center mb-5">
          <Text className="text-3xl mb-3">🐱</Text>
          <Text className="text-ink-dim text-sm mb-1">You've been invited to</Text>
          <Text className="text-ink font-bold text-xl">{preview?.household_name}</Text>
        </View>

        <View className="bg-night/50 border border-rim rounded-2xl p-4 mb-5">
          {preview?.invited_by_name && (
            <Text className="text-ink-dim text-xs">
              Invited by <Text className="text-ink">{preview.invited_by_name}</Text>
            </Text>
          )}
          <Text className="text-ink-dim text-xs">
            Role: <Text className="text-ink capitalize">{preview?.role}</Text>
          </Text>
          <Text className="text-ink-dim text-xs mt-1">
            You'll be able to {roleDesc}.
          </Text>
        </View>

        {actionError && (
          <View className="bg-rose/10 border border-rose/20 rounded-xl p-3 mb-4">
            <Text className="text-rose text-xs">{actionError}</Text>
          </View>
        )}

        <Pressable
          onPress={handleAccept}
          disabled={actionLoading}
          className="bg-lavender/20 border border-lavender/40 rounded-2xl py-3.5 items-center mb-2"
          style={{ opacity: actionLoading ? 0.5 : 1 }}
        >
          <Text className="text-lavender font-semibold text-sm">
            {actionLoading ? 'Accepting…' : 'Accept invitation'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleDecline}
          disabled={actionLoading}
          className="py-3 items-center"
        >
          <Text className="text-ink-dim text-xs">Decline</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
