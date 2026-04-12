import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, updateMe, logout as apiLogout, type User } from '../lib/api'

interface AuthContextValue {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchUser() {
    try {
      const me = await getMe()
      setUser(me)

      // Sync device timezone to backend
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (detectedTz && detectedTz !== me.timezone) {
        updateMe({ timezone: detectedTz }).catch(() => { /* non-fatal */ })
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUser() }, [])

  async function logout() {
    await apiLogout().catch(() => {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
