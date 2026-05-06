import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api, CARE_TYPE_ICONS } from '../../../lib/api';
import type { Cat, Medication } from '../../../lib/api';
import { catAge } from '@shared/lib/dates';
import { formatSexNeuter, formatTimeFromParts, formatFreqShort } from '@shared/lib/formatting';
import { isAsNeeded } from '@shared/lib/constants';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { ResponsiveContainer } from '../../../components/ResponsiveContainer';
import { usePreferences } from '../../../contexts/PreferencesContext';
import CatAvatar from '../../../components/CatAvatar';

/**
 * Sitter view (iOS) — read-only summary mirroring the web /cats/:id/sitter page.
 * The Share button renders the same content into a PDF and opens the native share
 * sheet so the owner can send it through Messages / Mail / AirDrop / Notes.
 */
export default function SitterScreen() {
  const colors = useThemeColors();
  const { rv } = useResponsiveLayout();
  const { prefs } = usePreferences();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [cat, setCat] = useState<Cat | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getCat(id), api.getMedications(id)])
      .then(([c, m]) => { setCat(c); setMeds(m); })
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.inkMid, fontSize: 14 }}>Loading sitter view…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !cat) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: colors.rose, fontSize: 14 }}>{error ?? 'Cat not found'}</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.lavender, fontSize: 15 }}>{'←'} Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const scheduled = meds.filter((m) => !isAsNeeded(m.frequency));
  const asNeeded = meds.filter((m) => isAsNeeded(m.frequency));

  const groups = new Map<string, Medication[]>();
  for (const m of scheduled) {
    const key = m.reminder_time || '09:00';
    const bucket = groups.get(key) ?? [];
    bucket.push(m);
    groups.set(key, bucket);
  }
  const orderedTimes = [...groups.keys()].sort();

  async function handleShare() {
    if (!cat) return;
    setSharing(true);
    try {
      const html = buildSitterHtml(cat, scheduled, asNeeded, orderedTimes, groups, prefs);
      const { uri } = await Print.printToFileAsync({ html });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'This device cannot open the share sheet.');
        return;
      }
      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `${cat.name} — sitter view`,
      });
    } catch (e) {
      Alert.alert('Could not share', (e as Error).message);
    } finally {
      setSharing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
      {/* Top bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.rim,
        }}
      >
        <Pressable onPress={() => router.push(`/cats/${cat.id}?tab=care` as never)}>
          <Text style={{ color: colors.lavender, fontSize: 15 }}>
            {'←'} Back to {cat.name}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          accessibilityLabel="Share sitter view"
          style={{
            backgroundColor: sharing ? colors.surfaceHi : colors.lavender,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            opacity: sharing ? 0.7 : 1,
          }}
        >
          <Text style={{ color: sharing ? colors.inkDim : colors.night, fontSize: 13, fontWeight: '600' }}>
            {sharing ? 'Preparing…' : 'Share'}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <ResponsiveContainer style={{ paddingTop: 16 }}>
          {/* Cat header card */}
          <Card colors={colors}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <CatAvatar photoUrl={cat.photo_url} name={cat.name} size={rv(80, 96)} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: rv(22, 26), fontWeight: '700', color: colors.ink }} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.inkDim, marginTop: 4 }}>
                  {catAge(cat.birthdate)} {'·'} {formatSexNeuter(cat.sex, cat.is_neutered)}
                </Text>
                {cat.breed ? (
                  <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>
                    {cat.breed}{cat.coloring ? ` · ${cat.coloring}` : ''}
                  </Text>
                ) : null}
                {cat.microchip_id && !cat.microchip_id.startsWith('temp-microchip-id-') ? (
                  <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2, fontFamily: 'Menlo' }}>
                    Chip: {cat.microchip_id.replace(/(.{3})/g, '$1 ').trim()}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>

          {/* Daily schedule */}
          <Card colors={colors}>
            <SectionLabel colors={colors}>Daily Schedule</SectionLabel>
            {scheduled.length === 0 ? (
              <Text style={{ fontSize: 13, color: colors.inkDim }}>No scheduled medications.</Text>
            ) : (
              <View style={{ gap: 14 }}>
                {orderedTimes.map((time) => {
                  const items = groups.get(time)!;
                  return (
                    <View key={time}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.lavender, marginBottom: 6 }}>
                        {formatTimeFromParts(time, prefs)}
                      </Text>
                      <View style={{ gap: 8, paddingLeft: 4 }}>
                        {items.map((med) => (
                          <View key={med.id} style={{ flexDirection: 'row', gap: 10 }}>
                            <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
                              {CARE_TYPE_ICONS[med.type] ?? '📅'}
                            </Text>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ fontSize: 14, color: colors.ink }}>
                                <Text style={{ fontWeight: '600' }}>{med.name}</Text>
                                {med.dose ? <Text style={{ color: colors.inkDim }}> {'—'} {med.dose}</Text> : null}
                                {med.frequency !== 'daily' ? (
                                  <Text style={{ color: colors.inkDim, fontSize: 12 }}>
                                    {' '}({formatFreqShort(med.frequency, med.frequency_days)})
                                  </Text>
                                ) : null}
                              </Text>
                              {med.notes ? (
                                <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>{med.notes}</Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {/* As needed */}
          {asNeeded.length > 0 ? (
            <Card colors={colors}>
              <SectionLabel colors={colors}>
                As Needed{' '}
                <Text style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: colors.inkDim }}>
                  {'— only if triggered'}
                </Text>
              </SectionLabel>
              <View style={{ gap: 12 }}>
                {asNeeded.map((med) => (
                  <View key={med.id} style={{ flexDirection: 'row', gap: 10 }}>
                    <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
                      {CARE_TYPE_ICONS[med.type] ?? '📅'}
                    </Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 14, color: colors.ink }}>
                        <Text style={{ fontWeight: '600' }}>{med.name}</Text>
                        {med.dose ? <Text style={{ color: colors.inkDim }}> {'—'} {med.dose}</Text> : null}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.inkDim, marginTop: 2 }}>
                        {med.notes ? (
                          <>
                            <Text style={{ fontWeight: '600' }}>Give if:</Text> {med.notes}
                          </>
                        ) : (
                          'As needed'
                        )}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Care notes */}
          {cat.notes ? (
            <Card colors={colors}>
              <SectionLabel colors={colors}>Care Notes</SectionLabel>
              <Text style={{ fontSize: 14, color: colors.ink, lineHeight: 20 }}>{cat.notes}</Text>
            </Card>
          ) : null}

          <Text style={{ fontSize: 10, color: colors.inkDim, textAlign: 'center', marginTop: 8 }}>
            Whisker Health {'·'} sitter view
          </Text>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.rim,
        padding: 18,
        marginBottom: 12,
      }}
    >
      {children}
    </View>
  );
}

function SectionLabel({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: colors.inkMid,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSitterHtml(
  cat: Cat,
  scheduled: Medication[],
  asNeeded: Medication[],
  orderedTimes: string[],
  groups: Map<string, Medication[]>,
  prefs: import('../../../../shared/lib/preferences').UserPreferences,
): string {
  const headerSubtitle = `${escapeHtml(catAge(cat.birthdate))} · ${escapeHtml(formatSexNeuter(cat.sex, cat.is_neutered))}`;
  const breedLine = cat.breed
    ? `<p class="meta">${escapeHtml(cat.breed)}${cat.coloring ? ` · ${escapeHtml(cat.coloring)}` : ''}</p>`
    : '';
  const chipLine =
    cat.microchip_id && !cat.microchip_id.startsWith('temp-microchip-id-')
      ? `<p class="meta mono">Chip: ${escapeHtml(cat.microchip_id.replace(/(.{3})/g, '$1 ').trim())}</p>`
      : '';

  const scheduleHtml =
    scheduled.length === 0
      ? '<p class="meta">No scheduled medications.</p>'
      : orderedTimes
          .map((time) => {
            const items = groups.get(time)!;
            const rows = items
              .map((m) => {
                const icon = CARE_TYPE_ICONS[m.type] ?? '📅';
                const dose = m.dose ? ` <span class="dim">— ${escapeHtml(m.dose)}</span>` : '';
                const freq =
                  m.frequency !== 'daily'
                    ? ` <span class="dim small">(${escapeHtml(formatFreqShort(m.frequency, m.frequency_days))})</span>`
                    : '';
                const notes = m.notes ? `<p class="notes">${escapeHtml(m.notes)}</p>` : '';
                return `<div class="row"><span class="icon">${icon}</span><div class="body"><p><strong>${escapeHtml(m.name)}</strong>${dose}${freq}</p>${notes}</div></div>`;
              })
              .join('');
            return `<div class="time-block"><p class="time-label">${escapeHtml(formatTimeFromParts(time, prefs))}</p>${rows}</div>`;
          })
          .join('');

  const asNeededHtml = asNeeded.length
    ? `<section class="card"><h2>As Needed <span class="dim normal">— only if triggered</span></h2>${asNeeded
        .map((m) => {
          const icon = CARE_TYPE_ICONS[m.type] ?? '📅';
          const dose = m.dose ? ` <span class="dim">— ${escapeHtml(m.dose)}</span>` : '';
          const trigger = m.notes
            ? `<p class="notes"><strong>Give if:</strong> ${escapeHtml(m.notes)}</p>`
            : '<p class="notes">As needed</p>';
          return `<div class="row"><span class="icon">${icon}</span><div class="body"><p><strong>${escapeHtml(m.name)}</strong>${dose}</p>${trigger}</div></div>`;
        })
        .join('')}</section>`
    : '';

  const notesHtml = cat.notes
    ? `<section class="card"><h2>Care Notes</h2><p class="multiline">${escapeHtml(cat.notes)}</p></section>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(cat.name)} — sitter view</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 24px 28px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #555; margin: 0 0 10px; }
  p { margin: 0; font-size: 13px; line-height: 1.45; }
  .meta { color: #555; font-size: 12px; margin-top: 2px; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .small { font-size: 11px; }
  .dim { color: #555; }
  .normal { font-weight: 400; text-transform: none; letter-spacing: 0; }
  .card { border: 1px solid #ddd; border-radius: 10px; padding: 16px 18px; margin-bottom: 12px; page-break-inside: avoid; }
  .header { display: flex; align-items: center; gap: 14px; }
  .header h1 { font-size: 22px; }
  .time-block + .time-block { margin-top: 12px; }
  .time-label { font-weight: 600; color: #5b3aa5; margin-bottom: 4px; font-size: 13px; }
  .row { display: flex; gap: 8px; align-items: flex-start; padding: 4px 0; }
  .icon { display: inline-block; width: 20px; text-align: center; font-size: 15px; }
  .body { flex: 1; }
  .notes { color: #555; font-size: 12px; margin-top: 2px; }
  .multiline { white-space: pre-wrap; }
  footer { text-align: center; color: #888; font-size: 10px; margin-top: 12px; }
</style></head>
<body>
  <section class="card">
    <div class="header">
      <div>
        <h1>${escapeHtml(cat.name)}</h1>
        <p class="meta">${headerSubtitle}</p>
        ${breedLine}
        ${chipLine}
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Daily Schedule</h2>
    ${scheduleHtml}
  </section>

  ${asNeededHtml}
  ${notesHtml}

  <footer>Whisker Health · sitter view</footer>
</body></html>`;
}
