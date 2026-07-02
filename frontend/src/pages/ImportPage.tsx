import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { VALID_MEASUREMENT_TYPES, VALID_UNITS } from '@shared/lib/constants'

interface ImportResult { imported: number; catsCreated: string[]; errors: string[] }

interface PreviewRow {
  date: string; cat: string; type: string; value: string; unit: string
  valid: boolean; error?: string
}

const TYPE_SET = new Set<string>(VALID_MEASUREMENT_TYPES)
const UNIT_SET = new Set<string>(VALID_UNITS)

// Mirrors the server-side validation in worker/src/routes/import.ts so bad
// rows show as invalid in the preview instead of failing after submit.
function parseCSVPreview(text: string): PreviewRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  return lines.slice(1).map((line, i) => {
    const parts = line.split(',').map((s) => s.trim())
    if (parts.length < 5) return { date: '', cat: '', type: '', value: '', unit: '', valid: false, error: `Row ${i + 2}: need 5 columns` }
    const [date, cat, type, value, unit] = parts as [string, string, string, string, string]
    const num = parseFloat(value)
    if (!date || !cat) return { date, cat, type, value, unit, valid: false, error: 'Missing date or cat' }
    if (!TYPE_SET.has(type)) return { date, cat, type, value, unit, valid: false, error: `Unknown type: ${type}` }
    if (!UNIT_SET.has(unit)) return { date, cat, type, value, unit, valid: false, error: `Unknown unit: ${unit}` }
    if (isNaN(num)) return { date, cat, type, value, unit, valid: false, error: `Invalid value: ${value}` }
    if (unit === 'scale') {
      if (!Number.isInteger(num) || num < 0 || num > 3) {
        return { date, cat, type, value, unit, valid: false, error: 'Scale value must be 0–3' }
      }
    } else if (num <= 0 || num > 200) {
      return { date, cat, type, value, unit, valid: false, error: `Value out of range: ${value}` }
    }
    return { date, cat, type, value, unit, valid: true }
  })
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text); setPreview(parseCSVPreview(text)); setResult(null); setError(null)
    }
    reader.readAsText(file)
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setCsvText(e.target.value); setPreview(parseCSVPreview(e.target.value)); setResult(null); setError(null)
  }

  async function handleImport() {
    if (!csvText.trim()) return
    setImporting(true); setError(null)
    try {
      const res = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: csvText })
      if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error((err as { error: string }).error) }
      setResult(await res.json() as ImportResult)
      setCsvText(''); setPreview([])
    } catch (e: unknown) { setError((e as Error).message) } finally { setImporting(false) }
  }

  const validCount = preview.filter(r => r.valid).length
  const invalidCount = preview.filter(r => !r.valid).length

  return (
    <div className="min-h-screen px-4 pt-6">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="text-ink-dim hover:text-ink-mid transition-colors text-xl">←</Link>
        <h1 className="font-display font-bold text-2xl text-ink">Import CSV</h1>
      </div>

      {result ? (
        <div className="glass-card p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-3xl"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)' }}>✅</div>
          <h2 className="font-display font-bold text-xl text-ink">Import Complete</h2>
          <p className="text-ink-mid">
            <span className="font-bold text-jade text-lg">{result.imported}</span> measurements imported
          </p>
          {result.catsCreated.length > 0 && (
            <p className="text-sm text-ink-mid">New cats created: <span className="text-lavender">{result.catsCreated.join(', ')}</span></p>
          )}
          {result.errors.length > 0 && (
            <div className="rounded-xl p-3 text-left text-sm text-honey" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p className="font-semibold mb-1">{result.errors.length} row(s) skipped</p>
              <ul className="list-disc list-inside space-y-0.5 text-ink-mid">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          <Link to="/" className="btn-primary inline-block px-8 py-2.5 text-sm">Back to Cats</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Format guide */}
          <div className="glass-card p-5">
            <h2 className="text-xs font-semibold text-ink-mid uppercase tracking-wider mb-3">Expected Format</h2>
            <pre className="text-xs text-lavender font-mono overflow-x-auto leading-relaxed">{`date,cat,type,value,unit\n1/2/2026,Luna,weight,8.6,lbs\n1/17/2026,Gemini,weight,11.9,lbs\n2/24/2026,Luna,food,2.5,oz`}</pre>
            <p className="text-xs text-ink-dim mt-3">Types: weight · food · water &nbsp;·&nbsp; Date: M/D/YYYY &nbsp;·&nbsp; Cats created automatically if unknown</p>
          </div>

          {/* Upload area */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs px-4 py-2">
                Choose file
              </button>
              <span className="text-ink-dim text-xs">or paste below</span>
              <input ref={fileRef} type="file" accept=".csv,text/plain" onChange={handleFile} className="hidden" />
            </div>
            <textarea
              value={csvText}
              onChange={handleTextChange}
              placeholder={`date,cat,type,value,unit\n1/2/2026,Luna,weight,8.6,lbs`}
              rows={6}
              className="input-dark w-full px-4 py-3 text-sm font-mono resize-none"
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-ink text-sm">Preview</h2>
                <div className="flex gap-3 text-xs">
                  {validCount > 0 && <span className="text-jade font-semibold">{validCount} valid</span>}
                  {invalidCount > 0 && <span className="text-rose font-semibold">{invalidCount} invalid</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink-dim" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {['Date', 'Cat', 'Type', 'Value', 'Unit', ''].map(h => (
                        <th key={h} className="text-left pb-2 font-semibold pr-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        {[row.date, row.cat, row.type, row.value, row.unit].map((v, j) => (
                          <td key={j} className="py-2 pr-3 text-ink-mid">{v}</td>
                        ))}
                        <td className="py-2">
                          {row.valid
                            ? <span className="text-jade">✓</span>
                            : <span className="text-rose" title={row.error}>✗</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && <p className="text-xs text-ink-dim mt-2 text-center">First 50 of {preview.length} rows</p>}
              </div>
            </div>
          )}

          {error && <div className="glass-card p-4 text-rose text-sm">{error}</div>}

          {validCount > 0 && (
            <button onClick={handleImport} disabled={importing} className="btn-primary w-full py-3.5 text-sm">
              {importing ? 'Importing…' : `Import ${validCount} row${validCount !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
