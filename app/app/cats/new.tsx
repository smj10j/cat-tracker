import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../lib/api';
import CatAvatar from '../../components/CatAvatar';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
import { parseDate, formatDateStr } from '../../lib/dateHelpers';

export default function NewCatScreen() {
  const colors = useThemeColors();
  const { rv } = useResponsiveLayout();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '', birthdate: '', breed: '', coloring: '', notes: '',
    sex: '', microchip_id: '', is_neutered: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);

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
    }
  }

  async function handleSubmit() {
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
        photo_url: null,
        deceased_at: null,
        memorial_note: null,
      };
      const cat = await api.createCat(payload);
      if (photoUri) {
        try {
          await api.uploadCatPhoto(cat.id, photoUri);
        } catch {
          // photo upload failed but cat was created
        }
      }
      router.replace(`/cats/${cat.id}` as never);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <ResponsiveContainer style={{ paddingTop: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: colors.inkDim, fontSize: 22 }}>{'\u2190'}</Text>
            </Pressable>
            <Text style={{ fontWeight: '700', fontSize: rv(22, 26), color: colors.ink }}>New Cat</Text>
          </View>

          {error && (
            <View style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)' }}>
              <Text style={{ color: colors.rose, fontSize: 14 }}>{error}</Text>
            </View>
          )}

          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: rv(24, 28),
            borderWidth: 1,
            borderColor: colors.rim,
            gap: 20,
          }}>
            {/* Photo */}
            <Pressable onPress={pickPhoto} style={{ alignItems: 'center', gap: 8, paddingBottom: 8 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
                borderWidth: 2,
                borderStyle: photoUri ? 'solid' : 'dashed',
                borderColor: photoUri ? 'rgba(192,132,252,0.4)' : 'rgba(192,132,252,0.35)',
                backgroundColor: photoUri ? undefined : 'rgba(192,132,252,0.08)',
              }}>
                <CatAvatar photoUrl={photoUri} name={form.name || 'cat'} size={64} />
              </View>
              <Text style={{ fontSize: 12, color: colors.inkDim }}>
                {photoUri ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>

            <FormField label="Name" required value={form.name} onChangeText={(v) => setField('name', v)} placeholder="e.g. Luna" maxLength={200} />

            {/* Birthdate with date picker */}
            <View>
              <FieldLabel label="Birthdate" required />
              <Pressable
                onPress={() => setShowBirthdatePicker((v) => !v)}
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: showBirthdatePicker ? colors.lavender : colors.rim,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  minHeight: 44,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: form.birthdate ? colors.ink : colors.inkDim, fontSize: 14 }}>
                  {form.birthdate || 'Select birthdate'}
                </Text>
              </Pressable>
              {showBirthdatePicker && (
                <DateTimePicker
                  value={form.birthdate ? parseDate(form.birthdate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant="dark"
                  maximumDate={new Date()}
                  onChange={(_event, selected) => {
                    if (Platform.OS === 'android') setShowBirthdatePicker(false);
                    if (selected) setField('birthdate', formatDateStr(selected));
                  }}
                  style={{ marginTop: 4 }}
                />
              )}
            </View>

            <FormField label="Breed" value={form.breed} onChangeText={(v) => setField('breed', v)} placeholder="Domestic Shorthair" maxLength={200} />

            {/* Sex — full width, not squeezed beside breed */}
            <View>
              <FieldLabel label="Sex" />
              <SegmentedControl
                options={[{ label: 'Unknown', value: '' }, { label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }]}
                value={form.sex}
                onChange={(v) => setField('sex', v)}
              />
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
              disabled={saving}
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
                {saving ? 'Saving\u2026' : 'Add Cat'}
              </Text>
            </Pressable>
          </View>
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>
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
          minHeight: multiline ? 80 : 44,
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
