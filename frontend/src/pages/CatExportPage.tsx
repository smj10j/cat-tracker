import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCat, getMeasurements, type Cat, type Measurement } from '../lib/api'
import { assessHealth } from '../lib/healthMetrics'
import { detectCorrelations, describeCorrelation } from '../lib/correlations'
import { getPresetLabel, PRESET_TYPES } from '../lib/measurementPresets'

const TYPE_LABELS: Record<string, string> = {
  weight: 'Weight', food: 'Food intake', water: 'Water intake',
  grooming: 'Grooming', play: 'Play', activity: 'Activity level',
  vomiting: 'Vomiting', litter: 'Litter box',
}

const TYPE_UNIT_LABEL: Record<string, string> = {
  weight: 'lbs',
  food: '(scale: None / Some / Most / All)',
  water: '(scale: None / Some / Most / All)',
  grooming: '(scale: None / Less / Normal / Excessive)',
  activity: '(scale: Lethargic / Low / Normal / Active)',
  vomiting: '(scale: None / Once / A few times / Many times)',
  litter: '(scale: Not used / Straining / Loose / Normal)',
}

function catAge(birthdate: string): string {
  const birth = new Date(birthdate)
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}mo` : `${years} year${years !== 1 ? 's' : ''} old`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function CatExportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [cat, setCat] = useState<Cat | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getCat(id), getMeasurements(id)])
      .then(([c, m]) => { setCat(c); setMeasurements(m) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Preparing export…</div>
  }
  if (error || !cat) {
    return <div className="p-8 text-red-600">{error ?? 'Cat not found'}</div>
  }

  const byType: Record<string, Measurement[]> = {}
  for (const m of measurements) {
    if (!byType[m.type]) byType[m.type] = []
    byType[m.type]!.push(m)
  }
  const allTypes = Object.keys(byType)

  const weightMs = (byType['weight'] ?? []).sort((a, b) => b.measured_at.localeCompare(a.measured_at))
  const health = assessHealth(weightMs)
  const status = health.overallStatus

  const correlations = allTypes.length >= 2
    ? detectCorrelations(byType).filter((r) => r.strength !== 'none')
    : []

  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  const statusExplained: Record<string, string> = {
    ok: 'Stable — weight trend within normal range',
    watch: 'Watch — mild weight change worth monitoring',
    concerning: 'Concerning — notable weight loss; veterinary discussion recommended',
    urgent: 'Urgent — significant weight loss; veterinary evaluation recommended promptly',
  }

  return (
    <>
      {/* Print CSS: hide nav and action buttons when printing */}
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .export-page { color: black !important; }
        }
      `}</style>

      <div className="export-page min-h-screen" style={{ background: '#fff', color: '#111', fontFamily: 'system-ui, sans-serif' }}>

        {/* Action bar (screen only) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <button
            onClick={() => navigate(`/cats/${cat.id}`)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: '#6b7280' }}
          >
            ← Back to {cat.name}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#7c3aed', color: '#fff' }}
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

          {/* Document header */}
          <div className="border-b pb-6" style={{ borderColor: '#e5e7eb' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>
              Cat Tracker — Vet Visit Summary
            </p>
            <h1 className="text-2xl font-bold mb-1">{cat.name}</h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>Generated {generatedAt}</p>
          </div>

          {/* Cat info */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>Cat information</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
              <div><span className="font-medium">Name: </span>{cat.name}</div>
              <div><span className="font-medium">Age: </span>{catAge(cat.birthdate)}</div>
              {cat.breed && <div><span className="font-medium">Breed: </span>{cat.breed}</div>}
              {cat.coloring && <div><span className="font-medium">Coloring: </span>{cat.coloring}</div>}
            </div>
            {cat.notes && (
              <div className="mt-2 text-sm" style={{ color: '#4b5563' }}>
                <span className="font-medium">Notes: </span>{cat.notes}
              </div>
            )}
          </section>

          {/* Weight summary */}
          {weightMs.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>Weight</h2>

              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-4">
                <div><span className="font-medium">Current: </span>{weightMs[0]?.value} lbs</div>
                {weightMs.length >= 2 && (
                  <>
                    <div><span className="font-medium">Status: </span>{statusExplained[status] ?? status}</div>
                    {health.peakLossPct > 0 && (
                      <div className="col-span-2">
                        <span className="font-medium">Change from peak: </span>
                        {health.peakLossPct}% below highest recorded weight
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="font-medium">Trend: </span>{health.summary}
                    </div>
                  </>
                )}
              </div>

              {weightMs.length > 0 && (
                <>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>
                    Weight log (most recent first)
                  </p>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th className="text-left py-1.5 font-medium" style={{ color: '#6b7280' }}>Date</th>
                        <th className="text-right py-1.5 font-medium" style={{ color: '#6b7280' }}>Weight (lbs)</th>
                        <th className="text-right py-1.5 font-medium" style={{ color: '#6b7280' }}>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weightMs.slice(0, 15).map((m, i) => {
                        const prev = weightMs[i + 1]
                        const change = prev ? m.value - prev.value : null
                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td className="py-1.5">{formatDate(m.measured_at)}</td>
                            <td className="py-1.5 text-right font-medium tabular-nums">{m.value}</td>
                            <td className="py-1.5 text-right tabular-nums" style={{ color: change == null ? '#9ca3af' : change < 0 ? '#dc2626' : change > 0 ? '#16a34a' : '#9ca3af' }}>
                              {change == null ? '—' : change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {weightMs.length > 15 && (
                    <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{weightMs.length - 15} earlier entries not shown</p>
                  )}
                </>
              )}
            </section>
          )}

          {/* Behavioral measurements */}
          {allTypes.filter((t) => t !== 'weight' && PRESET_TYPES.has(t)).map((type) => {
            const ms = (byType[type] ?? []).sort((a, b) => b.measured_at.localeCompare(a.measured_at))
            // Last 4 weeks of entries
            const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
            const recent = ms.filter((m) => m.measured_at >= cutoff)
            const shown = recent.length > 0 ? recent : ms.slice(0, 8)
            if (shown.length === 0) return null

            return (
              <section key={type}>
                <h2 className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>
                  {TYPE_LABELS[type] ?? type}
                </h2>
                <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>{TYPE_UNIT_LABEL[type]}</p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th className="text-left py-1.5 font-medium" style={{ color: '#6b7280' }}>Date &amp; time</th>
                      <th className="text-right py-1.5 font-medium" style={{ color: '#6b7280' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td className="py-1.5">{formatDateTime(m.measured_at)}</td>
                        <td className="py-1.5 text-right font-medium">
                          {getPresetLabel(m.type, m.value)}
                          {m.notes && <span className="font-normal" style={{ color: '#6b7280' }}> — {m.notes}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ms.length > shown.length && (
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{ms.length - shown.length} earlier entries not shown</p>
                )}
              </section>
            )
          })}

          {/* Detected patterns */}
          {correlations.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>Observed patterns</h2>
              <ul className="space-y-2">
                {correlations.map((r) => (
                  <li key={`${r.typeA}-${r.typeB}`} className="flex items-start gap-2 text-sm">
                    <span style={{ color: r.strength === 'notable' ? '#7c3aed' : '#ea580c' }}>·</span>
                    <span>{describeCorrelation(r, cat.name)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Footer */}
          <div className="border-t pt-4 text-xs" style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>
            Generated by Cat Tracker · {generatedAt}
          </div>
        </div>
      </div>
    </>
  )
}
