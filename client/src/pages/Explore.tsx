import { useEffect, useState, useRef } from 'react'
import Navbar from '../components/Navbar'
import * as socialApi from '../api/social'

interface PublicBook {
  _id: string
  title: string
  totalWords: number
  createdAt: string
  owner: { _id: string; name: string }
}

interface UserResult {
  _id: string
  name: string
}

type Tab = 'library' | 'people' | 'feed'

// ── Public Library Tab ────────────────────────────────────────────────────────
function PublicLibraryTab() {
  const [books, setBooks] = useState<PublicBook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    socialApi.getPublicBooks()
      .then(r => setBooks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ height: '180px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
      ))}
    </div>
  )

  if (books.length === 0) return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
      <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌍</p>
      <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No public books yet</p>
      <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Make your books public from your Library to share them here</p>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
      {books.map(book => (
        <div key={book._id} className="card-3d" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '2rem' }}>📄</div>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, margin: 0 }}>{book.title}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{book.totalWords.toLocaleString()} words</p>
          <p style={{ color: 'var(--text-accent)', fontSize: '0.78rem', fontWeight: 600 }}>by {book.owner?.name ?? 'Unknown'}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(book.createdAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  )
}

// ── Find People Tab ───────────────────────────────────────────────────────────
function FindPeopleTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    socialApi.getFollowing()
      .then(r => setFollowing(new Set((r.data as UserResult[]).map(u => u._id))))
      .catch(() => {})
  }, [])

  function handleSearch(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(() => {
      socialApi.searchUsers(val)
        .then(r => setResults(r.data))
        .catch(() => {})
    }, 300)
  }

  async function toggleFollow(userId: string) {
    setLoadingFollow(userId)
    try {
      if (following.has(userId)) {
        await socialApi.unfollowUser(userId)
        setFollowing(prev => { const s = new Set(prev); s.delete(userId); return s })
      } else {
        await socialApi.followUser(userId)
        setFollowing(prev => new Set(prev).add(userId))
      }
    } catch {}
    setLoadingFollow(null)
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <input
        className="input"
        placeholder="Search by name..."
        value={query}
        onChange={e => handleSearch(e.target.value)}
        style={{ marginBottom: '1.5rem' }}
      />
      {results.length === 0 && query.trim() && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No users found for "{query}"</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {results.map(user => (
          <div key={user._id} className="card-3d" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 900, color: '#fff', flexShrink: 0
              }}>
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</span>
            </div>
            <button
              className={following.has(user._id) ? 'btn-ghost' : 'btn-accent'}
              disabled={loadingFollow === user._id}
              onClick={() => toggleFollow(user._id)}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              {loadingFollow === user._id ? '...' : following.has(user._id) ? 'Unfollow' : 'Follow'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Following Feed Tab ────────────────────────────────────────────────────────
function FollowingFeedTab() {
  const [books, setBooks] = useState<PublicBook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    socialApi.getFollowingFeed()
      .then(r => setBooks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: '180px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
      ))}
    </div>
  )

  if (books.length === 0) return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
      <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</p>
      <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nothing in your feed yet</p>
      <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Follow people and they'll appear here when they share books</p>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
      {books.map(book => (
        <div key={book._id} className="card-3d" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '2rem' }}>📄</div>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, margin: 0 }}>{book.title}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{book.totalWords.toLocaleString()} words</p>
          <p style={{ color: 'var(--text-accent)', fontSize: '0.78rem', fontWeight: 600 }}>by {book.owner?.name ?? 'Unknown'}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(book.createdAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main Explore Page ─────────────────────────────────────────────────────────
export default function Explore() {
  const [tab, setTab] = useState<Tab>('library')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'library', label: 'Public Library', icon: '🌍' },
    { id: 'people', label: 'Find People', icon: '👥' },
    { id: 'feed', label: 'Following Feed', icon: '📡' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Explore</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Discover books and readers</p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t.id ? 'var(--text-accent)' : 'var(--text-secondary)',
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: '0.875rem',
                padding: '0.6rem 1rem',
                cursor: 'pointer',
                transition: 'color 0.2s, border-color 0.2s',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'library' && <PublicLibraryTab />}
        {tab === 'people' && <FindPeopleTab />}
        {tab === 'feed' && <FollowingFeedTab />}
      </main>
    </div>
  )
}
