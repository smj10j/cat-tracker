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

interface Preset {
  name: string;
  type: string;
  frequency: string;
  frequency_days?: number;
  notes?: string;
  category: string;
}

const PRESETS: Preset[] = [
  // Flea/Tick/Heartworm prevention
  { name: 'Revolution', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical - part fur between shoulder blades', category: 'Prevention' },
  { name: 'Revolution Plus', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical - part fur between shoulder blades', category: 'Prevention' },
  { name: 'Bravecto', type: 'flea', frequency: 'custom', frequency_days: 84, notes: 'Topical - lasts 12 weeks', category: 'Prevention' },
  { name: 'Advantage Multi', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical', category: 'Prevention' },
  { name: 'Frontline Plus', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical', category: 'Prevention' },
  { name: 'Heartgard Plus', type: 'heartworm', frequency: 'monthly', notes: 'Oral chew - give with food', category: 'Prevention' },
  { name: 'Interceptor Plus', type: 'heartworm', frequency: 'monthly', notes: 'Oral', category: 'Prevention' },

  // Common medications
  { name: 'Methimazole', type: 'pill', frequency: 'twice_daily', notes: 'Hyperthyroid - give with food', category: 'Medication' },
  { name: 'Prednisolone', type: 'pill', frequency: 'daily', notes: 'Steroid - give with food', category: 'Medication' },
  { name: 'Gabapentin', type: 'pill', frequency: 'daily', notes: 'Pain/anxiety', category: 'Medication' },
  { name: 'Cerenia', type: 'pill', frequency: 'daily', notes: 'Anti-nausea', category: 'Medication' },
  { name: 'Onsior', type: 'pill', frequency: 'daily', notes: 'NSAID pain relief - max 6 days', category: 'Medication' },
  { name: 'Mirataz', type: 'other', frequency: 'daily', notes: 'Transdermal - inner ear - appetite stimulant', category: 'Medication' },
  { name: 'Dewormer', type: 'other', frequency: 'custom', frequency_days: 90, category: 'Medication' },

  // Supplements
  { name: 'Lysine', type: 'supplement', frequency: 'daily', notes: 'Immune support', category: 'Supplement' },
  { name: 'Cobalamin (B12)', type: 'supplement', frequency: 'weekly', notes: 'GI support', category: 'Supplement' },
  { name: 'Fortiflora', type: 'supplement', frequency: 'daily', notes: 'Probiotic - sprinkle on food', category: 'Supplement' },

  // Vet visits
  { name: 'FVRCP vaccine', type: 'vaccine', frequency: 'custom', frequency_days: 1095, category: 'Vet' },
  { name: 'Rabies vaccine', type: 'vaccine', frequency: 'custom', frequency_days: 1095, category: 'Vet' },
  { name: 'Annual exam', type: 'exam', frequency: 'custom', frequency_days: 365, category: 'Vet' },
  { name: 'Dental cleaning', type: 'dental', frequency: 'custom', frequency_days: 365, category: 'Vet' },
  { name: 'Bloodwork', type: 'bloodwork', frequency: 'custom', frequency_days: 365, notes: 'Annual screening', category: 'Vet' },
];

const PRESET_CATEGORIES = ['Prevention', 'Medication', 'Supplement', 'Vet'];

function formatFrequencyLabel(frequency: string, frequencyDays?: number): string {
  if (frequency === 'custom' && frequencyDays) {
    if (frequencyDays === 365) return 'Yearly';
    if (frequencyDays === 1095) return 'Every 3 years';
    if (frequencyDays >= 7 && frequencyDays % 7 === 0) return `Every ${frequencyDays / 7} weeks`;
    return `Every ${frequencyDays} days`;
  }
  const labels: Record<string, string> = {
    daily: 'Daily', twice_daily: 'Twice daily', weekly: 'Weekly', monthly: 'Monthly',
  };
  return labels[frequency] ?? frequency;
}

const FREQ_OPTIONS: { value: string; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom interval' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'flea', label: 'Flea/Tick' },
  { value: 'heartworm', label: 'Heartworm' },
  { value: 'pill', label: 'Oral med' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'supplement', label: 'Supplement' },
  { value: 'dental', label: 'Dental' },
  { value: 'exam', label: 'Vet exam' },
  { value: 'bloodwork', label: 'Bloodwork' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'other', label: 'Other' },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CareItemScreen() {
  const colors = useThemeColors();
  const { id, medId } = useLocalSearchParams<{ id: string; medId?: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const isEdit = Boolean(medId);

  const [cat, setCat] = useState<Cat | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  // Date picker state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState('other');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [frequencyDays, setFrequencyDays] = useState('30');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState('');
  const [dosesTotal, setDosesTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [dosesRemaining, setDosesRemaining] = useState('');
  const [refillThreshold, setRefillThreshold] = useState('');

  function showError(msg: string) {
    setError(msg);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (Platform.OS !== 'web') {
      Alert.alert('Error', msg);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (isEdit && medId) {
          const med = await api.getMedication(medId);
          setName(med.name);
          setType(med.type);
          setDose(med.dose ?? '');
          setFrequency(med.frequency);
          setFrequencyDays(String(med.frequency_days ?? 30));
          setReminderTime(med.reminder_time);
          setStartDate(med.start_date);
          setEndDate(med.end_date ?? '');
          setDosesTotal(med.doses_total != null ? String(med.doses_total) : '');
          setNotes(med.notes ?? '');
          setDosesRemaining(med.doses_remaining != null ? String(med.doses_remaining) : '');
          setRefillThreshold(med.refill_alert_threshold != null ? String(med.refill_alert_threshold) : '');
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

  function applyPreset(preset: Preset) {
    setName(preset.name);
    setType(preset.type);
    setFrequency(preset.frequency);
    if (preset.frequency_days) setFrequencyDays(String(preset.frequency_days));
    if (preset.notes) setNotes(preset.notes);
    setShowPresets(false);
  }

  async function handleSave() {
    if (!name.trim()) {
      showError('Name is required');
      return;
    }
    if (!startDate) {
      showError('Start date is required');
      return;
    }
    const catId = id;
    if (!catId) {
      showError('Cat is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        cat_id: catId,
        name: name.trim(),
        type,
        dose: dose.trim() || null,
        frequency,
        frequency_days: frequency === 'custom' ? parseInt(frequencyDays, 10) || null : null,
        reminder_time: reminderTime,
        start_date: startDate,
        end_date: endDate || null,
        doses_total: dosesTotal ? parseInt(dosesTotal, 10) || null : null,
        notes: notes.trim() || null,
        doses_remaining: dosesRemaining ? parseInt(dosesRemaining, 10) || null : null,
        refill_alert_threshold: refillThreshold ? parseInt(refillThreshold, 10) || null : null,
      };

      if (isEdit && medId) {
        await api.updateMedication(medId, payload);
      } else {
        await api.createMedication(payload);
      }
      router.back();
    } catch (e: unknown) {
      showError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleArchive() {
    if (!medId) return;
    if (Platform.OS === 'web') {
      if (confirm(`Stop tracking ${name}?`)) {
        doArchive();
      }
      return;
    }
    Alert.alert('Archive Care Item', `Stop tracking ${name}? This will archive the schedule.`, [
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.lavender} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
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
              for {cat.name}
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
            value={name}
            onChangeText={setName}
            placeholder="e.g. Revolution Plus"
            maxLength={200}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Type" />
              <PillPicker
                options={TYPE_OPTIONS}
                value={type}
                onChange={setType}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Dose" />
              <StyledInput
                value={dose}
                onChangeText={setDose}
                placeholder="e.g. 2.5mg"
                maxLength={100}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Frequency" />
              <PillPicker
                options={FREQ_OPTIONS}
                value={frequency}
                onChange={setFrequency}
              />
            </View>
          </View>

          {frequency === 'custom' && (
            <>
              <FieldLabel label={`Interval (every ${frequencyDays || '?'} days)`} />
              <StyledInput
                value={frequencyDays}
                onChangeText={setFrequencyDays}
                keyboardType="number-pad"
                placeholder="30"
              />
            </>
          )}

          <FieldLabel label="Notes" />
          <StyledInput
            value={notes}
            onChangeText={setNotes}
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
                value={startDate}
                onChange={setStartDate}
                show={showStartPicker}
                onToggle={() => setShowStartPicker((v) => !v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Reminder time" />
              <StyledInput
                value={reminderTime}
                onChangeText={setReminderTime}
                placeholder="09:00"
              />
            </View>
          </View>

          <FieldLabel label="Stop date (blank = ongoing)" />
          <DatePickerField
            value={endDate}
            onChange={setEndDate}
            show={showEndPicker}
            onToggle={() => setShowEndPicker((v) => !v)}
            placeholder="No end date"
            allowClear
          />

          <FieldLabel label="Course length (total doses, blank = ongoing)" />
          <StyledInput
            value={dosesTotal}
            onChangeText={setDosesTotal}
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
                value={dosesRemaining}
                onChangeText={setDosesRemaining}
                keyboardType="number-pad"
                placeholder="e.g. 3"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Refill alert at" />
              <StyledInput
                value={refillThreshold}
                onChangeText={setRefillThreshold}
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
