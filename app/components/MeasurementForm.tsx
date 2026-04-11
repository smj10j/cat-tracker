import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { api } from '../lib/api';
import type { Measurement } from '../lib/api';
import { PRESETS, PRESET_TYPES } from '../lib/measurementPresets';

interface Props {
  catId: string;
  onAdded: (m: Measurement) => void;
}

const TYPE_OPTIONS = [
  { value: 'weight',   label: 'Weight' },
  { value: 'food',     label: 'Food Intake' },
  { value: 'water',    label: 'Water Intake' },
  { value: 'litter',   label: 'Litter Box' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'activity', label: 'Activity' },
  { value: 'vomiting', label: 'Vomiting' },
];

export default function MeasurementForm({ catId, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('weight');
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  function handleTypeChange(newType: string) {
    setType(newType);
    setWeightValue('');
    setSelectedPreset(null);
    setError(null);
  }

  async function save(value: number, unit: string) {
    setSaving(true);
    setError(null);
    try {
      const measured_at = new Date().toISOString();
      const m = await api.addMeasurement(catId, { type, value, unit, measured_at, notes: null });
      onAdded(m);
      setWeightValue('');
      setSelectedPreset(null);
      setSavedFlash(true);
      setTimeout(() => {
        setSavedFlash(false);
        setOpen(false);
      }, 1000);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleWeightSubmit() {
    const num = parseFloat(weightValue);
    if (isNaN(num) || num <= 0) { setError('Enter a valid positive number.'); return; }
    await save(num, weightUnit);
  }

  async function handlePresetSave() {
    if (selectedPreset === null) return;
    await save(selectedPreset, 'scale');
  }

  function handlePresetTap(value: number) {
    setSelectedPreset((prev) => prev === value ? null : value);
    setError(null);
  }

  const isPresetType = PRESET_TYPES.has(type);
  const presets = PRESETS[type] ?? [];
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: 'rgba(192,132,252,0.3)',
          borderRadius: 16,
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#c084fc', fontWeight: '600', fontSize: 14 }}>+ Add Measurement</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        borderRadius: 16,
        padding: 20,
        backgroundColor: 'rgba(192,132,252,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(192,132,252,0.2)',
        gap: 16,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600', fontSize: 16, color: '#ede9f6' }}>New Measurement</Text>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#6b5f85', fontSize: 22 }}>{'\u00D7'}</Text>
        </Pressable>
      </View>

      {savedFlash && (
        <Text style={{ color: '#4ade80', fontWeight: '600', fontSize: 14, textAlign: 'center' }}>
          {'\u2713'} Saved!
        </Text>
      )}

      {error && (
        <View style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 8, padding: 8 }}>
          <Text style={{ color: '#f87171', fontSize: 14 }}>{error}</Text>
        </View>
      )}

      {/* Type selector */}
      <View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#a899c0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Type
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TYPE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => handleTypeChange(opt.value)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: type === opt.value ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: type === opt.value ? 'rgba(192,132,252,0.25)' : 'rgba(255,255,255,0.07)',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: type === opt.value ? '#c084fc' : '#6b5f85',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Input area */}
      {isPresetType ? (
        <View>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#a899c0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Observation
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {presets.map((preset) => {
              const isSelected = selectedPreset === preset.value;
              return (
                <Pressable
                  key={preset.value}
                  onPress={() => handlePresetTap(preset.value)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    minWidth: '45%',
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: isSelected
                      ? (preset.concern ? 'rgba(248,113,113,0.18)' : 'rgba(192,132,252,0.15)')
                      : (preset.concern ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.05)'),
                    borderWidth: isSelected ? 1.5 : 1,
                    borderColor: isSelected
                      ? (preset.concern ? 'rgba(248,113,113,0.5)' : 'rgba(192,132,252,0.4)')
                      : (preset.concern ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.07)'),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isSelected
                        ? (preset.concern ? '#f87171' : '#c084fc')
                        : (preset.concern ? 'rgba(248,113,113,0.8)' : '#ede9f6'),
                    }}
                  >
                    {preset.concern ? '! ' : ''}{saving ? '\u2026' : preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selectedPreset !== null && (
            <Pressable
              onPress={handlePresetSave}
              disabled={saving}
              style={{
                marginTop: 12,
                backgroundColor: '#c084fc',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                {saving ? 'Saving\u2026' : `Save ${typeLabel} Observation`}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#a899c0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Weight
              </Text>
              <TextInput
                value={weightValue}
                onChangeText={setWeightValue}
                placeholder="e.g. 9.4"
                placeholderTextColor="#6b5f85"
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: '#ede9f6',
                  fontSize: 14,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#a899c0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Unit
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {['lbs', 'kg'].map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setWeightUnit(u)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: 'center',
                      backgroundColor: weightUnit === u ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: weightUnit === u ? 'rgba(192,132,252,0.25)' : 'rgba(255,255,255,0.07)',
                    }}
                  >
                    <Text style={{ color: weightUnit === u ? '#c084fc' : '#6b5f85', fontWeight: '600', fontSize: 14 }}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <Pressable
            onPress={handleWeightSubmit}
            disabled={saving}
            style={{
              backgroundColor: '#c084fc',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
              {saving ? 'Saving\u2026' : 'Save Weight'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
