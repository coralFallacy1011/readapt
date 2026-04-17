import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import StreakDisplay from '../components/StreakDisplay'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface Analytics {
  totalWordsRead: number
  booksUploaded: number
  lastSession: { date: string; currentWPM: number } | null
}

interface StreakData {
  currentStreak: number
  longestStreak: number
  lastReadDate?: string
  badges?: string[]
}

interface BookRecommendation {
  bookId?: string
  title: string
  author?: string
  reason?: string
  confidence?: number
}

interface ReadingDNA {
  averageWPM?: number
  enduranceScore?: number
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
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>([])
  const [readingDNA, setReadingDNA] = useState<ReadingDNA | null>(null)

  useEffect(() => {
    api.get('/analytics')
      .then(res => setAnalytics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))

    api.get('/gamification/streak')
      .then(res => setStreak(res.data))
      .catch(() => {})

    api.get('/ml/recommendations/books')
      .then(res => {
        const data = res.data
        const list: BookRecommendation[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.recommendations)
            ? data.recommendations
            : []
        setRecommendations(list.slice(0, 3))
      })
      .catch(() => {})

    api.get('/ml/reading-dna')
      .then(res => setReadingDNA(res.data))
      .catch(() => {})
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

        {/* Streak */}
        {streak && (
          <div style={{ marginBottom: '3rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '1rem' }}>
              Reading Streak
            </p>
            <StreakDisplay
              currentStreak={streak.currentStreak}
              longestStreak={streak.longestStreak}
              lastReadDate={streak.lastReadDate}
              badges={streak.badges}
            />
          </div>
        )}

        {/* Book Recommendations */}
        {recommendations.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '1rem' }}>
              Recommended for You
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {recommendations.map((rec, i) => (
                <div key={rec.bookId ?? i} className="card-3d" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📘</div>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{rec.title}</p>
                  {rec.author && <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rec.author}</p>}
                  {rec.reason && <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.5rem' }}>{rec.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reading DNA Preview */}
        {readingDNA && (readingDNA.averageWPM != null || readingDNA.enduranceScore != null) && (
          <div style={{ marginBottom: '3rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '1rem' }}>
              Reading DNA
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {readingDNA.averageWPM != null && (
                <StatCard icon="🧬" label="Average WPM" value={Math.round(readingDNA.averageWPM)} sub="your reading speed" />
              )}
              {readingDNA.enduranceScore != null && (
                <StatCard icon="💪" label="Endurance Score" value={Math.round(readingDNA.enduranceScore)} sub="reading stamina" />
              )}
            </div>
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
