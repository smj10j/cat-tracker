import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { createCat, updateCat, getCat } from '../lib/api'

export default function AddEditCat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    name: '',
    birthdate: '',
    breed: '',
    coloring: '',
    notes: '',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getCat(id)
      .then((cat) => {
        setForm({
          name: cat.name,
          birthdate: cat.birthdate,
          breed: cat.breed ?? '',
          coloring: cat.coloring ?? '',
          notes: cat.notes ?? '',
        })
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
    return <div className="text-center py-12 text-gray-400">Loading...</div>
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <header className="flex items-center gap-3 mb-6">
        <Link to={isEdit && id ? `/cats/${id}` : '/'} className="text-gray-400 hover:text-gray-600">
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Edit Cat' : 'Add a Cat'}
        </h1>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="e.g. Luna"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Birthdate <span className="text-red-500">*</span>
          </label>
          <input
            name="birthdate"
            type="date"
            value={form.birthdate}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Breed / Type <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            name="breed"
            value={form.breed}
            onChange={handleChange}
            placeholder="e.g. Domestic Shorthair"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Coloring / Coat <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            name="coloring"
            value={form.coloring}
            onChange={handleChange}
            placeholder="e.g. Orange tabby"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any extra info about this cat..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Cat'}
        </button>
      </form>
    </div>
  )
}
