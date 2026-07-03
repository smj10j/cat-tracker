import { View, Text, Pressable } from 'react-native';
import { BCS_PRESETS, BCS_BAND_LABELS, getBcsPreset } from '@shared/lib/measurementPresets';
import { useThemeColors } from '../hooks/useThemeColors';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface Props {
  /** Currently selected score (1–9), or null when nothing is chosen. */
  value: number | null;
  /** Called with the tapped score. */
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Nine-segment Body Condition Score picker (WSAVA 9-point scale) — native mirror
 * of frontend/src/components/BcsPicker.tsx.
 *
 * CLINICAL CONTENT: the only evaluative words rendered here are the transcribed
 * band label (BCS_BAND_LABELS) and the verbatim WSAVA description/note carried by
 * the shared BCS_PRESETS — no authored judgment copy, no band-based color coding
 * (every segment uses the same brand styling). See docs/research/body-condition.md.
 */
export default function BcsPicker({ value, onChange, disabled }: Props) {
  const colors = useThemeColors();
  const { screenWidth } = useResponsiveLayout();
  const selected = value != null ? getBcsPreset(value) : undefined;

  // One row of nine on wider layouts; 3×3 grid at narrow (iPhone) widths.
  const perRow = screenWidth >= 520 ? 9 : 3;
  const rows: (typeof BCS_PRESETS)[] = [];
  for (let i = 0; i < BCS_PRESETS.length; i += perRow) {
    rows.push(BCS_PRESETS.slice(i, i + perRow));
  }

  return (
    <View>
      {/* Header row: label + scale caption */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkMid, textTransform: 'uppercase', letterSpacing: 1, flexShrink: 1 }}>
          Body Condition
        </Text>
        <Text style={{ fontSize: 11, color: colors.inkDim, flexShrink: 0 }}>9-point body condition scale</Text>
      </View>

      {/* Nine tappable segments, 1→9 */}
      <View style={{ gap: 8 }}>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: perRow === 9 ? 6 : 8 }}>
            {row.map((preset) => {
              const isSelected = value === preset.value;
              return (
                <Pressable
                  key={preset.value}
                  onPress={() => onChange(preset.value)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Score ${preset.value} of 9`}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? 'rgba(192,132,252,0.15)' : colors.card,
                    borderWidth: isSelected ? 1.5 : 1,
                    borderColor: isSelected ? 'rgba(192,132,252,0.5)' : colors.rim,
                    shadowColor: '#c084fc',
                    shadowOpacity: isSelected ? 0.25 : 0,
                    shadowRadius: isSelected ? 8 : 0,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: isSelected ? colors.lavender : colors.ink,
                    }}
                  >
                    {preset.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Chosen score's transcribed WSAVA meaning (shown only once selected) */}
      {selected && (
        <View
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.rim,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.lavender }}>{selected.value}/9</Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: 'rgba(192,132,252,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(192,132,252,0.25)',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.lavender }}>
                {BCS_BAND_LABELS[selected.band]}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.inkMid }}>{selected.description}</Text>
          {selected.note && (
            <Text style={{ fontSize: 12, lineHeight: 17, color: colors.inkDim, fontStyle: 'italic', marginTop: 6 }}>
              {selected.note}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
