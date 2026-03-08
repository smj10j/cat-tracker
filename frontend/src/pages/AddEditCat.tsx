import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { createCat, updateCat, getCat, deleteCat, uploadCatPhoto, deleteCatPhoto, ApiError } from '../lib/api'
import CatAvatar from '../components/CatAvatar'
import CropModal from '../components/CropModal'

function isTempMicrochip(id: string | null | undefined): boolean {
  return !id || id.startsWith('temp-microchip-id-')
}

export default function AddEditCat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    name: '', birthdate: '', breed: '', coloring: '', notes: '', sex: '', microchip_id: '', is_neutered: '',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)

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
          sex: cat.sex ?? '',
          microchip_id: isTempMicrochip(cat.microchip_id) ? '' : (cat.microchip_id ?? ''),
          is_neutered: cat.is_neutered != null ? String(cat.is_neutered) : '',
        })
        setExistingPhotoUrl(cat.photo_url)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!pendingBlob) return
    const url = URL.createObjectURL(pendingBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingBlob])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setCropFile(file)
    e.target.value = ''
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
        photo_url: null as string | null,
        microchip_id: form.microchip_id.trim() || null,
        is_neutered: form.is_neutered !== '' ? parseInt(form.is_neutered, 10) : null,
      }
      if (isEdit && id) {
        await updateCat(id, payload)
        // Photo upload already happened immediately on crop completion.
        // Only handle explicit removal here.
        if (photoRemoved && existingPhotoUrl) await deleteCatPhoto(id)
        navigate(`/cats/${id}`)
      } else {
        const cat = await createCat(payload)
        if (pendingBlob) await uploadCatPhoto(cat.id, pendingBlob)
        navigate(`/cats/${cat.id}`)
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.message === 'microchip_id_conflict') {
        if (e.conflictingCatName) {
          setError(`This microchip ID is already used by ${e.conflictingCatName}. Check for a typo, or edit that cat to update the record.`)
        } else {
          setError('This microchip ID is already registered. If this is your cat, contact support.')
        }
      } else {
        setError((e as Error).message)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm('Delete this cat and all their measurements? This cannot be undone.')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteCat(id)
      navigate('/')
    } catch (e: unknown) {
      setError((e as Error).message)
      setDeleting(false)
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

  const field = (label: string, name: keyof typeof form, type = 'text', required = false, placeholder = '', maxLength?: number) => (
    <div>
      <label htmlFor={`cat-field-${name}`} className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
        {label}{required && <span className="text-rose ml-1">*</span>}
      </label>
      <input
        id={`cat-field-${name}`}
        name={name}
        type={type}
        value={form[name]}
        onChange={handleChange}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
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

      {/* Crop modal */}
      {cropFile && (
        <CropModal
          file={cropFile}
          onCrop={(blob) => {
            setCropFile(null)
            if (isEdit && id) {
              // Edit mode: upload immediately so the photo is saved even if the
              // user navigates away without hitting "Save Changes".
              const reader = new FileReader()
              reader.onload = (ev) => setPreviewUrl((ev.target?.result as string) ?? '')
              reader.readAsDataURL(blob)
              uploadCatPhoto(id, blob).catch((e: Error) => setError(e.message))
            } else {
              // New cat: hold the blob and upload after the cat is created.
              setPendingBlob(blob)
            }
          }}
          onCancel={() => setCropFile(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        {/* Photo slot — file inputs are overlaid directly on each tap target so
            the user physically clicks <input type="file">, which works in all
            PWA contexts without needing programmatic .click() or label tricks. */}
        <div className="flex flex-col items-center gap-2 pb-2">
          <div
            className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-2xl transition-opacity hover:opacity-80"
            style={{
              background: previewUrl || existingPhotoUrl
                ? undefined
                : 'rgba(192,132,252,0.08)',
              border: previewUrl || existingPhotoUrl
                ? '2px solid rgba(192,132,252,0.4)'
                : '2px dashed rgba(192,132,252,0.35)',
            }}
          >
            <CatAvatar
              photoUrl={photoRemoved ? null : (previewUrl ?? existingPhotoUrl)}
              name={form.name || 'cat'}
              size={64}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          {(previewUrl || (!photoRemoved && existingPhotoUrl)) ? (
            <div className="flex items-center gap-3">
              <div className="relative text-xs text-ink-dim hover:text-ink-mid transition-colors cursor-pointer">
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-ink-dim text-xs">·</span>
              <button
                type="button"
                onClick={() => { setPendingBlob(null); setPreviewUrl(null); setPhotoRemoved(true) }}
                className="text-xs transition-colors"
                style={{ color: 'rgba(248,113,113,0.7)' }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="relative text-xs text-ink-dim hover:text-ink-mid transition-colors cursor-pointer">
              Add photo
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          )}
        </div>

        {field('Name', 'name', 'text', true, 'e.g. Luna', 200)}
        {field('Birthdate', 'birthdate', 'date', true)}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cat-field-breed" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Breed</label>
            <input id="cat-field-breed" name="breed" value={form.breed} onChange={handleChange} placeholder="Domestic Shorthair"
              maxLength={200} className="input-dark w-full px-4 py-3 text-sm" />
          </div>
          <div>
            <label htmlFor="cat-field-sex" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Sex</label>
            <select id="cat-field-sex" name="sex" value={form.sex} onChange={handleChange} className="input-dark w-full px-4 py-3 text-sm">
              <option value="">Unknown</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="cat-field-is_neutered" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Neuter status</label>
          <select id="cat-field-is_neutered" name="is_neutered" value={form.is_neutered} onChange={handleChange} className="input-dark w-full px-4 py-3 text-sm">
            <option value="">Unknown</option>
            <option value="1">{form.sex === 'Female' ? 'Spayed' : 'Neutered'}</option>
            <option value="0">Intact (not neutered)</option>
          </select>
        </div>
        <div>
          <label htmlFor="cat-field-coloring" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Coloring</label>
          <input id="cat-field-coloring" name="coloring" value={form.coloring} onChange={handleChange} placeholder="Orange tabby"
            maxLength={200} className="input-dark w-full px-4 py-3 text-sm" />
        </div>
        <div>
          <label htmlFor="cat-field-notes" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">Notes</label>
          <textarea id="cat-field-notes" name="notes" value={form.notes} onChange={handleChange} rows={3}
            placeholder="Anything worth remembering…" maxLength={4000}
            className="input-dark w-full px-4 py-3 text-sm resize-none" />
        </div>

        <div>
          <label htmlFor="cat-field-microchip_id" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
            Microchip ID
            <span className="ml-2 normal-case font-normal text-ink-dim">(optional)</span>
          </label>
          <input
            id="cat-field-microchip_id"
            name="microchip_id"
            value={form.microchip_id}
            onChange={handleChange}
            placeholder="e.g. 985112345678903"
            maxLength={50}
            className="input-dark w-full px-4 py-3 text-sm font-mono tracking-wide"
          />
          <p className="text-xs text-ink-dim mt-1.5">Leave blank to fill in later. Used to identify your cat if found by a vet or shelter.</p>
        </div>

        <button type="submit" disabled={saving || deleting} className="btn-primary w-full py-3.5 text-sm mt-2">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Cat'}
        </button>

        {isEdit && (
          <div className="pt-4 border-t mt-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="w-full py-3 text-sm font-semibold rounded-xl transition-all"
              style={{
                color: deleting ? 'rgba(248,113,113,0.4)' : 'rgba(248,113,113,0.7)',
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.2)',
              }}
            >
              {deleting ? 'Deleting…' : 'Delete Cat'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
