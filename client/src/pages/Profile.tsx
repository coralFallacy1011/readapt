import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../api'
import ReadingDNAChart from '../components/ReadingDNAChart'
import BadgeDisplay from '../components/BadgeDisplay'

interface ProfileData {
  heatmap: Record<string, number>
  streak: number
  totalWordsRead: number
  booksUploaded: number
}

interface ReadingDNA {
  wpmHistory: Array<{ date: string; wpm: number }>
  activityHeatmap: number[][]
  genreAffinity: Array<{ genre: string; wordsRead: number; percentage: number }>
}

// ── Heatmap helpers ────────────────────────────────────────────────────────────

function getLast365Days(): string[] {
  const days: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = 364; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(cursor.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function getColor(words: number): string {
  if (words === 0) return 'var(--bg-elevated)'
  if (words < 500) return '#431407'
  if (words < 1500) return '#9a3412'
  if (words < 3000) return '#ea580c'
  return '#f97316'
}

function getWeeks(days: string[]): string[][] {
  // Pad start so first day aligns to its weekday (0=Sun)
  const firstDay = new Date(days[0])
  const pad = firstDay.getDay() // 0-6
  const padded: (string | null)[] = [...Array(pad).fill(null), ...days]
  const weeks: string[][] = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7) as string[])
  }
  return weeks
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function Heatmap({ heatmap }: { heatmap: Record<string, number> }) {
  const days = getLast365Days()
  const weeks = getWeeks(days)

  // Month label positions
  const monthPositions: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstReal = week.find(d => d !== null)
    if (firstReal) {
      const m = new Date(firstReal).getMonth()
      if (m !== lastMonth) {
        monthPositions.push({ label: MONTH_LABELS[m], col: wi })
        lastMonth = m
      }
    }
  })

  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
      {/* Month labels */}
      <div style={{ display: 'flex', marginLeft: '28px', marginBottom: '4px', position: 'relative', height: '16px' }}>
        {monthPositions.map(({ label, col }) => (
          <span key={`${label}-${col}`} style={{
            position: 'absolute',
            left: `${col * 14}px`,
            fontSize: '10px',
            color: '#6b7280',
            whiteSpace: 'nowrap',
          }}>{label}</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '2px' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '4px' }}>
          {DAY_LABELS.map((d, i) => (
            <span key={d} style={{
              fontSize: '9px', color: '#4b5563',
              height: '12px', lineHeight: '12px',
              visibility: i % 2 === 0 ? 'visible' : 'hidden',
            }}>{d}</span>
          ))}
        </div>

        {/* Grid */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} style={{ width: '12px', height: '12px' }} />
              const words = heatmap[day] ?? 0
              return (
                <div
                  key={day}
                  onMouseEnter={e => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect()
                    setTooltip({
                      text: `${day}: ${words.toLocaleString()} words`,
                      x: rect.left + window.scrollX,
                      y: rect.top + window.scrollY - 28,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    width: '12px', height: '12px',
                    borderRadius: '2px',
                    background: getColor(words),
                    cursor: 'default',
                    transition: 'transform 0.1s',
                  }}
                  onMouseOver={e => ((e.target as HTMLElement).style.transform = 'scale(1.4)')}
                  onMouseOut={e => ((e.target as HTMLElement).style.transform = 'scale(1)')}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', marginLeft: '28px' }}>
        <span style={{ fontSize: '10px', color: '#6b7280' }}>Less</span>
        {['#1a1a1a', '#431407', '#9a3412', '#ea580c', '#f97316'].map(c => (
          <div key={c} style={{ width: '12px', height: '12px', borderRadius: '2px', background: c }} />
        ))}
        <span style={{ fontSize: '10px', color: '#6b7280' }}>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x, top: tooltip.y,
          background: '#1a1a1a',
          border: '1px solid rgba(249,115,22,0.3)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '11px',
          color: '#e5e5e5',
          pointerEvents: 'none',
          zIndex: 100,
          whiteSpace: 'nowrap',
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card-3d" style={{ padding: '1.5rem', minWidth: '140px', flex: 1 }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ color: 'var(--text-accent)', fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.3rem' }}>{sub}</p>}
    </div>
  )
}

// ── Streak flame ───────────────────────────────────────────────────────────────
function StreakBadge({ streak }: { streak: number }) {
  return (
    <div className="card-3d" style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      background: streak > 0 ? 'rgba(249,115,22,0.08)' : undefined,
      borderColor: streak > 0 ? 'rgba(249,115,22,0.3)' : undefined,
      padding: '1.5rem', flex: 1, minWidth: '140px',
    }}>
      <span style={{ fontSize: '2.5rem', filter: streak > 0 ? 'drop-shadow(0 0 8px #f97316)' : 'grayscale(1)' }}>🔥</span>
      <div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Streak</p>
        <p style={{ color: streak > 0 ? 'var(--text-accent)' : 'var(--text-muted)', fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>
          {streak} {streak === 1 ? 'day' : 'days'}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
          {streak === 0 ? 'Read today to start your streak' : 'Keep it going!'}
        </p>
      </div>
    </div>
  )
}

// ── Theme settings + sign out ──────────────────────────────────────────────────
function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const options: { value: 'dark' | 'light' | 'system'; icon: string; label: string; desc: string }[] = [
    { value: 'light', icon: '☀️', label: 'Light', desc: 'Bright and clean' },
    { value: 'dark', icon: '🌙', label: 'Dark', desc: 'Easy on the eyes' },
    { value: 'system', icon: '💻', label: 'System', desc: 'Follows your OS' },
  ]

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="card-3d" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>Appearance</h2>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            style={{
              flex: 1, minWidth: '100px',
              background: theme === opt.value ? 'rgba(249,115,22,0.12)' : 'var(--bg-elevated)',
              border: `1px solid ${theme === opt.value ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`,
              borderRadius: '10px', padding: '0.75rem 1rem',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>{opt.icon}</div>
            <p style={{ color: theme === opt.value ? 'var(--text-accent)' : 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>{opt.label}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '0.2rem 0 0' }}>{opt.desc}</p>
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link
          to="/settings"
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          🔒 Privacy settings
        </Link>
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px',
            color: '#ef4444',
            fontSize: '0.875rem',
            fontWeight: 600,
            padding: '0.6rem 1.25rem',
            cursor: 'pointer',
            transition: 'background 0.2s, border-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'
          }}
        >
          ↩ Sign out
        </button>
      </div>
    </div>
  )
}

