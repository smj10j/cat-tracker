import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

interface ImportResult {
  imported: number
  catsCreated: string[]
  errors: string[]
}

interface PreviewRow {
  date: string
  cat: string
  type: string
  value: string
  unit: string
  valid: boolean
  error?: string
}

function parseCSVPreview(text: string): PreviewRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const rows: PreviewRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(',').map((s) => s.trim())
    if (parts.length < 5) {
      rows.push({ date: '', cat: '', type: '', value: '', unit: '', valid: false, error: `Row ${i + 1}: expected 5 columns` })
      continue
    }
    const [date, cat, type, value, unit] = parts as [string, string, string, string, string]
    const num = parseFloat(value)
    if (!date || !cat) {
      rows.push({ date, cat, type, value, unit, valid: false, error: 'Missing date or cat name' })
    } else if (isNaN(num) || num <= 0) {
      rows.push({ date, cat, type, value, unit, valid: false, error: `Invalid value: ${value}` })
    } else {
      rows.push({ date, cat, type, value, unit, valid: true })
    }
  }
  return rows
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
      setCsvText(text)
      setPreview(parseCSVPreview(text))
      setResult(null)
      setError(null)
    }
    reader.readAsText(file)
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setCsvText(e.target.value)
    setPreview(parseCSVPreview(e.target.value))
    setResult(null)
    setError(null)
  }

  async function handleImport() {
    if (!csvText.trim()) return
    setImporting(true)
    setError(null)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: csvText,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error((err as { error: string }).error)
      }
      const data = await res.json() as ImportResult
      setResult(data)
      setCsvText('')
      setPreview([])
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const validCount = preview.filter((r) => r.valid).length
  const invalidCount = preview.filter((r) => !r.valid).length

  return (
    <div className="max-w-2xl mx-auto p-4">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-900">Import from CSV</h1>
      </header>

      {result ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-gray-900">Import Complete</h2>
          <p className="text-gray-600">
            <span className="font-semibold text-green-600">{result.imported}</span> measurements imported
          </p>
          {result.catsCreated.length > 0 && (
            <p className="text-sm text-gray-500">
              New cats created: {result.catsCreated.join(', ')}
            </p>
          )}
          {result.errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left text-sm text-yellow-800">
              <p className="font-medium mb-1">{result.errors.length} row(s) skipped:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <Link to="/" className="inline-block bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors">
            Back to Cats
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Format guide */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-700 text-sm mb-2">Expected CSV format</h2>
            <pre className="text-xs text-gray-600 font-mono overflow-x-auto">
{`date,cat,type,value,unit
1/2/2026,Luna,weight,8.6,lbs
1/17/2026,Gemini,weight,11.9,lbs
2/24/2026,Luna,food,2.5,oz`}
            </pre>
            <p className="text-xs text-gray-400 mt-2">
              Supported types: <code>weight</code>, <code>food</code>, <code>water</code> &nbsp;·&nbsp;
              Date format: M/D/YYYY &nbsp;·&nbsp;
              Cat names matched by name (case-insensitive); new cats created automatically
            </p>
          </div>

          {/* File upload */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Choose CSV file
              </button>
              <span className="text-sm text-gray-400">or paste below</span>
              <input ref={fileRef} type="file" accept=".csv,text/plain" onChange={handleFile} className="hidden" />
            </div>

            <textarea
              value={csvText}
              onChange={handleTextChange}
              placeholder="date,cat,type,value,unit&#10;1/2/2026,Luna,weight,8.6,lbs"
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800">Preview</h2>
                <div className="text-xs text-gray-400 flex gap-3">
                  {validCount > 0 && <span className="text-green-600 font-medium">{validCount} valid</span>}
                  {invalidCount > 0 && <span className="text-red-500 font-medium">{invalidCount} invalid</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Date</th>
                      <th className="text-left pb-2 font-medium">Cat</th>
                      <th className="text-left pb-2 font-medium">Type</th>
                      <th className="text-left pb-2 font-medium">Value</th>
                      <th className="text-left pb-2 font-medium">Unit</th>
                      <th className="text-left pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} className={`border-b border-gray-50 last:border-0 ${!row.valid ? 'bg-red-50' : ''}`}>
                        <td className="py-1.5 pr-3">{row.date}</td>
                        <td className="py-1.5 pr-3">{row.cat}</td>
                        <td className="py-1.5 pr-3">{row.type}</td>
                        <td className="py-1.5 pr-3">{row.value}</td>
                        <td className="py-1.5 pr-3">{row.unit}</td>
                        <td className="py-1.5">
                          {row.valid
                            ? <span className="text-green-500">✓</span>
                            : <span className="text-red-500" title={row.error}>✗</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">Showing first 50 of {preview.length} rows</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}

          {validCount > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {importing ? 'Importing…' : `Import ${validCount} row${validCount !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
