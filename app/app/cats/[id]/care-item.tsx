import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, CARE_TYPE_ICONS } from '../../../lib/api';
import type { Cat, Medication } from '../../../lib/api';

const colors = {
  night: '#16111f',
  surface: '#1f1830',
  surfaceHi: '#2a2040',
  lavender: '#c084fc',
  ink: '#ede9f6',
  inkMid: '#a899c0',
  inkDim: '#6b5f85',
  rim: 'rgba(255,255,255,0.07)',
  rose: '#f87171',
};

interface Preset {
  name: string;
  type: string;
  frequency: string;
  frequency_days?: number;
  notes?: string;
}

const PRESETS: Preset[] = [
  { name: 'Revolution Plus', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical - part fur between shoulder blades' },
  { name: 'Advantage Multi', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical' },
  { name: 'Frontline Plus', type: 'flea', frequency: 'custom', frequency_days: 30, notes: 'Topical' },
  { name: 'Heartgard Plus', type: 'heartworm', frequency: 'monthly', notes: 'Oral chew - give with food' },
  { name: 'Interceptor Plus', type: 'heartworm', frequency: 'monthly', notes: 'Oral' },
  { name: 'Methimazole', type: 'pill', frequency: 'twice_daily', notes: 'Hyperthyroid - give with food' },
  { name: 'Prednisolone', type: 'pill', frequency: 'daily', notes: 'Steroid - give with food' },
  { name: 'Gabapentin', type: 'pill', frequency: 'daily', notes: 'Pain/anxiety' },
  { name: 'Dewormer', type: 'other', frequency: 'custom', frequency_days: 90 },
  { name: 'FVRCP vaccine', type: 'vaccine', frequency: 'custom', frequency_days: 1095 },
  { name: 'Rabies vaccine', type: 'vaccine', frequency: 'custom', frequency_days: 1095 },
  { name: 'Annual exam', type: 'exam', frequency: 'custom', frequency_days: 365 },
  { name: 'Dental cleaning', type: 'dental', frequency: 'custom', frequency_days: 365 },
];

const FREQ_OPTIONS: { value: string; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom interval' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'flea', label: 'Flea/Tick prevention' },
  { value: 'heartworm', label: 'Heartworm prevention' },
  { value: 'pill', label: 'Pill / Oral medication' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'supplement', label: 'Supplement' },
  { value: 'dental', label: 'Dental cleaning' },
  { value: 'exam', label: 'Vet exam / Checkup' },
  { value: 'bloodwork', label: 'Bloodwork / Lab work' },
  { value: 'surgery', label: 'Surgery / Procedure' },
  { value: 'other', label: 'Other' },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CareItemScreen() {
  const { id, medId } = useLocalSearchParams<{ id: string; medId?: string }>();
  const router = useRouter();
  const isEdit = Boolean(medId);

  const [cat, setCat] = useState<Cat | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

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
        setError((e as Error).message);
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
      setError('Name is required');
      return;
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }
    const catId = id;
    if (!catId) {
      setError('Cat is required');
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
      setError((e as Error).message);
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
      setError((e as Error).message);
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
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.lavender, fontSize: 15 }}>{'\u2190'} Back</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(248,113,113,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(248,113,113,0.2)',
            marginBottom: 16,
          }}>
            <Text style={{ color: colors.rose, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Preset picker */}
        {!isEdit && (
          <View style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => setShowPresets((v) => !v)}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: 'rgba(192,132,252,0.3)',
                alignItems: 'center',
                backgroundColor: 'rgba(192,132,252,0.04)',
              }}
            >
              <Text style={{ color: colors.lavender, fontSize: 14, fontWeight: '600' }}>
                {showPresets ? 'Hide presets' : 'Choose a preset medication'}
              </Text>
            </Pressable>

            {showPresets && (
              <View style={{
                marginTop: 8,
                borderRadius: 16,
                padding: 8,
                backgroundColor: 'rgba(192,132,252,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(192,132,252,0.15)',
              }}>
                {PRESETS.map((p) => (
                  <Pressable
                    key={p.name}
                    onPress={() => applyPreset(p)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>
                      {CARE_TYPE_ICONS[p.type] ?? ''} {p.name}
                    </Text>
                    <Text style={{ color: colors.inkDim, fontSize: 12, marginTop: 2 }}>
                      {FREQ_OPTIONS.find((f) => f.value === p.frequency)?.label ?? p.frequency}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Medication details */}
        <SectionCard title="Medication">
          <FieldLabel label="Name" />
          <StyledInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Revolution Plus"
            maxLength={200}
          />

          <FieldLabel label="Type" />
          <PillPicker
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />

          <FieldLabel label="Dose amount" />
          <StyledInput
            value={dose}
            onChangeText={setDose}
            placeholder="e.g. 2.5mg or 1 tube"
            maxLength={100}
          />

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
          <FieldLabel label="Frequency" />
          <PillPicker
            options={FREQ_OPTIONS}
            value={frequency}
            onChange={setFrequency}
          />

          {frequency === 'custom' && (
            <>
              <FieldLabel label="Every N days" />
              <StyledInput
                value={frequencyDays}
                onChangeText={setFrequencyDays}
                keyboardType="number-pad"
                placeholder="30"
              />
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Start date" />
              <StyledInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
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
          <StyledInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
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
          <FieldLabel label="Doses currently in stock" />
          <StyledInput
            value={dosesRemaining}
            onChangeText={setDosesRemaining}
            keyboardType="number-pad"
            placeholder="e.g. 3"
          />

          <FieldLabel label="Refill alert threshold" />
          <StyledInput
            value={refillThreshold}
            onChangeText={setRefillThreshold}
            keyboardType="number-pad"
            placeholder="e.g. 2"
          />
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
            }}
          >
            <Text style={{ color: colors.rose, fontSize: 15, fontWeight: '600' }}>
              {archiving ? 'Archiving...' : 'Archive medication'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
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
        minHeight: props.multiline ? 60 : undefined,
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
              paddingVertical: 7,
              borderRadius: 16,
              backgroundColor: active ? 'rgba(192,132,252,0.2)' : colors.surface,
              borderWidth: 1,
              borderColor: active ? 'rgba(192,132,252,0.4)' : colors.rim,
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
