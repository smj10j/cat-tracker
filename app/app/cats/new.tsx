import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';

export default function NewCatScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!birthdate.trim()) { setError('Birthdate is required'); return; }
    setError('');
    setSaving(true);
    try {
      const cat = await api.createCat({
        name: name.trim(),
        birthdate: birthdate.trim(),
        breed: breed.trim() || null,
        sex: sex || null,
        notes: notes.trim() || null,
      });
      router.replace(`/cats/${cat.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cat');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-night">
      <View className="px-4 py-3 flex-row items-center justify-between border-b border-rim">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">Cancel</Text>
        </Pressable>
        <Text className="text-ink text-lg font-bold">Add Cat</Text>
        <Pressable onPress={handleSave} disabled={saving}>
          <Text className={`text-base font-semibold ${saving ? 'text-ink-dim' : 'text-lavender'}`}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ gap: 16 }}>
        {error ? (
          <View className="bg-rose/10 rounded-xl p-3 border border-rose/20">
            <Text className="text-rose text-sm">{error}</Text>
          </View>
        ) : null}

        <FormField label="Name *" value={name} onChangeText={setName} placeholder="Cat name" />
        <FormField label="Birthdate *" value={birthdate} onChangeText={setBirthdate} placeholder="YYYY-MM-DD" />
        <FormField label="Breed" value={breed} onChangeText={setBreed} placeholder="Optional" />

        <View>
          <Text className="text-ink-mid text-sm mb-2">Sex</Text>
          <View className="flex-row gap-2">
            {['Male', 'Female'].map((option) => (
              <Pressable
                key={option}
                onPress={() => setSex(sex === option ? '' : option)}
                className={`px-4 py-2 rounded-pill border ${
                  sex === option ? 'border-lavender bg-lavender/20' : 'border-rim bg-surface'
                }`}
              >
                <Text className={sex === option ? 'text-lavender font-medium' : 'text-ink-mid'}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <FormField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline />
      </ScrollView>
    </SafeAreaView>
  );
}

function FormField({
  label, value, onChangeText, placeholder, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <View>
      <Text className="text-ink-mid text-sm mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6b5f85"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        className={`bg-surface border border-rim rounded-xl px-4 py-3 text-ink ${
          multiline ? 'min-h-[80px] text-top' : ''
        }`}
        style={Platform.OS === 'web' ? { outlineStyle: 'none' } as never : undefined}
      />
    </View>
  );
}
