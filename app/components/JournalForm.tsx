import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../lib/api';
import type { JournalEntry } from '../lib/api';
import { useThemeColors } from '../hooks/useThemeColors';
import { usePreferences } from '../contexts/PreferencesContext';
import { VALID_JOURNAL_TAGS, JOURNAL_TAG_LABELS, LIMITS } from '@shared/lib/constants';
import {
  buildMeasuredAt, formatHour, formatDayLabel, todayLocalDate, currentHour,
} from '@shared/lib/formatting';
import { parseDate, formatDateStr } from '../lib/dateHelpers';

interface Props {
  mode: 'create' | 'edit';
  /** Required in create mode. */
  catId?: string;
  /** Required in edit mode — prefills the form. */
  entry?: JournalEntry;
  onSaved: (entry: JournalEntry) => void;
  onCancel: () => void;
  /** Edit mode only. */
  onDeleted?: (entryId: string) => void;
}

function localHourFromISO(iso: string): number {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? currentHour() : d.getHours();
}

function localDateFromISO(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? todayLocalDate() : formatDateStr(d);
}

/**
 * Inline create/edit form for an observations-journal entry (PRD-notes-journal,
 * Phase A). Photos are out of scope. Backdatable via the same date + hour picker
 * pattern the Daily Check-In uses.
 */
export default function JournalForm({ mode, catId, entry, onSaved, onCancel, onDeleted }: Props) {
  const colors = useThemeColors();
  const { prefs } = usePreferences();

  const [text, setText] = useState(entry?.text ?? '');
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [date, setDate] = useState(entry ? localDateFromISO(entry.occurred_at) : todayLocalDate());
  const [hour, setHour] = useState(entry ? localHourFromISO(entry.occurred_at) : currentHour());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && !saving;

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const occurred_at = buildMeasuredAt(date, hour);
    const payloadTags = tags.length > 0 ? tags : null;
    try {
      let result: JournalEntry;
      if (mode === 'edit' && entry) {
        result = await api.updateJournalEntry(entry.id, { occurred_at, text: trimmed, tags: payloadTags });
      } else if (catId) {
        result = await api.createJournalEntry(catId, { occurred_at, text: trimmed, tags: payloadTags });
      } else {
        throw new Error('Missing target');
      }
      onSaved(result);
    } catch {
      setError("Couldn't save your note. Check your connection and try again.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteJournalEntry(entry.id);
      onDeleted?.(entry.id);
    } catch {
      setError("Couldn't delete this note. Try again.");
      setSaving(false);
    }
  }

  return (
    <View
      style={{
        borderRadius: 16,
        padding: 16,
        backgroundColor: 'rgba(192,132,252,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(192,132,252,0.2)',
        gap: 14,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600', fontSize: 15, color: colors.ink }}>
          {mode === 'edit' ? '📝 Edit note' : '📝 New note'}
        </Text>
        <Pressable
          onPress={onCancel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.inkDim, fontSize: 22 }}>{'×'}</Text>
        </Pressable>
      </View>

      {error && (
        <View style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 8, padding: 8 }}>
          <Text style={{ color: colors.rose, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* Text */}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="What did you observe? (e.g. hid under the bed most of the day)"
        placeholderTextColor={colors.inkDim}
        multiline
        maxLength={LIMITS.JOURNAL_TEXT}
        textAlignVertical="top"
        style={{
          minHeight: 96,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.rim,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.ink,
          fontSize: 15,
          lineHeight: 21,
        }}
      />
      <Text style={{ fontSize: 11, color: colors.inkDim, textAlign: 'right', marginTop: -8 }}>
        {text.length}/{LIMITS.JOURNAL_TEXT}
      </Text>

      {/* Tags */}
      <View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Tags {'—'} optional
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {VALID_JOURNAL_TAGS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  minHeight: 36,
                  justifyContent: 'center',
                  backgroundColor: selected ? 'rgba(192,132,252,0.18)' : colors.card,
                  borderWidth: 1,
                  borderColor: selected ? 'rgba(192,132,252,0.4)' : colors.rim,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: selected ? '700' : '500', color: selected ? colors.lavender : colors.inkDim }}>
                  {JOURNAL_TAG_LABELS[tag] ?? tag}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* When */}
      <View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          When
        </Text>
        <Pressable
          onPress={() => setShowDatePicker((v) => !v)}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: showDatePicker ? colors.lavender : colors.rim,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 10,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500' }}>
            {formatDayLabel(date, prefs)}
            {date !== todayLocalDate() && (
              <Text style={{ color: colors.inkDim, fontWeight: '400' }}>  {date}</Text>
            )}
          </Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={parseDate(date)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            maximumDate={new Date()}
            onChange={(_event, selected) => {
              if (Platform.OS === 'android') setShowDatePicker(false);
              if (selected) setDate(formatDateStr(selected));
            }}
            style={{ marginBottom: 4 }}
          />
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
          {Array.from({ length: 24 }, (_, i) => i).map((h) => (
            <Pressable
              key={h}
              onPress={() => setHour(h)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                minHeight: 36,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hour === h ? 'rgba(192,132,252,0.15)' : 'transparent',
                borderWidth: hour === h ? 1 : 0,
                borderColor: 'rgba(192,132,252,0.25)',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: hour === h ? colors.lavender : colors.inkDim }}>
                {formatHour(h, prefs)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Save */}
      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        style={{
          backgroundColor: colors.lavender,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          opacity: canSave ? 1 : 0.5,
        }}
      >
        <Text style={{ color: colors.brandOn, fontWeight: '600', fontSize: 14 }}>
          {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save note'}
        </Text>
      </Pressable>

      {/* Delete (edit only) */}
      {mode === 'edit' &&
        (confirmDelete ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setConfirmDelete(false)}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rim }}
            >
              <Text style={{ color: colors.inkDim, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              disabled={saving}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)', opacity: saving ? 0.6 : 1 }}
            >
              <Text style={{ color: colors.rose, fontSize: 13, fontWeight: '700' }}>Delete note</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmDelete(true)} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ color: 'rgba(248,113,113,0.7)', fontSize: 13 }}>Delete</Text>
          </Pressable>
        ))}
    </View>
  );
}
