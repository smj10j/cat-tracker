import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import type { HouseholdResponse, HouseholdMember, PendingInvite } from '../lib/api';
import { useThemeColors } from '../hooks/useThemeColors';

const ROLES = ['viewer', 'contributor', 'editor', 'admin'] as const;
type Role = (typeof ROLES)[number];

const ROLE_DESC: Record<Role, string> = {
  viewer: 'Can view cats and measurements',
  contributor: 'Can log measurements and mark medications',
  editor: 'Can add, edit, and delete cats',
  admin: 'Full control, can invite members',
};

const ROLE_COLORS: Record<string, string> = {
  admin: '#c084fc',
  editor: '#4ade80',
  contributor: '#fbbf24',
  viewer: '#a899c0',
};

export default function HouseholdScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [data, setData] = useState<HouseholdResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('contributor');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Role picker
  const [showRolePicker, setShowRolePicker] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const d = await api.getHousehold();
      setData(d);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRename() {
    if (!renameName.trim() || !data) return;
    setRenameLoading(true);
    try {
      await api.renameHousehold(renameName.trim());
      setRenaming(false);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setRenameLoading(false);
    }
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await api.sendInvite(inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      if (res.inviteUrl) {
        setInviteSuccess(`Invite sent! Share link: ${res.inviteUrl}`);
      } else {
        setInviteSuccess('Invite sent!');
      }
      await load();
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg === 'already_member') setInviteError('That person is already a member.');
      else if (msg === 'invite_pending')
        setInviteError('A pending invite already exists for this email.');
      else setInviteError(msg);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    try {
      await api.revokeInvite(inviteId);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await api.changeMemberRole(userId, newRole);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleRemove(userId: string) {
    const member = data?.members.find((m) => m.user_id === userId);
    const name = member?.display_name ?? member?.email ?? 'this member';

    if (Platform.OS === 'web') {
      if (!confirm(`Remove ${name}? They'll lose access immediately.`)) return;
    } else {
      return new Promise<void>((resolve) => {
        Alert.alert(
          'Remove member',
          `Remove ${name} from this household? They'll lose access immediately.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                try {
                  await api.removeMember(userId);
                  await load();
                } catch (e: unknown) {
                  setError((e as Error).message);
                }
                resolve();
              },
            },
          ],
        );
      });
    }

    try {
      await api.removeMember(userId);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.lavender} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: colors.rose, fontSize: 14 }}>
            {error ?? 'Failed to load household.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { household, members, pendingInvites, myRole, isOwner } = data;
  const isAdmin = myRole === 'admin';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.rim,
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.lavender, fontSize: 15 }}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>Household</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.rose,
            }}
          >
            <Text style={{ color: colors.rose, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Household name card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.rim,
          }}
        >
          {renaming ? (
            <View>
              <TextInput
                style={{
                  color: colors.ink,
                  fontSize: 18,
                  fontWeight: '600',
                  borderBottomWidth: 1,
                  borderBottomColor: `${colors.lavender}60`,
                  paddingBottom: 6,
                  marginBottom: 12,
                }}
                value={renameName}
                onChangeText={setRenameName}
                autoFocus
                maxLength={100}
                placeholderTextColor={colors.inkDim}
                onSubmitEditing={handleRename}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={handleRename}
                  disabled={renameLoading}
                  style={{
                    backgroundColor: colors.lavender,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: colors.night, fontSize: 12, fontWeight: '600' }}>
                    {renameLoading ? 'Saving...' : 'Save'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setRenaming(false)} style={{ paddingVertical: 8 }}>
                  <Text style={{ color: colors.inkDim, fontSize: 12 }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.inkDim,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginBottom: 4,
                  }}
                >
                  Household
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>
                  {household.name}
                </Text>
              </View>
              {isAdmin && (
                <Pressable
                  onPress={() => {
                    setRenameName(household.name);
                    setRenaming(true);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.rim,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.inkDim }}>Rename</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Members */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.rim,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: colors.inkDim,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 12,
            }}
          >
            Members ({members.length})
          </Text>
          {members.map((m, idx) => (
            <MemberRow
              key={m.id}
              member={m}
              isOwnerMember={household.owner_user_id === m.user_id}
              canManage={isAdmin && household.owner_user_id !== m.user_id}
              myRole={myRole}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
              isLast={idx === members.length - 1}
            />
          ))}
        </View>

        {/* Pending invites */}
        {isAdmin && pendingInvites.length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.rim,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: colors.inkDim,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              Pending Invites ({pendingInvites.length})
            </Text>
            {pendingInvites.map((inv, idx) => (
              <PendingInviteRow
                key={inv.id}
                invite={inv}
                onRevoke={handleRevoke}
                isLast={idx === pendingInvites.length - 1}
              />
            ))}
          </View>
        )}

        {/* Invite form */}
        {isAdmin && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.rim,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: colors.inkDim,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 16,
              }}
            >
              Invite Someone
            </Text>

            {/* Email */}
            <Text style={{ fontSize: 12, color: colors.inkDim, marginBottom: 4 }}>
              Email address
            </Text>
            <TextInput
              style={{
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: colors.rim,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.ink,
                marginBottom: 12,
              }}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.inkDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={200}
            />

            {/* Role selector */}
            <Text style={{ fontSize: 12, color: colors.inkDim, marginBottom: 4 }}>Role</Text>
            <View style={{ marginBottom: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {ROLES.filter((r) => r !== 'admin' || isOwner).map((r) => {
                  const active = inviteRole === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setInviteRole(r)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        marginRight: 8,
                        backgroundColor: active ? `${ROLE_COLORS[r]}20` : 'transparent',
                        borderWidth: 1,
                        borderColor: active ? ROLE_COLORS[r] : colors.rim,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: active ? ROLE_COLORS[r] : colors.inkDim,
                        }}
                      >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={{ fontSize: 11, color: colors.inkDim, marginTop: 6 }}>
                {ROLE_DESC[inviteRole]}
              </Text>
            </View>

            {inviteError && (
              <Text style={{ color: colors.rose, fontSize: 12, marginBottom: 8 }}>
                {inviteError}
              </Text>
            )}

            {inviteSuccess && (
              <View
                style={{
                  backgroundColor: 'rgba(74,222,128,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(74,222,128,0.2)',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: colors.jade, fontSize: 12 }}>{inviteSuccess}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSendInvite}
              disabled={inviteLoading || !inviteEmail.trim()}
              style={{
                backgroundColor:
                  inviteLoading || !inviteEmail.trim()
                    ? `${colors.lavender}40`
                    : colors.lavender,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.night, fontSize: 14, fontWeight: '600' }}>
                {inviteLoading ? 'Sending...' : 'Send invite'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MemberRow({
  member,
  isOwnerMember,
  canManage,
  myRole,
  onRoleChange,
  onRemove,
  isLast,
}: {
  member: HouseholdMember;
  isOwnerMember: boolean;
  canManage: boolean;
  myRole: string;
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string) => void;
  isLast: boolean;
}) {
  const colors = useThemeColors();
  const initial = (member.display_name?.[0] ?? member.email?.[0] ?? '?').toUpperCase();
  const [showRoles, setShowRoles] = useState(false);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.card,
        gap: 10,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(192,132,252,0.2)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.lavender }}>{initial}</Text>
      </View>

      {/* Name + email */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}
            numberOfLines={1}
          >
            {member.display_name ?? member.email ?? 'Unknown'}
          </Text>
          {isOwnerMember && (
            <Text style={{ fontSize: 11, color: colors.inkDim, marginLeft: 6 }}>Owner</Text>
          )}
        </View>
        {member.email && member.display_name && (
          <Text style={{ fontSize: 12, color: colors.inkDim }} numberOfLines={1}>
            {member.email}
          </Text>
        )}
      </View>

      {/* Role badge or manage controls */}
      {canManage ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => setShowRoles(!showRoles)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.rim,
              backgroundColor: `${ROLE_COLORS[member.role] ?? colors.inkMid}15`,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: ROLE_COLORS[member.role] ?? colors.inkMid,
              }}
            >
              {member.role} {'\u25BE'}
            </Text>
          </Pressable>
          <Pressable onPress={() => onRemove(member.user_id)} style={{ padding: 4 }}>
            <Text style={{ fontSize: 16, color: `${colors.rose}80` }}>{'\u00D7'}</Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 12,
            backgroundColor: `${ROLE_COLORS[member.role] ?? colors.inkMid}15`,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: ROLE_COLORS[member.role] ?? colors.inkMid,
            }}
          >
            {member.role}
          </Text>
        </View>
      )}

      {/* Role dropdown */}
      {showRoles && canManage && (
        <View
          style={{
            position: 'absolute',
            right: 40,
            top: 40,
            backgroundColor: colors.surfaceHi,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.rim,
            padding: 4,
            zIndex: 10,
            minWidth: 120,
          }}
        >
          {ROLES.filter((r) => r !== 'admin' || myRole === 'admin').map((r) => (
            <Pressable
              key={r}
              onPress={() => {
                onRoleChange(member.user_id, r);
                setShowRoles(false);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 6,
                backgroundColor: member.role === r ? colors.card : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: member.role === r ? colors.lavender : colors.inkMid,
                  fontWeight: member.role === r ? '600' : '400',
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function PendingInviteRow({
  invite,
  onRevoke,
  isLast,
}: {
  invite: PendingInvite;
  onRevoke: (id: string) => void;
  isLast: boolean;
}) {
  const colors = useThemeColors();
  const daysLeft = invite.invite_expires_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(invite.invite_expires_at.replace(' ', 'T') + 'Z').getTime() -
            Date.now()) /
            86400000,
        ),
      )
    : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.card,
        gap: 10,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(251,191,36,0.1)',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 2,
        }}
      >
        <Text style={{ fontSize: 14 }}>{'\u2709'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: colors.ink }} numberOfLines={1}>
          {invite.invite_email}
        </Text>
        <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>
          {invite.role} {'\u00B7'}{' '}
          {daysLeft !== null ? `expires in ${daysLeft}d` : 'no expiry'}
        </Text>
      </View>
      <Pressable
        onPress={() => onRevoke(invite.id)}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.rim,
        }}
      >
        <Text style={{ fontSize: 12, color: colors.inkDim }}>Revoke</Text>
      </Pressable>
    </View>
  );
}
