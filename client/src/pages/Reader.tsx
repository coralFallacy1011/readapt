import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import WordDisplay from '../components/WordDisplay'
import ReaderControls from '../components/ReaderControls'
import PDFViewer from '../components/PDFViewer'
import SpeedRecommendationModal from '../components/SpeedRecommendationModal'
import QuizModal from '../components/QuizModal'
import { useRSVP } from '../hooks/useRSVP'
import api from '../api'

interface Book {
  _id: string
  title: string
  totalWords: number
  words: string[]
  pageWordCounts?: number[]
}

interface SpeedRecommendation {
  _id: string
  recommendedWPM: number
  rationale: string
  confidence: number
}

interface Quiz {
  _id: string
  questions: {
    question: string
    options: string[]
    correctIndex: number
    category: string
    explanation: string
  }[]
}

export default function Reader() {
  const { bookId } = useParams<{ bookId: string }>()
  const [book, setBook] = useState<Book | null>(null)
  const [initialIndex, setInitialIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const startTimeRef = useRef<number>(Date.now())
  const timeSpentRef = useRef<number>(0)
  const lastSavedIndexRef = useRef<number>(0)

  // Speed recommendation state
  const [speedRec, setSpeedRec] = useState<SpeedRecommendation | null>(null)
  const [speedRecOpen, setSpeedRecOpen] = useState(false)
  const activeReadingSecondsRef = useRef(0)
  const lastSpeedCheckRef = useRef(0)

  // Bookmark state
  const [bookmarkMsg, setBookmarkMsg] = useState(false)

  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)

  useEffect(() => {
    if (!bookId) return
    Promise.all([
      api.get(`/books/${bookId}`),
      api.get(`/session/${bookId}`)
    ])
      .then(([bookRes, sessionRes]) => {
        setBook(bookRes.data.book)
        const session = sessionRes.data.session
        if (session) {
          setInitialIndex(session.lastWordIndex)
          lastSavedIndexRef.current = session.lastWordIndex
          timeSpentRef.current = session.timeSpent ?? 0
        }
      })
      .catch(() => setError('Failed to load book'))
      .finally(() => setLoading(false))
  }, [bookId])

  const rsvp = useRSVP({
    words: book?.words ?? [],
    initialIndex,
    initialWPM: 300
  })

  useEffect(() => {
    if (!book || !rsvp.isPlaying) return
    startTimeRef.current = Date.now()
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
      timeSpentRef.current += elapsed
      startTimeRef.current = Date.now()
      const delta = rsvp.wordIndex - lastSavedIndexRef.current
      lastSavedIndexRef.current = rsvp.wordIndex
      api.post('/session/update', {
        bookId: book._id, lastWordIndex: rsvp.wordIndex,
        currentWPM: rsvp.wpm, timeSpent: timeSpentRef.current,
        wordsReadDelta: delta > 0 ? delta : 0
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [book, rsvp.isPlaying, rsvp.wordIndex, rsvp.wpm])

  useEffect(() => {
    if (!book || !rsvp.isComplete) return
    const delta = rsvp.wordIndex - lastSavedIndexRef.current
    lastSavedIndexRef.current = rsvp.wordIndex
    api.post('/session/update', {
      bookId: book._id, lastWordIndex: rsvp.wordIndex,
      currentWPM: rsvp.wpm, timeSpent: timeSpentRef.current,
      wordsReadDelta: delta > 0 ? delta : 0
    }).catch(() => {})
  }, [book, rsvp.isComplete, rsvp.wordIndex, rsvp.wpm])

  // Speed recommendation: check every 5 minutes of active reading
  useEffect(() => {
    if (!book || !rsvp.isPlaying) return
    const interval = setInterval(() => {
      activeReadingSecondsRef.current += 5
      if (activeReadingSecondsRef.current - lastSpeedCheckRef.current >= 300) {
        lastSpeedCheckRef.current = activeReadingSecondsRef.current
        api.get(`/ml/speed-recommendation?bookId=${book._id}`)
          .then(res => {
            const rec = res.data
            if (rec && rec.recommendedWPM) {
              setSpeedRec(rec)
              setSpeedRecOpen(true)
            }
          })
          .catch(() => {})
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [book, rsvp.isPlaying])

  const handleSpeedRecAccept = useCallback((wpm: number) => {
    if (!speedRec) return
    api.post('/ml/speed-recommendation/respond', { recommendationId: speedRec._id, accepted: true }).catch(() => {})
    rsvp.setWPM(wpm)
    setSpeedRecOpen(false)
    setSpeedRec(null)
  }, [speedRec, rsvp])

  const handleSpeedRecReject = useCallback(() => {
    if (!speedRec) return
    api.post('/ml/speed-recommendation/respond', { recommendationId: speedRec._id, accepted: false }).catch(() => {})
    setSpeedRecOpen(false)
    setSpeedRec(null)
  }, [speedRec])

  const handleBookmark = useCallback(() => {
    if (!book) return
    api.post('/bookmarks', {
      bookId: book._id,
      type: 'bookmark',
      wordIndex: rsvp.wordIndex,
      contextText: rsvp.currentWord || ''
    }).catch(() => {})
    setBookmarkMsg(true)
    setTimeout(() => setBookmarkMsg(false), 2000)
  }, [book, rsvp.wordIndex, rsvp.currentWord])

  const handleTakeQuiz = useCallback(async () => {
    if (!book) return
    try {
      const res = await api.post('/quizzes/generate', {
        bookId: book._id,
        startWordIndex: 0,
        endWordIndex: rsvp.wordIndex
      })
      setQuiz(res.data)
      setQuizOpen(true)
    } catch {
      // ignore
    }
  }, [book, rsvp.wordIndex])

  const handleQuizSubmit = useCallback(async (answers: number[]) => {
    if (!quiz) throw new Error('No quiz')
    const res = await api.post(`/quizzes/${quiz._id}/submit`, { answers })
    return res.data
  }, [quiz])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <p style={{ color: '#ef4444' }}>{error || 'Book not found'}</p>
          <Link to="/library" style={{ color: 'var(--text-accent)', fontSize: '0.875rem' }}>Back to Library</Link>
        </div>
      </div>
    )
  }

  function getPageForWordIndex(wordIndex: number, pageWordCounts: number[]): number {
    let cumulative = 0
    for (let i = 0; i < pageWordCounts.length; i++) {
      cumulative += pageWordCounts[i]
      if (wordIndex < cumulative) return i + 1
    }
    return pageWordCounts.length || 1
  }

  function getFirstWordOfPage(pageNum: number, pageWordCounts: number[]): number {
    let cumulative = 0
    for (let i = 0; i < pageNum - 1; i++) cumulative += pageWordCounts[i]
    return cumulative
  }

  const pageWordCounts = book.pageWordCounts ?? []
  const currentPage = pageWordCounts.length ? getPageForWordIndex(rsvp.wordIndex, pageWordCounts) : 1
  const totalPages = pageWordCounts.length || 1

  function handlePageJump(page: number) {
    const target = Math.max(1, Math.min(page, totalPages))
    const wordIdx = pageWordCounts.length ? getFirstWordOfPage(target, pageWordCounts) : 0
    rsvp.seekTo(wordIdx)
  }

  const pdfUrl = `${import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'}/books/${book._id}/pdf`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <Navbar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT 50%: PDF preview ── */}
        <div style={{
          width: '50%',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0, background: 'var(--bg-surface)', gap: '0.75rem',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Document
            </span>

            {/* Page jump controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => handlePageJump(currentPage - 1)}
                disabled={currentPage <= 1}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px', width: '22px', height: '22px', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage <= 1 ? 0.3 : 1 }}
              >‹</button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>p.</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={e => handlePageJump(Number(e.target.value))}
                  style={{
                    width: '40px', background: 'var(--bg-input)',
                    border: '1px solid var(--border)', borderRadius: '4px',
                    color: 'var(--text-accent)', fontSize: '0.75rem', textAlign: 'center',
                    padding: '2px 4px', outline: 'none',
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/ {totalPages}</span>
              </div>

              <button
                onClick={() => handlePageJump(currentPage + 1)}
                disabled={currentPage >= totalPages}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px', width: '22px', height: '22px', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage >= totalPages ? 0.3 : 1 }}
              >›</button>
            </div>

            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
              {book.title}
            </span>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <PDFViewer pdfUrl={pdfUrl} currentPage={currentPage} totalPages={totalPages} />
          </div>
        </div>

        {/* ── RIGHT 50%: RSVP reader ── */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Panel header */}
          <div style={{
            padding: '0.6rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0, background: 'var(--bg-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Speed Reader
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {bookmarkMsg && (
                <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 600 }}>Bookmarked!</span>
              )}
              <button
                onClick={handleBookmark}
                title="Bookmark current position"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '2px 4px', borderRadius: '4px', color: 'var(--text-muted)' }}
              >🔖</button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                {rsvp.wordIndex + 1} / {book.totalWords} words
              </span>
            </div>
          </div>

          {/* RSVP content */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '2rem 1.5rem', gap: '2.5rem', overflow: 'hidden',
            background: 'var(--bg-base)',
          }}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute', top: '50%', left: '5%', right: '5%',
                height: '1px', background: 'rgba(249,115,22,0.12)',
                transform: 'translateY(-50%)', pointerEvents: 'none',
              }} />
              <WordDisplay word={rsvp.currentWord} />
            </div>

            {rsvp.isComplete && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  color: 'var(--text-accent)', fontWeight: 700, fontSize: '0.95rem',
                  background: 'rgba(249,115,22,0.1)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  borderRadius: '10px', padding: '0.6rem 1.5rem',
                }}>
                  ✓ Reading complete!
                </div>
                <button
                  onClick={handleTakeQuiz}
                  style={{
                    background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)',
                    color: 'var(--text-accent)', borderRadius: '8px', padding: '0.45rem 1.25rem',
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Take Quiz
                </button>
              </div>
            )}

            <ReaderControls
              isPlaying={rsvp.isPlaying}
              isComplete={rsvp.isComplete}
              wpm={rsvp.wpm}
              wordIndex={rsvp.wordIndex}
              totalWords={book.totalWords}
              onStart={rsvp.start}
              onPause={rsvp.pause}
              onResume={rsvp.resume}
              onReset={rsvp.reset}
              onWPMChange={rsvp.setWPM}
            />
          </div>
        </div>
      </div>

      {/* Speed Recommendation Modal */}
      {speedRec && (
        <SpeedRecommendationModal
          isOpen={speedRecOpen}
          currentWPM={rsvp.wpm}
          recommendedWPM={speedRec.recommendedWPM}
          rationale={speedRec.rationale ?? ''}
          confidence={speedRec.confidence ?? 0.8}
          onAccept={handleSpeedRecAccept}
          onReject={handleSpeedRecReject}
        />
      )}

      {/* Quiz Modal */}
      <QuizModal
        isOpen={quizOpen}
        quiz={quiz}
        onSubmit={handleQuizSubmit}
        onClose={() => { setQuizOpen(false); setQuiz(null) }}
      />
    </div>
  )
}
