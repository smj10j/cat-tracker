import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCats, deleteCat, type Cat } from '../lib/api'
import QuickAdd from '../components/QuickAdd'

function catAge(birthdate: string): string {
  const birth = new Date(birthdate)
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`
}

export default function Home() {
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCats()
      .then(setCats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(cat: Cat) {
    if (!confirm(`Delete ${cat.name} and all their measurements?`)) return
    try {
      await deleteCat(cat.id)
      setCats((prev) => prev.filter((c) => c.id !== cat.id))
    } catch (e: unknown) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-700 flex items-center gap-2">
          <span>🐱</span> Cat Tracker
        </h1>
        <div className="flex gap-2">
          <Link
            to="/compare"
            className="border border-brand-600 text-brand-600 px-4 py-2 rounded-lg hover:bg-brand-50 transition-colors text-sm font-medium"
          >
            Compare
          </Link>
          <Link
            to="/import"
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Import
          </Link>
          <Link
            to="/cats/new"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          >
            + Add Cat
          </Link>
        </div>
      </header>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
      )}

      {!loading && !error && cats.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🐾</div>
          <p className="text-gray-500 mb-4">No cats yet. Add your first cat!</p>
          <Link
            to="/cats/new"
            className="bg-brand-600 text-white px-6 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            + Add Cat
          </Link>
        </div>
      )}

      <QuickAdd onAdded={() => getCats().then(setCats)} />

      <ul className="space-y-3">
        {cats.map((cat) => (
          <li
            key={cat.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 p-4"
          >
            <div className="text-4xl">🐱</div>
            <div className="flex-1 min-w-0">
              <Link
                to={`/cats/${cat.id}`}
                className="font-semibold text-lg text-gray-900 hover:text-brand-600"
              >
                {cat.name}
              </Link>
              <div className="text-sm text-gray-500 flex gap-3">
                <span>{catAge(cat.birthdate)} old</span>
                {cat.breed && <span>{cat.breed}</span>}
                {cat.coloring && <span>{cat.coloring}</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                to={`/cats/${cat.id}`}
                className="text-sm text-brand-600 hover:underline font-medium"
              >
                View
              </Link>
              <button
                onClick={() => handleDelete(cat)}
                className="text-sm text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
