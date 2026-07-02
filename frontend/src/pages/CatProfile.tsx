import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useGoBack } from '../hooks/useGoBack'
import { getCat, getMeasurements, deleteMeasurement, getMedications, uploadCatPhoto, deleteCatPhoto, CARE_TYPE_ICONS, type Cat, type Measurement, type Medication } from '../lib/api'
import CatAvatar from '../components/CatAvatar'
import HeroStat from '../components/HeroStat'

import {
  assessHealth, STATUS_COLORS, STATUS_EMOJI, STATUS_LABEL,
} from '@shared/lib/healthMetrics'
import WeightChart from '../components/WeightChart'
import MeasurementForm from '../components/MeasurementForm'
import MeasurementChart from '../components/MeasurementChart'
import FullScreenReady from '../components/FullScreenReady'
import InsightsPanel from '../components/InsightsPanel'
import { getPresetLabel } from '@shared/lib/measurementPresets'
import { catAge } from '@shared/lib/dates'
import { usePreferences } from '../contexts/PreferencesContext'
import { formatTime as fmtTime, formatWeight as fmtWeight } from '@shared/lib/preferences'
import { groupByDay, formatFreqShort, formatNextDue, formatSexNeuter } from '@shared/lib/formatting'
import { MEASUREMENT_TYPE_LABELS as MEAS_TYPE_LABELS, BEHAVIOR_CHART_TYPES as BEHAVIORAL_TYPES, isAsNeeded } from '@shared/lib/constants'

type ChartTab = 'weight' | 'food' | 'water' | 'behavior' | 'all'
type ProfileTab = 'health' | 'care' | 'about'

function SkeletonProfile() {
  return (
    <div>
      <div className="skeleton" style={{ height: '42vh', minHeight: 220, maxHeight: 380 }} />
      <div className="px-4 pt-4 space-y-4">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-tab-bar)' }}>
          {[1,2,3].map(i => <div key={i} className="flex-1 skeleton h-8 rounded-lg" />)}
        </div>
        <div className="glass-card p-6">
          <div className="skeleton h-4 w-24 rounded mb-4" />
          <div className="skeleton h-52 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function CareScheduleSection({ catId, meds }: { catId: string; meds: Medication[] }) {
  const { prefs } = usePreferences()
  const scheduled = meds.filter(m => !isAsNeeded(m.frequency))
  const asNeeded = meds.filter(m => isAsNeeded(m.frequency))
  const overdueCount = scheduled.reduce((sum, m) => sum + (m.overdue_count ?? 0), 0)

  function renderMedRow(med: Medication, asNeededRow: boolean) {
    return (
      <Link
        key={med.id}
        to={`/medications/${med.id}/edit`}
        className="flex items-center gap-3 py-2.5 px-1 rounded-xl transition-all"
        style={{ color: 'inherit' }}
      >
        <span className="text-lg w-7 text-center shrink-0">{CARE_TYPE_ICONS[med.type] ?? '📅'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink truncate">{med.name}</span>
            {med.dose && <span className="text-xs text-ink-dim shrink-0">{med.dose}</span>}
            {!asNeededRow && (med.overdue_count ?? 0) > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--color-health-rose)' }}>
                overdue
              </span>
            )}
          </div>
          <p className="text-xs text-ink-dim mt-0.5 truncate">
            {asNeededRow
              ? (med.notes ? `Give if: ${med.notes}` : 'As needed')
              : `${formatFreqShort(med.frequency, med.frequency_days)} · ${formatNextDue(med.next_due_at, prefs)}`}
          </p>
        </div>
        <span className="text-ink-dim text-sm ml-1 shrink-0">→</span>
      </Link>
    )
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-ink">Care Schedule</h3>
          {overdueCount > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--color-health-rose)' }}
            >
              {overdueCount} overdue
            </span>
          )}
        </div>
        <Link
          to={`/cats/${catId}/medications/new`}
          className="text-xs font-semibold transition-colors"
          style={{ color: 'var(--color-brand)' }}
        >
          + Add
        </Link>
      </div>

      {meds.length === 0 ? (
        <p className="text-xs text-ink-dim py-1">No care items tracked yet.</p>
      ) : (
        <>
          {scheduled.length > 0 && (
            <>
              {asNeeded.length > 0 && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-dim mb-1.5">Scheduled</p>
              )}
              <div className="space-y-1 mb-2">
                {scheduled.map(med => renderMedRow(med, false))}
              </div>
            </>
          )}
          {asNeeded.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-dim mt-3 mb-1.5">As needed</p>
              <div className="space-y-1">
                {asNeeded.map(med => renderMedRow(med, true))}
              </div>
            </>
          )}
        </>
      )}

      {meds.length > 0 && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(192,132,252,0.15)' }}>
          <Link
            to={`/cats/${catId}/sitter`}
            className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ color: 'var(--color-brand)', background: 'rgba(192,132,252,0.06)' }}
          >
            🐾 Sitter view <span className="text-ink-dim">— shareable summary</span>
          </Link>
        </div>
      )}
    </div>
  )
}

