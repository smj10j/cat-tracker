import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import type { Cat } from '../../lib/api';
import { PRESETS } from '../../lib/measurementPresets';
import { useThemeColors } from '../../hooks/useThemeColors';

type Selections = Partial<Record<string, number>>;

const BEHAVIORAL_TYPES = [
  { key: 'food',     label: 'Food' },
  { key: 'water',    label: 'Water' },
  { key: 'litter',   label: 'Litter' },
  { key: 'grooming', label: 'Grooming' },
  { key: 'activity', label: 'Activity' },
  { key: 'vomiting', label: 'Vomiting' },
] as const;

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentHour(): number {
  return new Date().getHours();
}

function buildMeasuredAt(localDate: string, hour: number): string {
  const [y, mo, d] = localDate.split('-').map(Number);
  return new Date(y!, mo! - 1, d!, hour, 0, 0).toISOString();
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

export default function LogScreen() {
  const colors = useThemeColors();
  const [cats, setCats] = useState<Cat[]>([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [hour, setHour] = useState(currentHour);
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [selections, setSelections] = useState<Selections>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCats().then((all) => {
      const active = all.filter(c => !c.deceased_at);
      setCats(active);
      if (active.length === 1 && active[0]) setSelectedCatId(active[0].id);
    });
  }, []);

  const selectedCat = cats.find((c) => c.id === selectedCatId) ?? null;

  const weightValid = weightValue.trim() !== '' && !isNaN(parseFloat(weightValue)) && parseFloat(weightValue) > 0;
  const measurementCount =
    (weightValid ? 1 : 0) + Object.keys(selections).filter((k) => selections[k] !== undefined).length;
  const canSubmit = selectedCatId !== '' && measurementCount > 0;

  function handlePreset(type: string, value: number) {
    setSelections((prev) => {
      if (prev[type] === value) {
        const next = { ...prev };
        delete next[type];
        return next;
      }
      return { ...prev, [type]: value };
    });
  }

  function reset() {
    setWeightValue('');
    setSelections({});
    setHour(currentHour());
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const measured_at = buildMeasuredAt(todayLocalDate(), hour);
    const toCreate: Array<{ type: string; value: number; unit: string }> = [];

    if (weightValid) {
      toCreate.push({ type: 'weight', value: parseFloat(weightValue), unit: weightUnit });
    }
    for (const { key } of BEHAVIORAL_TYPES) {
      const val = selections[key];
      if (val !== undefined) {
        toCreate.push({ type: key, value: val, unit: 'scale' });
      }
    }

    try {
      await Promise.all(
        toCreate.map((m) =>
          api.addMeasurement(selectedCatId, { ...m, measured_at, notes: null })
        )
      );
      setSaved(true);
      reset();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Some measurements could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Header */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.rim }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: colors.ink }}>Daily Check-In</Text>
            {selectedCat && (
              <Text style={{ fontSize: 12, color: colors.inkMid, marginTop: 2 }}>{selectedCat.name}</Text>
            )}
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 16 }}>
            {/* Success banner */}
            {saved && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
                backgroundColor: 'rgba(74,222,128,0.12)',
                borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
              }}>
                <Text style={{ color: '#4ade80' }}>{'\u2713'}</Text>
                <Text style={{ color: '#4ade80', fontWeight: '600', fontSize: 14 }}>Check-in saved!</Text>
              </View>
            )}

            {error && (
              <View style={{
                paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
                backgroundColor: 'rgba(248,113,113,0.1)',
                borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
              }}>
                <Text style={{ color: '#f87171', fontSize: 14 }}>{error}</Text>
              </View>
            )}

            {/* Cat selector */}
            {cats.length !== 1 && (
              <View style={{
                borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
                backgroundColor: colors.card,
                borderWidth: 1, borderColor: colors.rim,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Cat
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {cats.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedCatId(c.id)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                        backgroundColor: selectedCatId === c.id ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.05)',
                        borderWidth: 1,
                        borderColor: selectedCatId === c.id ? 'rgba(192,132,252,0.25)' : 'rgba(255,255,255,0.07)',
                      }}
                    >
                      <Text style={{
                        fontSize: 13, fontWeight: '600',
                        color: selectedCatId === c.id ? colors.lavender : colors.inkDim,
                      }}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Time */}
            <View style={{
              borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
              backgroundColor: colors.card,
              borderWidth: 1, borderColor: colors.rim,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                When
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => setHour(h)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: hour === h ? 'rgba(192,132,252,0.15)' : 'transparent',
                      borderWidth: hour === h ? 1 : 0,
                      borderColor: 'rgba(192,132,252,0.25)',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: hour === h ? colors.lavender : colors.inkDim }}>
                      {formatHour(h)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Weight */}
            <View style={{
              borderRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
              backgroundColor: colors.card,
              borderWidth: 1, borderColor: colors.rim,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Weight
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={weightValue}
                  onChangeText={setWeightValue}
                  placeholder="e.g. 9.4 — leave blank to skip"
                  placeholderTextColor={colors.inkDim}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  style={{
                    flex: 1,
                    backgroundColor: colors.card,
                    borderWidth: 1, borderColor: colors.rim,
                    borderRadius: 12,
                    paddingHorizontal: 12, paddingVertical: 10,
                    color: colors.ink, fontSize: 14,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {(['lbs', 'kg'] as const).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setWeightUnit(u)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
                        backgroundColor: weightUnit === u ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.05)',
                        borderWidth: 1,
                        borderColor: weightUnit === u ? 'rgba(192,132,252,0.25)' : 'rgba(255,255,255,0.07)',
                      }}
                    >
                      <Text style={{ color: weightUnit === u ? colors.lavender : colors.inkDim, fontWeight: '600', fontSize: 14 }}>
                        {u}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Behavioral observations */}
            <View style={{
              borderRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
              backgroundColor: colors.card,
              borderWidth: 1, borderColor: colors.rim,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Observations \u2014 tap to select, skip any row
              </Text>

              {BEHAVIORAL_TYPES.map(({ key, label }, i) => {
                const presets = PRESETS[key] ?? [];
                const selectedVal = selections[key];
                const isLast = i === BEHAVIORAL_TYPES.length - 1;

                return (
                  <View
                    key={key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 8,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.rim,
                    }}
                  >
                    <Text style={{
                      width: 64, fontSize: 12, fontWeight: '500', flexShrink: 0,
                      color: selectedVal !== undefined ? colors.ink : colors.inkDim,
                    }}>
                      {label}
                    </Text>

                    <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                      {presets.map((preset) => {
                        const isSelected = selectedVal === preset.value;
                        return (
                          <Pressable
                            key={preset.value}
                            onPress={() => handlePreset(key, preset.value)}
                            disabled={saving}
                            style={{
                              flex: 1,
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 2,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isSelected
                                ? (preset.concern ? 'rgba(248,113,113,0.18)' : 'rgba(74,222,128,0.13)')
                                : colors.surface,
                              borderWidth: isSelected ? 1.5 : 1,
                              borderColor: isSelected
                                ? (preset.concern ? 'rgba(248,113,113,0.45)' : 'rgba(74,222,128,0.35)')
                                : 'rgba(255,255,255,0.07)',
                            }}
                          >
                            <Text style={{
                              fontSize: 11, fontWeight: '600', lineHeight: 14, textAlign: 'center',
                              color: isSelected
                                ? (preset.concern ? colors.rose : colors.jade)
                                : colors.inkDim,
                            }}>
                              {preset.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Submit */}
            <View style={{ paddingTop: 4 }}>
              {measurementCount > 0 && selectedCatId ? (
                <Text style={{ textAlign: 'center', fontSize: 12, color: colors.inkMid, marginBottom: 12 }}>
                  Logging {measurementCount} measurement{measurementCount !== 1 ? 's' : ''} for{' '}
                  <Text style={{ color: colors.ink, fontWeight: '600' }}>{selectedCat?.name ?? '\u2026'}</Text>
                </Text>
              ) : null}
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit || saving}
                style={{
                  backgroundColor: '#c084fc',
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: 'center',
                  opacity: canSubmit && !saving ? 1 : 0.4,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                  {saving ? 'Saving\u2026' : 'Log Check-In'}
                </Text>
              </Pressable>
              {!canSubmit && !saving && (
                <Text style={{ textAlign: 'center', fontSize: 12, color: colors.inkDim, marginTop: 8 }}>
                  {!selectedCatId
                    ? 'Select a cat above to continue'
                    : 'Select at least one measurement above to log'}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
