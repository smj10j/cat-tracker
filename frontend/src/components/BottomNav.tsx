import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  onLog: () => void
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#c084fc' : '#6b5f85'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#c084fc' : '#6b5f85'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function UserAvatar({ avatarUrl, initial }: { avatarUrl: string | null; initial: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Your avatar"
        className="w-7 h-7 rounded-full object-cover"
        style={{ border: '1.5px solid rgba(192,132,252,0.3)' }}
      />
    )
  }
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
      style={{ background: 'rgba(192,132,252,0.2)', color: '#c084fc', border: '1.5px solid rgba(192,132,252,0.3)' }}
    >
      {initial}
    </div>
  )
}

export default function BottomNav({ onLog }: Props) {
  const { user, logout } = useAuth()
  const [showProfile, setShowProfile] = useState(false)

  const initial = user?.display_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <>
      {/* Profile popover */}
      {showProfile && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="absolute bottom-20 right-4 rounded-2xl p-4 space-y-3 min-w-[180px]"
            style={{
              background: '#2a2040',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <p className="text-sm font-semibold text-ink truncate">{user?.display_name ?? 'You'}</p>
              <p className="text-xs text-ink-dim truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => { setShowProfile(false); logout() }}
              className="w-full text-left text-sm text-rose py-1"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'rgba(31, 24, 48, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center justify-around px-4 pt-2 pb-2 max-w-lg mx-auto">
          {/* Home */}
          <NavLink to="/" end className="flex flex-col items-center gap-1 py-1 px-5">
            {({ isActive }) => (
              <>
                <HomeIcon active={isActive} />
                <span className="text-[10px] font-medium" style={{ color: isActive ? '#c084fc' : '#6b5f85' }}>Cats</span>
              </>
            )}
          </NavLink>

          {/* Center Log button */}
          <button
            onClick={onLog}
            className="flex flex-col items-center -mt-6"
            aria-label="Log a measurement"
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
                boxShadow: '0 4px 20px rgba(168,85,247,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                color: 'white',
                fontWeight: 300,
                lineHeight: 1,
                border: '3px solid #16111f',
              }}
            >
              +
            </div>
            <span className="text-[10px] font-medium mt-1" style={{ color: '#6b5f85' }}>Log</span>
          </button>

          {/* Compare */}
          <NavLink to="/compare" className="flex flex-col items-center gap-1 py-1 px-4">
            {({ isActive }) => (
              <>
                <ChartIcon active={isActive} />
                <span className="text-[10px] font-medium" style={{ color: isActive ? '#c084fc' : '#6b5f85' }}>Compare</span>
              </>
            )}
          </NavLink>

          {/* User avatar */}
          <button
            onClick={() => setShowProfile(prev => !prev)}
            className="flex flex-col items-center gap-1 py-1 px-3"
            aria-label="Account"
          >
            <UserAvatar avatarUrl={user?.avatar_url ?? null} initial={initial} />
            <span className="text-[10px] font-medium" style={{ color: '#6b5f85' }}>You</span>
          </button>
        </div>
      </nav>
    </>
  )
}
