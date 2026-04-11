import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../lib/api';
import CatAvatar from '../../components/CatAvatar';

export default function NewCatScreen() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '', birthdate: '', breed: '', coloring: '', notes: '',
    sex: '', microchip_id: '', is_neutered: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#16111f' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: '#6b5f85', fontSize: 22 }}>{'\u2190'}</Text>
            </Pressable>
            <Text style={{ fontWeight: '700', fontSize: 22, color: '#ede9f6' }}>New Cat</Text>
          </View>

          {error && (
            <View style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)' }}>
              <Text style={{ color: '#f87171', fontSize: 14 }}>{error}</Text>
            </View>
          )}

          <View style={{
            backgroundColor: '#1f1830',
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
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
              <Text style={{ fontSize: 12, color: '#6b5f85' }}>
                {photoUri ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>

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
              disabled={saving}
              style={{
                backgroundColor: '#c084fc',
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '600', color: '#a899c0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
      {label}{required ? <Text style={{ color: '#f87171' }}> *</Text> : ''}
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
  return (
    <View>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6b5f85"
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.07)',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          color: '#ede9f6',
          fontSize: 14,
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: multiline ? 80 : undefined,
        }}
      />
      {subtitle && (
        <Text style={{ fontSize: 12, color: '#6b5f85', marginTop: 6 }}>{subtitle}</Text>
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
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
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
            color: value === opt.value ? '#c084fc' : '#6b5f85',
          }}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
