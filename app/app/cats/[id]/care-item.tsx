import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api, CARE_TYPE_ICONS } from '../../../lib/api';
import type { Cat, Medication } from '../../../lib/api';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { usePreferences } from '../../../contexts/PreferencesContext';
import { formatHour } from '@shared/lib/formatting';
import {
  MEDICATION_PRESETS as PRESETS,
  MEDICATION_PRESET_CATEGORIES as PRESET_CATEGORIES,
  MEDICATION_FREQ_LABELS,
  MEDICATION_TYPE_LABELS,
  formatFrequencyLabel,
  type MedicationPreset,
} from '@shared/lib/medicationPresets';
import {
  CARE_ITEM_DEFAULTS,
  hydrateFromMedication,
  applyPresetToFields,
  validateCareItem,
  buildCareItemPayload,
  type CareItemFields,
} from '@shared/lib/careItemForm';
import { parseDate, formatDateStr as formatDate } from '../../../lib/dateHelpers';

const FREQ_OPTIONS = Object.entries(MEDICATION_FREQ_LABELS).map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(MEDICATION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function CareItemScreen() {
  const colors = useThemeColors();
  const { prefs } = usePreferences();
  const { id, medId } = useLocalSearchParams<{ id: string; medId?: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const isEdit = Boolean(medId);

  const [cat, setCat] = useState<Cat | null>(null);
  const [fields, setFields] = useState<CareItemFields>(CARE_ITEM_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  // Date/time picker state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const timePickerRef = useRef<ScrollView>(null);

  // Convenience field accessors
  const setField = <K extends keyof CareItemFields>(key: K, value: CareItemFields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (isEdit && medId) {
          const med = await api.getMedication(medId);
          setFields(hydrateFromMedication(med));
          const c = await api.getCat(med.cat_id);
          setCat(c);
        } else if (id) {
          const c = await api.getCat(id);
          setCat(c);
        }
      } catch (e: unknown) {
        showError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, medId, isEdit]);

  function showError(msg: string) {
    setError(msg);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (Platform.OS !== 'web') {
      Alert.alert('Error', msg);
    }
  }

  function applyPreset(preset: MedicationPreset) {
    setFields(prev => applyPresetToFields(prev, preset));
    setShowPresets(false);
  }

  async function handleSave() {
    const catId = id;
    if (!catId) { showError('Cat is required'); return; }

    const validationError = validateCareItem(fields);
    if (validationError) { showError(validationError); return; }

    const payload = buildCareItemPayload(fields, catId);

    setSaving(true);
    setError(null);
    try {
      if (isEdit && medId) {
        await api.updateMedication(medId, payload);
      } else {
        await api.createMedication(payload);
      }
      router.replace(`/cats/${catId}?tab=care` as never);
    } catch (e: unknown) {
      showError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleArchive() {
    if (!medId) return;
    if (Platform.OS === 'web') {
      if (confirm(`Stop tracking ${fields.name}?`)) {
        doArchive();
      }
      return;
    }
    Alert.alert('Archive Care Item', `Stop tracking ${fields.name}? This will archive the schedule.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: doArchive },
    ]);
  }

  async function doArchive() {
    if (!medId) return;
    setArchiving(true);
    try {
      await api.archiveMedication(medId);
      router.back();
    } catch (e: unknown) {
      showError((e as Error).message);
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <ActivityIndicator color={colors.lavender} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.rim,
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingVertical: 8, paddingRight: 12 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: colors.lavender, fontSize: 15, fontWeight: '600' }}>{'\u2190'} Back</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700' }}>
            {isEdit ? 'Edit Care Item' : 'Add Care Item'}
          </Text>
          {cat && (
            <Text style={{ color: colors.inkDim, fontSize: 13, marginTop: 2 }}>
              for {cat?.name}
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(248,113,113,0.15)',
            borderWidth: 1.5,
            borderColor: 'rgba(248,113,113,0.4)',
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Text style={{ fontSize: 16 }}>{'\u26A0\uFE0F'}</Text>
            <Text style={{ color: colors.rose, fontSize: 14, fontWeight: '600', flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* Preset picker — shown by default when adding */}
        {!isEdit && (
          <View style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => setShowPresets((v) => !v)}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: colors.lavender,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: 'rgba(192,132,252,0.12)',
              }}
            >
              <Text style={{ fontSize: 16 }}>{'\uD83D\uDCCB'}</Text>
              <Text style={{ color: colors.lavender, fontSize: 15, fontWeight: '700' }}>
                {showPresets ? 'Hide common medications' : 'Start from a common medication'}
              </Text>
            </Pressable>

            {showPresets && (
              <View style={{
                marginTop: 8,
                borderRadius: 16,
                padding: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.rim,
              }}>
                {PRESET_CATEGORIES.map((cat) => {
                  const items = PRESETS.filter((p) => p.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <View key={cat} style={{ marginBottom: 12 }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: colors.inkDim,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        marginBottom: 6,
                        marginLeft: 4,
                      }}>
                        {cat}
                      </Text>
                      {items.map((p) => (
                        <Pressable
                          key={p.name}
                          onPress={() => applyPreset(p)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            minHeight: 44,
                          }}
                        >
                          <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                            {CARE_TYPE_ICONS[p.type] ?? '\uD83D\uDCC5'}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>
                              {p.name}
                            </Text>
                            <Text style={{ color: colors.inkDim, fontSize: 12, marginTop: 1 }}>
                              {formatFrequencyLabel(p.frequency, p.frequency_days)}
                              {p.notes ? ` · ${p.notes}` : ''}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Medication details + Schedule combined */}
        <SectionCard title="Details">
          <FieldLabel label="Name" />
          <StyledInput
            value={fields.name}
            onChangeText={v => setField("name", v)}
            placeholder="e.g. Revolution Plus"
            maxLength={200}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Type" />
              <PillPicker
                options={TYPE_OPTIONS}
                value={fields.type}
                onChange={v => setField("type", v)}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Dose" />
              <StyledInput
                value={fields.dose}
                onChangeText={v => setField("dose", v)}
                placeholder="e.g. 2.5mg"
                maxLength={100}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Frequency" />
              <PillPicker
                options={FREQ_OPTIONS}
                value={fields.frequency}
                onChange={v => setField("frequency", v)}
              />
            </View>
          </View>

          {fields.frequency === 'custom' && (
            <>
              <FieldLabel label={`Interval (every ${fields.frequencyDays || '?'} days)`} />
              <StyledInput
                value={fields.frequencyDays}
                onChangeText={v => setField("frequencyDays", v)}
                keyboardType="number-pad"
                placeholder="30"
              />
            </>
          )}

          <FieldLabel label="Notes" />
          <StyledInput
            value={fields.notes}
            onChangeText={v => setField("notes", v)}
            placeholder="e.g. Give with food"
            maxLength={1000}
            multiline
          />
        </SectionCard>

        {/* Schedule */}
        <SectionCard title="Schedule">
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Start date" />
              <DatePickerField
                value={fields.startDate}
                onChange={v => setField("startDate", v)}
                show={showStartPicker}
                onToggle={() => setShowStartPicker((v) => !v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Reminder time" />
              <Pressable
                onPress={() => setShowTimePicker((v) => !v)}
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: showTimePicker ? colors.lavender : colors.rim,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  minHeight: 44,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.ink, fontSize: 14 }}>
                  {formatHour(parseInt(fields.reminderTime.split(':')[0] ?? '9', 10), prefs)}
                </Text>
              </Pressable>
            </View>
          </View>
          {showTimePicker && (
            <ScrollView
              ref={timePickerRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4, paddingVertical: 8 }}
              onLayout={() => {
                const selectedHour = parseInt(fields.reminderTime.split(':')[0] ?? '9', 10);
                const pillWidth = 58;
                const offset = Math.max(0, selectedHour * pillWidth - 100);
                timePickerRef.current?.scrollTo({ x: offset, animated: false });
              }}
            >
              {Array.from({ length: 24 }, (_, i) => {
                const val = `${String(i).padStart(2, '0')}:00`;
                const active = fields.reminderTime === val;
                return (
                  <Pressable
                    key={i}
                    onPress={() => { setField("reminderTime", val); setShowTimePicker(false); }}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                      minHeight: 36, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: active ? 'rgba(192,132,252,0.15)' : colors.surface,
                      borderWidth: active ? 1 : 0, borderColor: 'rgba(192,132,252,0.25)',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? colors.lavender : colors.inkDim }}>
                      {formatHour(parseInt(val.split(':')[0] ?? '9', 10), prefs)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <FieldLabel label="Stop date (blank = ongoing)" />
          <DatePickerField
            value={fields.endDate}
            onChange={v => setField("endDate", v)}
            show={showEndPicker}
            onToggle={() => setShowEndPicker((v) => !v)}
            placeholder="No end date"
            allowClear
          />

          <FieldLabel label="Course length (total doses, blank = ongoing)" />
          <StyledInput
            value={fields.dosesTotal}
            onChangeText={v => setField("dosesTotal", v)}
            keyboardType="number-pad"
            placeholder="e.g. 14 for a 14-day course"
          />
        </SectionCard>

        {/* Stock tracking */}
        <SectionCard title="Stock tracking (optional)">
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="In stock" />
              <StyledInput
                value={fields.dosesRemaining}
                onChangeText={v => setField("dosesRemaining", v)}
                keyboardType="number-pad"
                placeholder="e.g. 3"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Refill alert at" />
              <StyledInput
                value={fields.refillThreshold}
                onChangeText={v => setField("refillThreshold", v)}
                keyboardType="number-pad"
                placeholder="e.g. 2"
              />
            </View>
          </View>
        </SectionCard>

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={saving || archiving}
          style={{
            backgroundColor: saving ? 'rgba(192,132,252,0.5)' : colors.lavender,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            marginTop: 8,
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.night, fontSize: 15, fontWeight: '700' }}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Care Item'}
          </Text>
        </Pressable>

        {/* Archive button */}
        {isEdit && (
          <Pressable
            onPress={handleArchive}
            disabled={saving || archiving}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
              marginTop: 8,
              backgroundColor: 'rgba(248,113,113,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.2)',
              minHeight: 48,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.rose, fontSize: 15, fontWeight: '600' }}>
              {archiving ? 'Archiving...' : 'Archive medication'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DatePickerField({
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  allowClear,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const colors = useThemeColors();
  const dateValue = value ? parseDate(value) : new Date();

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onToggle}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: show ? colors.lavender : colors.rim,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{
            fontSize: 14,
            color: value ? colors.ink : colors.inkDim,
          }}>
            {value || placeholder || 'Select date'}
          </Text>
        </Pressable>
        {allowClear && value ? (
          <Pressable
            onPress={() => { onChange(''); onToggle(); }}
            style={{
              justifyContent: 'center',
              paddingHorizontal: 12,
              minHeight: 44,
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: colors.inkDim, fontSize: 13 }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant="dark"
          onChange={(_event, selected) => {
            if (Platform.OS === 'android') onToggle();
            if (selected) onChange(formatDate(selected));
          }}
          style={{ marginTop: 4 }}
        />
      )}
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={{
      backgroundColor: 'rgba(192,132,252,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(192,132,252,0.12)',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      gap: 12,
    }}>
      <Text style={{
        fontSize: 11,
        fontWeight: '700',
        color: colors.inkMid,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  const colors = useThemeColors();
  return (
    <Text style={{
      fontSize: 11,
      fontWeight: '600',
      color: colors.inkDim,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}>
      {label}
    </Text>
  );
}

function StyledInput(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={colors.inkDim}
      maxLength={props.maxLength}
      keyboardType={props.keyboardType ?? 'default'}
      multiline={props.multiline}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.rim,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.ink,
        minHeight: props.multiline ? 60 : 44,
        textAlignVertical: props.multiline ? 'top' : undefined,
      }}
    />
  );
}

function PillPicker({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 16,
              backgroundColor: active ? 'rgba(192,132,252,0.2)' : colors.surface,
              borderWidth: 1,
              borderColor: active ? 'rgba(192,132,252,0.4)' : colors.rim,
              minHeight: 36,
              justifyContent: 'center',
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: active ? '600' : '400',
              color: active ? colors.lavender : colors.inkMid,
            }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
