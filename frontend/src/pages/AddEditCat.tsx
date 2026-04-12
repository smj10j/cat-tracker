import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { createCat, updateCat, getCat, deleteCat, uploadCatPhoto, deleteCatPhoto, markDeceased, markAlive, ApiError } from '../lib/api'
import CatAvatar from '../components/CatAvatar'

import { useGoBack } from '../hooks/useGoBack'

function isTempMicrochip(id: string | null | undefined): boolean {
  return !id || id.startsWith('temp-microchip-id-')
}

export default function AddEditCat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const goBack = useGoBack(isEdit && id ? `/cats/${id}` : '/')

  const [form, setForm] = useState({
    name: '', birthdate: '', breed: '', coloring: '', notes: '', sex: '', microchip_id: '', is_neutered: '',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const [catDeceasedAt, setCatDeceasedAt] = useState<string | null>(null)
  const [deceasedSheetOpen, setDeceasedSheetOpen] = useState(false)
  const [deceasedDate, setDeceasedDate] = useState('')
  const [memorialNote, setMemorialNote] = useState('')
  const [markingDeceased, setMarkingDeceased] = useState(false)

  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
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
        setCatDeceasedAt(cat.deceased_at)
        if (cat.deceased_at) {
          setDeceasedDate(cat.deceased_at)
          setMemorialNote(cat.memorial_note ?? '')
        } else {
          // Pre-fill today's date so the picker is ready
          setDeceasedDate(new Date().toISOString().slice(0, 10))
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    // Use FileReader (data: URL) for preview — blob: URLs are blocked by CSP in PWA/CF Pages context
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl((ev.target?.result as string) ?? null)
    reader.readAsDataURL(file)
    if (isEdit && id) {
      uploadCatPhoto(id, file)
        .then(({ photo_url }) => setExistingPhotoUrl(photo_url))
        .catch((err: Error) => setError(err.message))
    } else {
      setPendingBlob(file)
    }
  }

  function showError(msg: string) {
    setError(msg)
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
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
        microchip_id: form.microchip_id.trim() || null,
        is_neutered: form.is_neutered !== '' ? parseInt(form.is_neutered, 10) : null,
      }
      if (isEdit && id) {
        await updateCat(id, payload)
        // Photo upload already happened immediately on file selection (edit mode).
        // Only handle explicit removal here.
        if (photoRemoved && existingPhotoUrl) await deleteCatPhoto(id)
        // Use navigate(-1) so the edit form doesn't stack an extra history entry.
        // If there's no back history (direct URL access), fall back to the cat profile.
        const histIdx = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (histIdx > 0) navigate(-1)
        else navigate(`/cats/${id}`, { replace: true })
      } else {
        const cat = await createCat({ ...payload, photo_url: null, deceased_at: null, memorial_note: null })
        if (pendingBlob) await uploadCatPhoto(cat.id, pendingBlob)
        navigate(`/cats/${cat.id}`)
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.message === 'microchip_id_conflict') {
        if (e.conflictingCatName) {
          showError(`This microchip ID is already used by ${e.conflictingCatName}. Check for a typo, or edit that cat to update the record.`)
        } else {
          showError('This microchip ID is already registered. If this is your cat, contact support.')
        }
      } else {
        showError((e as Error).message)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkDeceased() {
    if (!id) return
    setMarkingDeceased(true)
    setError(null)
    try {
      await markDeceased(id, deceasedDate, memorialNote || undefined)
      setDeceasedSheetOpen(false)
      navigate(`/cats/${id}/memorial`)
    } catch (e: unknown) {
      showError((e as Error).message)
    } finally {
      setMarkingDeceased(false)
    }
  }

  async function handleMarkAlive() {
    if (!id) return
    setMarkingDeceased(true)
    setError(null)
    try {
      await markAlive(id)
      setCatDeceasedAt(null)
      navigate(`/cats/${id}`)
    } catch (e: unknown) {
      showError((e as Error).message)
    } finally {
      setMarkingDeceased(false)
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
      showError((e as Error).message)
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

  const catName = form.name || 'your cat'

  return (
    <div className="min-h-screen px-4 pt-6">
      {/* Deceased bottom sheet */}
      {deceasedSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setDeceasedSheetOpen(false)}>
          <div
            className="rounded-t-3xl p-6 space-y-5 overflow-y-auto"
            style={{ background: 'var(--color-surface-hi)', border: '1px solid var(--color-rim-hi)', maxHeight: '100dvh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <p className="text-xl mb-1">🕊️</p>
              <p className="font-display font-bold text-lg text-ink">Remembering {catName}</p>
              <p className="text-xs text-ink-dim mt-1">Their health history and memories will be preserved.</p>
            </div>

            <div>
              <label htmlFor="deceased-date" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
                Date passed
              </label>
              <input
                id="deceased-date"
                type="date"
                value={deceasedDate}
                onChange={e => setDeceasedDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="input-dark w-full px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="memorial-note" className="block text-xs font-semibold text-ink-mid mb-2 uppercase tracking-wider">
                A few words <span className="normal-case font-normal text-ink-dim">(optional)</span>
              </label>
              <textarea
                id="memorial-note"
                value={memorialNote}
                onChange={e => setMemorialNote(e.target.value)}
                rows={3}
                placeholder={`What made ${catName} special…`}
                maxLength={1024}
                className="input-dark w-full px-4 py-3 text-sm resize-none"
              />
            </div>

            <div className="flex flex-col gap-3 pt-1">
              <button
                type="button"
                onClick={handleMarkDeceased}
                disabled={markingDeceased || !deceasedDate}
                className="w-full py-3.5 text-sm font-semibold rounded-xl transition-all"
                style={{ background: 'rgba(192,132,252,0.15)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.35)' }}
              >
                {markingDeceased ? 'Saving…' : `Remember ${catName}`}
              </button>
              <button
                type="button"
                onClick={() => setDeceasedSheetOpen(false)}
                className="w-full py-3 text-sm text-ink-dim"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={goBack}
          className="text-ink-dim hover:text-ink-mid transition-colors text-xl flex items-center justify-center w-9 h-9"
        >←</button>
        <h1 className="font-display font-bold text-2xl text-ink">{isEdit ? 'Edit Cat' : 'New Cat'}</h1>
        <div className="flex-1" />
        {!isEdit && <Link to="/import" className="btn-ghost text-xs px-3 py-1.5">Import CSV</Link>}
      </div>

      {error && (
        <div ref={errorRef} className="glass-card p-4 text-rose text-sm mb-4" style={{ borderColor: 'rgba(248,113,113,0.2)' }}>{error}</div>
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
          <div className="pt-4 border-t mt-2 space-y-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {catDeceasedAt ? (
              <>
                {/* Memorial editing fields — shown inline when cat is deceased */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}>
                  <p className="text-xs font-semibold text-ink-mid uppercase tracking-wider">Memorial</p>
                  <div>
                    <label htmlFor="edit-deceased-date" className="block text-xs text-ink-dim mb-1">Date of passing</label>
                    <input
                      type="date"
                      id="edit-deceased-date"
                      value={deceasedDate}
                      onChange={e => setDeceasedDate(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      className="input-dark w-full px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-memorial-note" className="block text-xs text-ink-dim mb-1">Memorial note</label>
                    <textarea
                      id="edit-memorial-note"
                      value={memorialNote}
                      onChange={e => setMemorialNote(e.target.value)}
                      rows={4}
                      placeholder={`What made ${catName} special…`}
                      maxLength={1024}
                      className="input-dark w-full px-4 py-3 text-sm resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setMarkingDeceased(true)
                      try {
                        await markDeceased(id!, deceasedDate, memorialNote || undefined)
                        navigate(`/cats/${id}/memorial`)
                      } catch (e: unknown) {
                        setError((e as Error).message)
                      } finally {
                        setMarkingDeceased(false)
                      }
                    }}
                    disabled={markingDeceased || !deceasedDate}
                    className="w-full py-3 text-sm font-semibold rounded-xl transition-all"
                    style={{
                      color: '#c084fc',
                      background: 'rgba(192,132,252,0.1)',
                      border: '1px solid rgba(192,132,252,0.3)',
                    }}
                  >
                    {markingDeceased ? 'Saving…' : 'Update Memorial'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleMarkAlive}
                  disabled={markingDeceased || saving}
                  className="w-full py-3 text-sm font-semibold rounded-xl transition-all"
                  style={{
                    color: 'var(--color-ink-mid)',
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-rim)',
                  }}
                >
                  {markingDeceased ? 'Saving…' : `Mark ${catName} as active again`}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setDeceasedSheetOpen(true)}
                className="w-full py-3 text-sm text-ink-dim text-center transition-colors hover:text-ink-mid"
              >
                {catName} has passed away →
              </button>
            )}
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