// ── Main profile page ──────────────────────────────────────────────────────────
export default function Profile() {
  const { user } = useAuth()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dna, setDna] = useState<ReadingDNA | null>(null)
  const [badges, setBadges] = useState<string[]>([])

  useEffect(() => {
    api.get('/analytics/profile')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))

    api.get('/ml/reading-dna')
      .then(res => setDna(res.data))
      .catch(() => {})

    api.get('/gamification/badges')
      .then(res => {
        const raw = res.data
        const list: string[] = Array.isArray(raw) ? raw : raw.badges ?? raw.earnedBadges ?? []
        setBadges(list)
      })
      .catch(() => {})
  }, [])

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', fontWeight: 900, color: '#fff',
            boxShadow: '0 0 24px rgba(249,115,22,0.4)',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{user?.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.2rem 0 0' }}>{user?.email}</p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading your stats...</p>
        ) : data ? (
          <>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <StreakBadge streak={data.streak} />
              <StatCard label="Total Words Read" value={data.totalWordsRead.toLocaleString()} sub="all time" />
              <StatCard label="Books Uploaded" value={data.booksUploaded} sub="in your library" />
            </div>

            <div className="card-3d" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1.25rem' }}>
                Reading activity — last 365 days
              </h2>
              <Heatmap heatmap={data.heatmap} />
            </div>

            {/* Reading DNA */}
            {dna && (
              <div className="mb-6">
                <ReadingDNAChart
                  wpmHistory={dna.wpmHistory}
                  activityHeatmap={dna.activityHeatmap}
                  genreAffinity={dna.genreAffinity}
                />
              </div>
            )}

            {/* Badge showcase */}
            <div className="mb-6">
              <BadgeDisplay earnedBadges={badges} />
            </div>
          </>
        ) : (
          <p style={{ color: '#ef4444' }}>Failed to load profile data.</p>
        )}

        {/* Settings */}
        <ThemeSettings />
      </main>
    </div>
  )
}
