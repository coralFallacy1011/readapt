import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation()
  const active = pathname === to || (to !== '/' && pathname.startsWith(to))
  return (
    <Link
      to={to}
      style={{
        color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
        fontWeight: active ? 700 : 500,
        fontSize: '0.875rem',
        textDecoration: 'none',
        padding: '0.35rem 0.75rem',
        borderRadius: '8px',
        background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
        border: active ? '1px solid rgba(249,115,22,0.2)' : '1px solid transparent',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {children}
    </Link>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options: { value: 'dark' | 'light' | 'system'; icon: string; label: string }[] = [
    { value: 'light', icon: '☀️', label: 'Light' },
    { value: 'system', icon: '💻', label: 'System' },
    { value: 'dark', icon: '🌙', label: 'Dark' },
  ]

  return (
    <div style={{
      display: 'flex',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      padding: '2px',
      gap: '1px',
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          style={{
            background: theme === opt.value ? 'var(--accent)' : 'transparent',
            border: 'none',
            borderRadius: '16px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '0.7rem',
            transition: 'background 0.2s',
            lineHeight: 1,
          }}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--nav-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 1.5rem',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
    }}>
      {/* Logo */}
      <Link to="/dashboard" style={{
        fontWeight: 900,
        fontSize: '1.3rem',
        color: 'var(--text-accent)',
        textDecoration: 'none',
        letterSpacing: '-0.04em',
        flexShrink: 0,
        background: 'linear-gradient(135deg, #f97316, #facc15)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        Readapt
      </Link>

      {/* Center nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <NavLink to="/dashboard">Home</NavLink>
        <NavLink to="/library">Library</NavLink>
        <NavLink to="/explore">Explore</NavLink>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <ThemeToggle />

        {/* Profile avatar button */}
        <Link
          to="/profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            padding: '0.3rem 0.75rem 0.3rem 0.3rem',
            borderRadius: '24px',
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--border-accent)'
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-glow)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 900, color: '#fff',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
            {user?.name?.split(' ')[0]}
          </span>
        </Link>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            padding: '0.35rem 0.75rem',
            cursor: 'pointer',
            transition: 'color 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#ef4444'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
