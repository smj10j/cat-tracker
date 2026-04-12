import { useEffect, useState, useRef } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Modal,
  KeyboardAvoidingView, Platform, Animated, Dimensions,
} from 'react-native';
import { api } from '../lib/api';
import type { Cat } from '../lib/api';
import { PRESETS, PRESET_TYPES } from '../lib/measurementPresets';
import { useThemeColors } from '../hooks/useThemeColors';
import { usePreferences } from '../contexts/PreferencesContext';
import { VALID_MEASUREMENT_TYPES, MEASUREMENT_TYPE_LABELS } from '@shared/lib/constants';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS = VALID_MEASUREMENT_TYPES.map(value => ({ value, label: MEASUREMENT_TYPE_LABELS[value] ?? value }));

export default function QuickAdd({ open, onClose }: Props) {
  const colors = useThemeColors();
  const { prefs } = usePreferences();
  const [cats, setCats] = useState<Cat[]>([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [type, setType] = useState('weight');
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState(prefs.weightUnit);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  useEffect(() => {
    if (open) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();

      if (cats.length === 0) {
        api.getCats().then((all) => {
          const active = all.filter(c => !c.deceased_at);
          setCats(active);
          if (active.length === 1 && active[0]) setSelectedCatId(active[0].id);
        });
      }
      setWeightValue('');
      setSelectedPreset(null);
      setError(null);
      setSuccess(false);
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [open]);

  function handleTypeChange(newType: string) {
    setSelectedPreset(null);
    setType(newType);
    setWeightValue('');
  }

  async function submitMeasurement(value: number, unit: string) {
    if (!selectedCatId) { setError('Select a cat first.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.addMeasurement(selectedCatId, {
        type,
        value,
        unit,
        measured_at: new Date().toISOString(),
        notes: null,
      });
      setSuccess(true);
      setTimeout(() => { onClose(); setSuccess(false); }, 900);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePresetTap(presetValue: number) {
    setSelectedPreset(presetValue);
    await submitMeasurement(presetValue, 'scale');
  }

  async function handleWeightSubmit() {
    const num = parseFloat(weightValue);
    if (isNaN(num) || num <= 0) { setError('Enter a valid weight.'); return; }
    await submitMeasurement(num, weightUnit);
  }

  const isPresetType = PRESET_TYPES.has(type);
  const presets = PRESETS[type] ?? [];

  if (!open) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(10,6,20,0.7)', justifyContent: 'flex-end' }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.surfaceHi,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderTopColor: colors.rim,
                padding: 20,
                paddingBottom: 36,
              }}
            >
              {/* Handle */}
              <View style={{
                width: 40, height: 4, borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignSelf: 'center', marginBottom: 20,
              }} />

              <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 18, marginBottom: 20 }}>
                Log Measurement
              </Text>

              {success ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <View style={{
                    width: 64, height: 64, borderRadius: 32,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(74,222,128,0.15)',
                    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
                    marginBottom: 12,
                  }}>
                    <Text style={{ fontSize: 24, color: colors.jade }}>{'\u2713'}</Text>
                  </View>
                  <Text style={{ fontWeight: '600', color: colors.jade }}>Saved!</Text>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {error && (
                    <View style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, padding: 10 }}>
                      <Text style={{ color: colors.rose, fontSize: 14 }}>{error}</Text>
                    </View>
                  )}

                  {/* Cat selector */}
                  {cats.length > 1 && (
                    <View>
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
                              backgroundColor: selectedCatId === c.id ? 'rgba(192,132,252,0.15)' : colors.card,
                              borderWidth: 1,
                              borderColor: selectedCatId === c.id ? 'rgba(192,132,252,0.25)' : colors.rim,
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

                  {/* Type selector */}
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                      What to log
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {TYPE_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.value}
                          onPress={() => handleTypeChange(opt.value)}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                            backgroundColor: type === opt.value ? 'rgba(192,132,252,0.15)' : colors.card,
                            borderWidth: 1,
                            borderColor: type === opt.value ? 'rgba(192,132,252,0.25)' : colors.rim,
                          }}
                        >
                          <Text style={{
                            fontSize: 13, fontWeight: '600',
                            color: type === opt.value ? colors.lavender : colors.inkDim,
                          }}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Input area */}
                  {isPresetType ? (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
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
                                paddingVertical: 16,
                                borderRadius: 16,
                                alignItems: 'center',
                                backgroundColor: isSelected
                                  ? (preset.concern ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.15)')
                                  : colors.card,
                                borderWidth: isSelected ? 1.5 : 1,
                                borderColor: isSelected
                                  ? (preset.concern ? 'rgba(248,113,113,0.5)' : 'rgba(74,222,128,0.4)')
                                  : colors.rim,
                              }}
                            >
                              <Text style={{
                                fontSize: 14, fontWeight: '600',
                                color: isSelected
                                  ? (preset.concern ? colors.rose : colors.jade)
                                  : colors.ink,
                              }}>
                                {saving && isSelected ? '\u2026' : preset.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            Weight
                          </Text>
                          <TextInput
                            value={weightValue}
                            onChangeText={setWeightValue}
                            placeholder="e.g. 9.4"
                            placeholderTextColor={colors.inkDim}
                            keyboardType="decimal-pad"
                            returnKeyType="done"
                            style={{
                              backgroundColor: colors.card,
                              borderWidth: 1,
                              borderColor: colors.rim,
                              borderRadius: 12,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              color: colors.ink,
                              fontSize: 14,
                            }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            Unit
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            {(['lbs', 'kg'] as const).map((u) => (
                              <Pressable
                                key={u}
                                onPress={() => setWeightUnit(u)}
                                style={{
                                  flex: 1,
                                  paddingVertical: 12,
                                  borderRadius: 12,
                                  alignItems: 'center',
                                  backgroundColor: weightUnit === u ? 'rgba(192,132,252,0.15)' : colors.card,
                                  borderWidth: 1,
                                  borderColor: weightUnit === u ? 'rgba(192,132,252,0.25)' : colors.rim,
                                }}
                              >
                                <Text style={{
                                  color: weightUnit === u ? colors.lavender : colors.inkDim,
                                  fontWeight: '600', fontSize: 14,
                                }}>
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
                          backgroundColor: colors.lavender,
                          borderRadius: 12,
                          paddingVertical: 14,
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
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
