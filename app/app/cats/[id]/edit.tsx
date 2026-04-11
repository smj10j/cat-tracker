import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Modal, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../lib/api';
import CatAvatar from '../../../components/CatAvatar';
import { useThemeColors } from '../../../hooks/useThemeColors';

function isTempMicrochip(id: string | null | undefined): boolean {
  return !id || id.startsWith('temp-microchip-id-');
}

export default function EditCatScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '', birthdate: '', breed: '', coloring: '', notes: '',
    sex: '', microchip_id: '', is_neutered: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [catDeceasedAt, setCatDeceasedAt] = useState<string | null>(null);
  const [markingDeceased, setMarkingDeceased] = useState(false);
  const [deceasedModalOpen, setDeceasedModalOpen] = useState(false);
  const [deceasedDate, setDeceasedDate] = useState(new Date().toISOString().slice(0, 10));
  const [memorialNote, setMemorialNote] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getCat(id)
      .then((cat) => {
        setForm({
          name: cat.name,
          birthdate: cat.birthdate,
          breed: cat.breed ?? '',
          coloring: cat.coloring ?? '',
          notes: cat.notes ?? '',
          sex: cat.sex ?? '',
          microchip_id: isTempMicrochip(cat.microchip_id) ? '' : (cat.microchip_id ?? ''),
          is_neutered: cat.is_neutered != null ? String(cat.is_neutered) : '',
        });
        setExistingPhotoUrl(cat.photo_url);
        setCatDeceasedAt(cat.deceased_at);
        if (cat.deceased_at) {
          setDeceasedDate(cat.deceased_at);
          setMemorialNote(cat.memorial_note ?? '');
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoRemoved(false);
      if (id) {
        try {
          const { photo_url } = await api.uploadCatPhoto(id, result.assets[0].uri);
          // Update existing URL so downstream screens get the cache-busted URL
          setExistingPhotoUrl(photo_url);
        } catch {
          setError('Photo upload failed');
        }
      }
    }
  }

  async function handleSubmit() {
    if (!id) return;
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.birthdate.trim()) { setError('Birthdate is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        birthdate: form.birthdate,
        breed: form.breed.trim() || null,
        coloring: form.coloring.trim() || null,
        notes: form.notes.trim() || null,
        sex: form.sex || null,
        microchip_id: form.microchip_id.trim() || null,
        is_neutered: form.is_neutered !== '' ? parseInt(form.is_neutered, 10) : null,
      };
      await api.updateCat(id, payload);
      if (photoRemoved && existingPhotoUrl) {
        await api.deleteCatPhoto(id);
      }
      router.back();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    Alert.alert(
      'Delete Cat',
      'Delete this cat and all their measurements? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await api.deleteCat(id);
              router.replace('/' as never);
            } catch (e: unknown) {
              setError((e as Error).message);
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  async function handleMarkDeceased() {
    if (!id) return;
    setMarkingDeceased(true);
    setError(null);
    try {
      await api.markDeceased(id, deceasedDate, memorialNote || undefined);
      setDeceasedModalOpen(false);
      router.replace(`/cats/${id}/memorial` as never);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setMarkingDeceased(false);
    }
  }

  async function handleMarkAlive() {
    if (!id) return;
    setMarkingDeceased(true);
    setError(null);
    try {
      await api.markAlive(id);
      setCatDeceasedAt(null);
      router.replace(`/cats/${id}` as never);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setMarkingDeceased(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.inkMid }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const catName = form.name || 'your cat';
  const displayPhotoUrl = photoRemoved ? null : (photoUri ?? existingPhotoUrl);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: colors.inkDim, fontSize: 22 }}>{'\u2190'}</Text>
            </Pressable>
            <Text style={{ fontWeight: '700', fontSize: 22, color: colors.ink }}>Edit Cat</Text>
          </View>

          {error && (
            <View style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)' }}>
              <Text style={{ color: colors.rose, fontSize: 14 }}>{error}</Text>
            </View>
          )}

          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.rim,
            gap: 20,
          }}>
            {/* Photo */}
            <View style={{ alignItems: 'center', gap: 8, paddingBottom: 8 }}>
              <Pressable onPress={pickPhoto}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: displayPhotoUrl ? 'rgba(192,132,252,0.4)' : 'rgba(192,132,252,0.35)',
                  borderStyle: displayPhotoUrl ? 'solid' : 'dashed',
                  backgroundColor: displayPhotoUrl ? undefined : 'rgba(192,132,252,0.08)',
                }}>
                  <CatAvatar photoUrl={displayPhotoUrl} name={form.name || 'cat'} size={64} />
                </View>
              </Pressable>
              {displayPhotoUrl ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable onPress={pickPhoto}>
                    <Text style={{ fontSize: 12, color: colors.inkDim }}>Change photo</Text>
                  </Pressable>
                  <Text style={{ fontSize: 12, color: colors.inkDim }}>{'\u00B7'}</Text>
                  <Pressable onPress={() => { setPhotoUri(null); setPhotoRemoved(true); }}>
                    <Text style={{ fontSize: 12, color: 'rgba(248,113,113,0.7)' }}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={pickPhoto}>
                  <Text style={{ fontSize: 12, color: colors.inkDim }}>Add photo</Text>
                </Pressable>
              )}
            </View>

            <FormField label="Name" required value={form.name} onChangeText={(v) => setField('name', v)} placeholder="e.g. Luna" maxLength={200} />
            <FormField label="Birthdate" required value={form.birthdate} onChangeText={(v) => setField('birthdate', v)} placeholder="YYYY-MM-DD" maxLength={10} />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <FormField label="Breed" value={form.breed} onChangeText={(v) => setField('breed', v)} placeholder="Domestic Shorthair" maxLength={200} />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel label="Sex" />
                <SegmentedControl
                  options={[{ label: 'Unknown', value: '' }, { label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }]}
                  value={form.sex}
                  onChange={(v) => setField('sex', v)}
                />
              </View>
            </View>

            <View>
              <FieldLabel label="Neuter status" />
              <SegmentedControl
                options={[
                  { label: 'Unknown', value: '' },
                  { label: form.sex === 'Female' ? 'Spayed' : 'Neutered', value: '1' },
                  { label: 'Intact', value: '0' },
                ]}
                value={form.is_neutered}
                onChange={(v) => setField('is_neutered', v)}
              />
            </View>

            <FormField label="Coloring" value={form.coloring} onChangeText={(v) => setField('coloring', v)} placeholder="Orange tabby" maxLength={200} />
            <FormField label="Notes" value={form.notes} onChangeText={(v) => setField('notes', v)} placeholder="Anything worth remembering..." maxLength={4000} multiline />
            <FormField label="Microchip ID" value={form.microchip_id} onChangeText={(v) => setField('microchip_id', v)} placeholder="e.g. 985112345678903" maxLength={50} subtitle="Leave blank to fill in later." />

            <Pressable
              onPress={handleSubmit}
              disabled={saving || deleting}
              style={{
                backgroundColor: colors.lavender,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: saving ? 0.6 : 1,
                marginTop: 4,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                {saving ? 'Saving\u2026' : 'Save Changes'}
              </Text>
            </Pressable>

            {/* Memorial editing (when deceased) */}
            {catDeceasedAt && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.rim, paddingTop: 16, gap: 12 }}>
                <Text style={{ color: colors.inkMid, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Memorial
                </Text>
                <View>
                  <Text style={{ color: colors.inkMid, fontSize: 13, marginBottom: 6 }}>Date of passing</Text>
                  <TextInput
                    value={deceasedDate}
                    onChangeText={setDeceasedDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.inkDim}
                    style={{
                      backgroundColor: colors.night,
                      borderRadius: 12,
                      padding: 14,
                      color: colors.ink,
                      fontSize: 14,
                      borderWidth: 1,
                      borderColor: colors.rim,
                    }}
                  />
                </View>
                <View>
                  <Text style={{ color: colors.inkMid, fontSize: 13, marginBottom: 6 }}>Memorial note</Text>
                  <TextInput
                    value={memorialNote}
                    onChangeText={(t) => setMemorialNote(t.slice(0, 1024))}
                    placeholder={`What made ${catName} special\u2026`}
                    placeholderTextColor={colors.inkDim}
                    multiline
                    numberOfLines={4}
                    maxLength={1024}
                    blurOnSubmit
                    returnKeyType="done"
                    style={{
                      backgroundColor: colors.night,
                      borderRadius: 12,
                      padding: 14,
                      color: colors.ink,
                      fontSize: 14,
                      borderWidth: 1,
                      borderColor: colors.rim,
                      minHeight: 100,
                      textAlignVertical: 'top',
                    }}
                  />
                  <Text style={{ color: colors.inkDim, fontSize: 11, textAlign: 'right', marginTop: 4 }}>
                    {memorialNote.length}/1024
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    setSaving(true);
                    try {
                      await api.markDeceased(id!, deceasedDate, memorialNote || undefined);
                      router.back();
                    } catch (e: unknown) {
                      setError((e as Error).message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  style={{
                    backgroundColor: 'rgba(192,132,252,0.15)',
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(192,132,252,0.3)',
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: colors.lavender, fontSize: 14, fontWeight: '600' }}>
                    {saving ? 'Saving\u2026' : 'Update Memorial'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Danger zone */}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.rim, paddingTop: 16, gap: 12 }}>
              {catDeceasedAt ? (
                <Pressable
                  onPress={handleMarkAlive}
                  disabled={markingDeceased || saving}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.rim,
                  }}
                >
                  <Text style={{ color: colors.inkMid, fontSize: 14, fontWeight: '600' }}>
                    {markingDeceased ? 'Saving\u2026' : `Mark ${catName} as active again`}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    setDeceasedDate(new Date().toISOString().slice(0, 10));
                    setMemorialNote('');
                    setDeceasedModalOpen(true);
                  }}
                  disabled={markingDeceased}
                  style={{ paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.inkDim, fontSize: 14 }}>
                    {catName} has passed away {'\u2192'}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleDelete}
                disabled={deleting || saving}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: 'rgba(248,113,113,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(248,113,113,0.2)',
                }}
              >
                <Text style={{ color: deleting ? 'rgba(248,113,113,0.4)' : 'rgba(248,113,113,0.7)', fontSize: 14, fontWeight: '600' }}>
                  {deleting ? 'Deleting\u2026' : 'Delete Cat'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={deceasedModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeceasedModalOpen(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            paddingBottom: 40,
          }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 }}>
              Remembering {catName}
            </Text>

            <Text style={{ color: colors.inkMid, fontSize: 13, marginBottom: 6 }}>
              When did {catName} pass away?
            </Text>
            <TextInput
              value={deceasedDate}
              onChangeText={setDeceasedDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.inkDim}
              style={{
                backgroundColor: colors.night,
                borderRadius: 12,
                padding: 14,
                color: colors.ink,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.rim,
                marginBottom: 16,
              }}
            />

            <Text style={{ color: colors.inkMid, fontSize: 13, marginBottom: 6 }}>
              A few words (optional)
            </Text>
            <TextInput
              value={memorialNote}
              onChangeText={(t) => setMemorialNote(t.slice(0, 1024))}
              placeholder="The bravest cat..."
              placeholderTextColor={colors.inkDim}
              multiline
              numberOfLines={3}
              maxLength={1024}
              blurOnSubmit
              returnKeyType="done"
              style={{
                backgroundColor: colors.night,
                borderRadius: 12,
                padding: 14,
                color: colors.ink,
                fontSize: 14,
                borderWidth: 1,
                borderColor: colors.rim,
                minHeight: 80,
                textAlignVertical: 'top',
                marginBottom: 4,
              }}
            />
            <Text style={{ color: colors.inkDim, fontSize: 11, textAlign: 'right', marginBottom: 20 }}>
              {memorialNote.length}/1024
            </Text>

            <Pressable
              onPress={handleMarkDeceased}
              disabled={markingDeceased || !deceasedDate}
              style={{
                backgroundColor: 'rgba(192,132,252,0.15)',
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(192,132,252,0.3)',
                opacity: markingDeceased ? 0.5 : 1,
              }}
            >
              <Text style={{ color: colors.lavender, fontSize: 16, fontWeight: '600' }}>
                {markingDeceased ? 'Saving...' : `Remember ${catName}`}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setDeceasedModalOpen(false)}
              style={{ paddingVertical: 12, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: colors.inkDim, fontSize: 14 }}>Not now</Text>
            </Pressable>
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  const colors = useThemeColors();
  return (
    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
      {label}{required ? <Text style={{ color: colors.rose }}> *</Text> : ''}
    </Text>
  );
}

function FormField({
  label, value, onChangeText, placeholder, maxLength, required, multiline, subtitle,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  multiline?: boolean;
  subtitle?: string;
}) {
  const colors = useThemeColors();
  return (
    <View>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkDim}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.rim,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          color: colors.ink,
          fontSize: 14,
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: multiline ? 80 : undefined,
        }}
      />
      {subtitle && (
        <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 6 }}>{subtitle}</Text>
      )}
    </View>
  );
}

function SegmentedControl({
  options, value, onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: colors.card, borderRadius: 10, padding: 3 }}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: value === opt.value ? 'rgba(192,132,252,0.15)' : 'transparent',
            borderWidth: value === opt.value ? 1 : 0,
            borderColor: 'rgba(192,132,252,0.25)',
          }}
        >
          <Text style={{
            fontSize: 12,
            fontWeight: '600',
            color: value === opt.value ? colors.lavender : colors.inkDim,
          }}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
