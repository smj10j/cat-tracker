import { View, Text, Pressable } from 'react-native';
import type { JournalEntry } from '../lib/api';
import { useThemeColors } from '../hooks/useThemeColors';
import { usePreferences } from '../contexts/PreferencesContext';
import { formatTime } from '@shared/lib/preferences';
import { JOURNAL_TAG_LABELS } from '@shared/lib/constants';

interface Props {
  entry: JournalEntry;
  onPress: () => void;
  showBorder?: boolean;
}

/**
 * A single observations-journal row in the History timeline (PRD-notes-journal,
 * Phase A). Visually distinct from measurement rows: 📝 icon, first ~2 lines of
 * text, tag chips, and author name when a household has multiple members.
 * Tapping opens the inline edit form.
 */
export default function JournalRow({ entry, onPress, showBorder = true }: Props) {
  const colors = useThemeColors();
  const { prefs } = usePreferences();
  const tags = entry.tags ?? [];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Edit observation"
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 10,
        alignItems: 'flex-start',
        borderBottomWidth: showBorder ? 1 : 0,
        borderBottomColor: colors.card,
      }}
    >
      <Text style={{ color: colors.inkDim, fontSize: 12, width: 64, flexShrink: 0, paddingTop: 2 }}>
        {formatTime(entry.occurred_at, prefs)}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Text style={{ fontSize: 13, paddingTop: 1 }}>📝</Text>
          <Text style={{ flex: 1, fontSize: 14, color: colors.ink, lineHeight: 19 }} numberOfLines={2}>
            {entry.text}
          </Text>
        </View>
        {tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, marginLeft: 20 }}>
            {tags.map((tag) => (
              <View
                key={tag}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: 'rgba(192,132,252,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(192,132,252,0.25)',
                }}
              >
                <Text style={{ fontSize: 10, color: colors.lavender, fontWeight: '600' }}>
                  {JOURNAL_TAG_LABELS[tag] ?? tag}
                </Text>
              </View>
            ))}
          </View>
        )}
        {entry.author_name ? (
          <Text style={{ fontSize: 11, color: colors.inkDim, marginTop: 4, marginLeft: 20 }}>
            {'—'} {entry.author_name}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: colors.inkDim, fontSize: 13, paddingTop: 2 }}>{'›'}</Text>
    </Pressable>
  );
}
