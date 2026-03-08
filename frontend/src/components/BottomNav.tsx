import { NavLink, useNavigate } from 'react-router-dom'

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

export default function BottomNav() {
  const navigate = useNavigate()
  return (
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
          onClick={() => navigate('/checkin')}
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
      </div>
    </nav>
  )
}
