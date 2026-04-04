import { useEffect, useState, useRef, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../api'
import { toggleBookVisibility } from '../api/social'

interface Book {
  _id: string
  title: string
  totalWords: number
  createdAt: string
  isPublic: boolean
}

function BookCard({ book, onToggleVisibility }: { book: Book; onToggleVisibility: (id: string) => void }) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    setToggling(true)
    try {
      await toggleBookVisibility(book._id)
      onToggleVisibility(book._id)
    } catch {}
    setToggling(false)
  }

  return (
    <div className="card-3d" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '2rem' }}>📄</div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={book.isPublic ? 'Make private' : 'Make public'}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0.2rem 0.4rem',
            lineHeight: 1,
            opacity: toggling ? 0.5 : 1,
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          {book.isPublic ? '🌍' : '🔒'}
        </button>
      </div>
      <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, margin: 0 }}>{book.title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{book.totalWords.toLocaleString()} words</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(book.createdAt).toLocaleDateString()}</p>
      <Link
        to={`/reader/${book._id}`}
        className="btn-accent"
        style={{ textDecoration: 'none', textAlign: 'center', marginTop: 'auto', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
      >
        Read →
      </Link>
    </div>
  )
}

export default function Library() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function fetchBooks() {
    setLoading(true)
    api.get('/books')
      .then(res => setBooks(res.data.books))
      .catch(() => setError('Failed to load books'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchBooks() }, [])

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.pdf')) { setUploadError('Only PDF files are accepted'); return }
    setUploadError('')
    setUploadSuccess('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post('/books/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (fileRef.current) fileRef.current.value = ''
      setUploadSuccess('Book uploaded successfully!')
      fetchBooks()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setUploadError(msg ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>My Library</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Your personal reading collection</p>
        </div>

        {/* Upload card */}
        <div className="card-3d" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>Upload a PDF</h2>
          <form onSubmit={handleUpload} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                style={{ display: 'block', width: '100%', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
              />
              {uploadError && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.4rem' }}>{uploadError}</p>}
              {uploadSuccess && <p style={{ color: '#22c55e', fontSize: '0.78rem', marginTop: '0.4rem' }}>{uploadSuccess}</p>}
            </div>
            <button type="submit" disabled={uploading} className="btn-accent" style={{ whiteSpace: 'nowrap' }}>
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          </form>
        </div>

        {/* Book grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ height: '220px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />)}
          </div>
        ) : error ? (
          <p style={{ color: '#ef4444' }}>{error}</p>
        ) : books.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</p>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No books yet</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Upload a PDF to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {books.map(book => <BookCard key={book._id} book={book} onToggleVisibility={(id) => {
              setBooks(prev => prev.map(b => b._id === id ? { ...b, isPublic: !b.isPublic } : b))
            }} />)}
          </div>
        )}
      </main>
    </div>
  )
}
