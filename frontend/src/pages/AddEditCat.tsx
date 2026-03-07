import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { createCat, updateCat, getCat } from '../lib/api'

export default function AddEditCat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({ name: '', birthdate: '', breed: '', coloring: '', notes: '', sex: '' })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getCat(id)
      .then((cat) => setForm({ name: cat.name, birthdate: cat.birthdate, breed: cat.breed ?? '', coloring: cat.coloring ?? '', notes: cat.notes ?? '', sex: cat.sex ?? '' }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        birthdate: form.birthdate,
        breed: form.breed.trim() || null,
        coloring: form.coloring.trim() || null,
        notes: form.notes.trim() || null,
        sex: form.sex || null,
        photo_url: null,
      }
      if (isEdit && id) {
        await updateCat(id, payload)
        navigate(`/cats/${id}`)
      } else {
        const cat = await createCat(payload)
        navigate(`/cats/${cat.id}`)
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <div className="skeleton h-8 w-32 rounded" />
        <div className="glass-card p-6 space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="space-y-1.5"><div className="skeleton h-3 w-16 rounded" /><div className="skeleton h-10 w-full rounded-xl" /></div>)}
        </div>
      </div>
    )
  }

  const field = (label: string, name: keyof typeof form, type = 'text', required = false, placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
        {label}{required && <span className="text-rose ml-1">*</span>}
      </label>
      <input
        name={name}
        type={type}
        value={form[name]}
        onChange={handleChange}
        required={required}
        placeholder={placeholder}
        className="input-dark w-full px-4 py-3 text-sm"
      />
    </div>
  )

  return (
    <div className="min-h-screen px-4 pt-6">
      <div className="flex items-center gap-3 mb-8">
        <Link to={isEdit && id ? `/cats/${id}` : '/'} className="text-ink-dim hover:text-ink-mid transition-colors text-xl">←</Link>
        <h1 className="font-display font-bold text-2xl text-ink">{isEdit ? 'Edit Cat' : 'New Cat'}</h1>
        <div className="flex-1" />
        {!isEdit && <Link to="/import" className="btn-ghost text-xs px-3 py-1.5">Import CSV</Link>}
      </div>

      {error && (
        <div className="glass-card p-4 text-rose text-sm mb-4" style={{ borderColor: 'rgba(248,113,113,0.2)' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        {field('Name', 'name', 'text', true, 'e.g. Luna')}
        {field('Birthdate', 'birthdate', 'date', true)}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Breed</label>
            <input name="breed" value={form.breed} onChange={handleChange} placeholder="Domestic Shorthair"
              className="input-dark w-full px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Sex</label>
            <select name="sex" value={form.sex} onChange={handleChange} className="input-dark w-full px-4 py-3 text-sm">
              <option value="">Unknown</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Coloring</label>
          <input name="coloring" value={form.coloring} onChange={handleChange} placeholder="Orange tabby"
            className="input-dark w-full px-4 py-3 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
            placeholder="Anything worth remembering…"
            className="input-dark w-full px-4 py-3 text-sm resize-none" />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3.5 text-sm mt-2">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Cat'}
        </button>
      </form>
    </div>
  )
}