export default function CatProfile() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const goBack = useGoBack('/')
  const { prefs } = usePreferences()

  const initialTab = searchParams.get('tab')
  const [cat, setCat] = useState<Cat | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [meds, setMeds] = useState<Medication[]>([])
  const [profileTab, setProfileTab] = useState<ProfileTab>(
    initialTab === 'care' || initialTab === 'about' ? initialTab : 'health'
  )
  const [chartTab, setChartTab] = useState<ChartTab>('weight')
  const [showOlderHistory, setShowOlderHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getCat(id), getMeasurements(id), getMedications(id)])
      .then(([c, m, mds]) => { setCat(c); setMeasurements(m); setMeds(mds) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { setShowOlderHistory(false) }, [chartTab])
  useEffect(() => { setPendingDeleteId(null) }, [profileTab, chartTab])

  async function executeDeleteMeasurement(id: string) {
    try {
      await deleteMeasurement(id)
      setMeasurements((prev) => prev.filter((x) => x.id !== id))
    } catch (e: unknown) {
      setActionError((e as Error).message)
      setTimeout(() => setActionError(null), 5000)
    }
    setPendingDeleteId(null)
  }

  function handleMeasurementAdded(m: Measurement) {
    setMeasurements((prev) => [...prev, m].sort((a, b) => a.measured_at.localeCompare(b.measured_at)))
  }

  async function handlePhotoUpload(file: File) {
    if (!id || !cat) return
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      const { photo_url } = await uploadCatPhoto(id, file)
      setCat((c) => c ? { ...c, photo_url } : c)
    } catch (e: unknown) {
      setPhotoError((e as Error).message)
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleRemovePhoto() {
    if (!id || !cat) return
    if (!confirm('Remove this photo?')) return
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      await deleteCatPhoto(id)
      setCat((c) => c ? { ...c, photo_url: null } : c)
    } catch (e: unknown) {
      setPhotoError((e as Error).message)
    } finally {
      setPhotoUploading(false)
    }
  }

  if (loading) return <SkeletonProfile />
  if (error) return (
    <div className="px-4 pt-6">
      <div className="glass-card p-4 text-rose text-sm">{error}</div>
    </div>
  )
  if (!cat) return null

  const weightMeasurements = measurements.filter((m) => m.type === 'weight')
  const latestWeight = [...weightMeasurements].sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0]
  const health = assessHealth(weightMeasurements)
  const status = health.overallStatus
  const statusColor = STATUS_COLORS[status]
  const typeSet = new Set(measurements.map((m) => m.type))
  const hasBehavior = [...typeSet].some((t) => BEHAVIORAL_TYPES.has(t))

  const measurementsByType: Record<string, typeof measurements> = {}
  for (const m of measurements) {
    if (!measurementsByType[m.type]) measurementsByType[m.type] = []
    measurementsByType[m.type]!.push(m)
  }
  const availableTypes = Object.keys(measurementsByType)

  const chartTabMeasurements = (() => {
    if (chartTab === 'all') return [...measurements]
    if (chartTab === 'behavior') return measurements.filter((m) => BEHAVIORAL_TYPES.has(m.type))
    return measurements.filter((m) => m.type === chartTab)
  })()

  const allDayGroups = groupByDay(chartTabMeasurements, prefs)
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
  const recentGroups = allDayGroups.filter((g) => g.dateStr >= cutoff)
  const olderGroups = allDayGroups.filter((g) => g.dateStr < cutoff)
  const defaultGroups = recentGroups.length > 0 ? recentGroups : allDayGroups.slice(0, 3)
  const visibleGroups = showOlderHistory ? allDayGroups : defaultGroups
  const olderCount = olderGroups.reduce((sum, g) => sum + g.items.length, 0)

  const chartTabs: { key: ChartTab; label: string }[] = [
    { key: 'weight', label: 'Weight' },
    ...(typeSet.has('food') ? [{ key: 'food' as ChartTab, label: 'Food' }] : []),
    ...(typeSet.has('water') ? [{ key: 'water' as ChartTab, label: 'Water' }] : []),
    ...(hasBehavior ? [{ key: 'behavior' as ChartTab, label: 'Behavior' }] : []),
    ...(measurements.length > 0 ? [{ key: 'all' as ChartTab, label: 'All' }] : []),
  ]

  const isUrgent = status === 'urgent'
  const isConcerning = status === 'concerning'

  // Always use a dark overlay regardless of theme — the hero is a photo area
  // and the text (white) must be readable over any photo content.
  const nightBg = 'rgba(0,0,0,0.65)'

  const hasRealMicrochip = cat.microchip_id && !cat.microchip_id.startsWith('temp-microchip-id-')

  return (
    <div className="min-h-screen">
      {actionError && (
        <div
          role="alert"
          className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl p-3 text-sm text-rose"
          style={{ background: 'rgba(30,20,40,0.95)', border: '1px solid rgba(248,113,113,0.35)' }}
        >
          {actionError}
        </div>
      )}

      {/* ── Full-bleed hero ── */}
      <div
        className="relative overflow-hidden"
        style={{ height: '42vh', minHeight: 220, maxHeight: 380, opacity: photoUploading ? 0.85 : 1, transition: 'opacity 0.2s' }}
      >
        {/* Background: photo or gradient */}
        {cat.photo_url ? (
          <img
            src={cat.photo_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: isUrgent
                ? 'linear-gradient(135deg, rgba(248,113,113,0.3) 0%, rgba(248,113,113,0.1) 100%)'
                : isConcerning
                ? 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(249,115,22,0.08) 100%)'
                : 'linear-gradient(135deg, rgba(192,132,252,0.25) 0%, rgba(251,146,60,0.15) 100%)',
            }}
          >
            <CatAvatar photoUrl={null} name={cat.name} size={120} />
          </div>
        )}

        {/* Top gradient: nav button visibility */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: 100, background: `linear-gradient(180deg, ${nightBg} 0%, transparent 100%)` }}
        />
        {/* Bottom gradient: name/weight text visibility */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 160, background: `linear-gradient(0deg, ${nightBg} 0%, rgba(0,0,0,0.35) 50%, transparent 100%)` }}
        />

        {/* Top nav */}
        <div className="absolute top-0 left-0 right-0 flex items-center px-4 pt-12 gap-3">
          <button
            onClick={goBack}
            className="text-white/60 hover:text-white transition-colors text-xl leading-none"
          >
            ←
          </button>
          <div className="flex-1" />
          <Link
            to={`/cats/${cat.id}/export`}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(6px)',
            }}
          >
            Export
          </Link>
        </div>

        {/* Camera button (overlaid file input — PWA safe) */}
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            right: 16,
            bottom: cat.photo_url ? 68 : 72,
            width: 32,
            height: 32,
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <span className="text-sm pointer-events-none">📷</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handlePhotoUpload(file)
              e.target.value = ''
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full"
          />
        </div>

        {/* Remove photo button (only when photo exists) */}
        {cat.photo_url && (
          <button
            type="button"
            onClick={handleRemovePhoto}
            className="absolute rounded-full flex items-center justify-center transition-opacity hover:opacity-100"
            style={{
              right: 54,
              bottom: cat.photo_url ? 68 : 72,
              width: 32,
              height: 32,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(248,113,113,0.3)',
              opacity: 0.8,
            }}
          >
            <span className="text-xs" style={{ color: 'var(--color-health-rose)' }}>✕</span>
          </button>
        )}

        {/* Bottom: name + age + weight */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-3xl text-white leading-tight truncate">{cat.name}</h1>
              <p className="text-white/50 text-sm mt-0.5">{catAge(cat.birthdate)}</p>
            </div>
            {latestWeight && (
              <div className="text-right shrink-0">
                <HeroStat
                  value={String(latestWeight.value)}
                  unit={latestWeight.unit}
                  size={28}
                  color={status !== 'ok' ? statusColor : undefined}
                />
                {weightMeasurements.length >= 2 && (
                  <div
                    className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${isUrgent ? 'animate-pulse' : ''}`}
                    style={{ color: statusColor, background: `${statusColor}25`, border: `1px solid ${statusColor}50` }}
                  >
                    {STATUS_LABEL[status]}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Profile tabs ── */}
      <div role="tablist" aria-label="Profile sections" className="flex gap-1 mx-4 mt-4 p-1 rounded-xl" style={{ background: 'var(--color-tab-bar)' }}>
        {(['health', 'care', 'about'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={profileTab === key}
            onClick={() => setProfileTab(key)}
            className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize"
            style={{
              background: profileTab === key ? 'rgba(192,132,252,0.15)' : 'transparent',
              color: profileTab === key ? 'var(--color-brand)' : 'var(--color-ink-dim)',
              border: profileTab === key ? '1px solid rgba(192,132,252,0.25)' : '1px solid transparent',
            }}
          >
            {key === 'health' ? 'Health' : key === 'care' ? 'Care' : 'About'}
          </button>
        ))}
      </div>

      {photoError && (
        <div className="mx-4 mt-3 glass-card p-3 text-rose text-xs" style={{ borderColor: 'rgba(248,113,113,0.2)' }}>{photoError}</div>
      )}

      {/* ── Health tab ── */}
      {profileTab === 'health' && (
        <div className="px-4 space-y-4 mt-4 pb-8">
          <InsightsPanel
            cat={cat}
            status={status}
            health={health}
            measurementsByType={measurementsByType}
            availableTypes={availableTypes}
            hasWeightData={weightMeasurements.length >= 2}
          />

          {/* Chart */}
          {(chartTab === 'weight' || chartTab === 'food' || chartTab === 'water') && (
            <div className="glass-card p-5 animate-slide-up opacity-0" style={{ animationDelay: '60ms', animationFillMode: 'forwards' }}>
              {chartTab === 'weight' ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold text-ink">Weight Over Time</h3>
                    <div className="flex gap-3 text-xs text-ink-dim">
                      {(['ok', 'watch', 'concerning', 'urgent'] as const).map((s) => (
                        <span key={s} className="flex items-center gap-1">
                          {STATUS_EMOJI[s]} {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <FullScreenReady title={cat?.name ?? 'Weight'} subtitle={prefs.weightUnit} hasData={weightMeasurements.length > 0}>
                    {(fs) => <WeightChart measurements={weightMeasurements} fullScreen={fs} />}
                  </FullScreenReady>
                </>
              ) : (
                <>
                  <h3 className="font-display font-semibold text-ink mb-4">
                    {chartTab === 'food' ? 'Food Intake' : 'Water Intake'} Over Time
                  </h3>
                  <FullScreenReady title={cat?.name ?? ''} subtitle={chartTab === 'food' ? 'Food' : 'Water'} hasData={measurements.filter((m) => m.type === chartTab).length > 0}>
                    {(fs) => (
                      <MeasurementChart
                        measurements={measurements.filter((m) => m.type === chartTab).sort((a, b) => a.measured_at.localeCompare(b.measured_at))}
                        type={chartTab}
                        fullScreen={fs}
                      />
                    )}
                  </FullScreenReady>
                </>
              )}
            </div>
          )}

          {/* Add measurement */}
          {id && <MeasurementForm catId={id} onAdded={handleMeasurementAdded} />}

          {/* History */}
          {measurements.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-ink mb-4">History</h3>

              {/* Chart/history type filter tabs */}
              <div role="tablist" aria-label="Measurement type" className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--color-tab-bar)' }}>
                {chartTabs.map(({ key, label }) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={chartTab === key}
                    onClick={() => setChartTab(key)}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
                    style={{
                      background: chartTab === key ? 'rgba(192,132,252,0.15)' : 'transparent',
                      color: chartTab === key ? 'var(--color-brand)' : 'var(--color-ink-dim)',
                      border: chartTab === key ? '1px solid rgba(192,132,252,0.25)' : '1px solid transparent',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {chartTabMeasurements.length === 0 ? (
                <p className="text-ink-dim text-sm text-center py-6">No {chartTab} measurements yet</p>
              ) : (
                <div className="space-y-5">
                  {visibleGroups.map((group) => (
                    <div key={group.dateStr}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold text-ink-dim">{group.label}</span>
                        <span className="text-xs text-ink-dim/60">
                          {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-rim)' }} />
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between py-2.5 border-b last:border-0"
                            style={{ borderColor: 'var(--color-tab-bar)' }}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-ink-dim text-xs w-16 shrink-0 tabular-nums">{fmtTime(m.measured_at, prefs)}</span>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-ink tabular-nums">
                                  {m.unit === 'scale' ? getPresetLabel(m.type, m.value) : fmtWeight(m.value, m.unit, prefs)}
                                </span>
                                {(chartTab === 'all' || chartTab === 'behavior') && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full text-ink-dim"
                                    style={{ background: 'var(--color-card)' }}>
                                    {MEAS_TYPE_LABELS[m.type] ?? m.type}
                                  </span>
                                )}
                                {m.notes && <span className="text-xs text-ink-dim">— {m.notes}</span>}
                              </div>
                            </div>
                            {pendingDeleteId === m.id ? (
                              <div className="flex items-center gap-1 ml-3 shrink-0">
                                <button
                                  onClick={() => setPendingDeleteId(null)}
                                  className="text-xs px-2 py-1 rounded-lg transition-colors"
                                  style={{ color: 'var(--color-ink-dim)', background: 'var(--color-card)' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => executeDeleteMeasurement(m.id)}
                                  className="text-xs px-2 py-1 rounded-lg transition-colors font-semibold"
                                  style={{ color: 'var(--color-health-rose)', background: 'rgba(248,113,113,0.1)' }}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPendingDeleteId(m.id)}
                                className="text-xs text-rose/60 hover:text-rose transition-colors ml-3 shrink-0"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {!showOlderHistory && olderGroups.length > 0 && (
                    <button
                      onClick={() => setShowOlderHistory(true)}
                      className="w-full py-2.5 text-xs font-semibold rounded-xl transition-all"
                      style={{
                        color: 'var(--color-ink-dim)',
                        background: 'var(--color-card)',
                        border: '1px solid var(--color-card-border)',
                      }}
                    >
                      View {olderCount} older {olderCount === 1 ? 'entry' : 'entries'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Care tab ── */}
      {profileTab === 'care' && (
        <div className="px-4 space-y-4 mt-4 pb-8">
          <CareScheduleSection catId={id!} meds={meds} />
          {meds.length > 0 && (
            <Link
              to="/notifications"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{ border: '1px solid var(--color-rim)', color: 'var(--color-ink-mid)' }}
            >
              View all notifications →
            </Link>
          )}
        </div>
      )}

      {/* ── About tab ── */}
      {profileTab === 'about' && (
        <div className="px-4 space-y-4 mt-4 pb-8">
          <div className="glass-card px-5 py-4">
            <div className="space-y-0">
              {/* Breed */}
              <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--color-rim)' }}>
                <span className="text-base w-6 text-center">🐾</span>
                <span className="text-xs text-ink-dim w-20 shrink-0">Breed</span>
                <span className="text-sm text-ink flex-1">{cat.breed ?? '—'}</span>
              </div>

              {/* Sex / Neuter */}
              <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--color-rim)' }}>
                <span className="text-base w-6 text-center">
                  {cat.sex === 'Female' ? '♀' : cat.sex === 'Male' ? '♂' : '⚥'}
                </span>
                <span className="text-xs text-ink-dim w-20 shrink-0">Sex</span>
                <span className="text-sm text-ink flex-1">{formatSexNeuter(cat.sex, cat.is_neutered)}</span>
              </div>

              {/* Coloring */}
              {cat.coloring && (
                <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--color-rim)' }}>
                  <span className="text-base w-6 text-center">🎨</span>
                  <span className="text-xs text-ink-dim w-20 shrink-0">Coloring</span>
                  <span className="text-sm text-ink flex-1">{cat.coloring}</span>
                </div>
              )}

              {/* Age */}
              <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--color-rim)' }}>
                <span className="text-base w-6 text-center">🎂</span>
                <span className="text-xs text-ink-dim w-20 shrink-0">Age</span>
                <span className="text-sm text-ink flex-1">{catAge(cat.birthdate)}</span>
              </div>

              {/* Latest weight */}
              {latestWeight && (
                <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--color-rim)' }}>
                  <span className="text-base w-6 text-center">⚖️</span>
                  <span className="text-xs text-ink-dim w-20 shrink-0">Weight</span>
                  <span className="text-sm flex-1">
                    <span className="font-semibold tabular-nums" style={{ color: status !== 'ok' ? statusColor : 'var(--color-accent)' }}>
                      {latestWeight.value} {latestWeight.unit}
                    </span>
                    {weightMeasurements.length >= 2 && (
                      <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ color: statusColor, background: `${statusColor}20`, border: `1px solid ${statusColor}40` }}>
                        {STATUS_LABEL[status]}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Microchip */}
              {hasRealMicrochip && (
                <div className="flex items-center gap-3 py-3" style={{}}>
                  <span className="text-base w-6 text-center">#</span>
                  <span className="text-xs text-ink-dim w-20 shrink-0">Microchip</span>
                  <span className="text-sm font-mono text-ink-mid flex-1 tracking-wide">
                    {cat.microchip_id!.replace(/(.{3})/g, '$1 ').trim()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {cat.notes && (
            <div className="glass-card px-5 py-4 text-ink-mid text-sm italic">
              {cat.notes}
            </div>
          )}

          <Link
            to={`/cats/${cat.id}/edit`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ border: '1px solid rgba(192,132,252,0.25)', color: 'var(--color-brand)', background: 'rgba(192,132,252,0.06)' }}
          >
            Edit profile
          </Link>
        </div>
      )}

    </div>
  )
}
