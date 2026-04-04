import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface Analytics {
  totalWordsRead: number
  booksUploaded: number
  lastSession: { date: string; currentWPM: number } | null
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="card-3d" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>{icon}</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{label}</p>
      <p style={{ color: 'var(--text-accent)', fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics')
      .then(res => setAnalytics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Hero greeting */}
        <div className="animate-fade-up" style={{ marginBottom: '3rem' }}>
          <p style={{ color: 'var(--text-accent)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Welcome back
          </p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {user?.name ?? 'Reader'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            Ready to read faster today?
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div style={{ display: 'flex', gap: '1rem' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: '140px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
            <StatCard icon="📖" label="Words Read" value={analytics?.totalWordsRead.toLocaleString() ?? '0'} sub="all time" />
            <StatCard icon="📚" label="Books Uploaded" value={analytics?.booksUploaded ?? 0} sub="in your library" />
            <StatCard
              icon="⚡"
              label="Last Session"
              value={analytics?.lastSession ? `${analytics.lastSession.currentWPM} WPM` : '—'}
              sub={analytics?.lastSession ? new Date(analytics.lastSession.date).toLocaleDateString() : 'No sessions yet'}
            />
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/library" className="btn-accent" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            📚 Go to Library
          </Link>
          <Link to="/profile" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            📊 View Profile
          </Link>
        </div>
      </main>
    </div>
  )
}
