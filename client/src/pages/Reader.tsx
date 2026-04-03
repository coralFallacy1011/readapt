import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import WordDisplay from '../components/WordDisplay'
import ReaderControls from '../components/ReaderControls'
import { useRSVP } from '../hooks/useRSVP'
import api from '../api'

interface Book {
  _id: string
  title: string
  totalWords: number
  words: string[]
}

export default function Reader() {
  const { bookId } = useParams<{ bookId: string }>()
  const [book, setBook] = useState<Book | null>(null)
  const [initialIndex, setInitialIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const startTimeRef = useRef<number>(Date.now())
  const timeSpentRef = useRef<number>(0)

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

  // Auto-save every 5 seconds while playing
  useEffect(() => {
    if (!book || !rsvp.isPlaying) return
    startTimeRef.current = Date.now()

    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
      timeSpentRef.current += elapsed
      startTimeRef.current = Date.now()

      api.post('/session/update', {
        bookId: book._id,
        lastWordIndex: rsvp.wordIndex,
        currentWPM: rsvp.wpm,
        timeSpent: timeSpentRef.current
      }).catch(() => {/* silent fail */})
    }, 5000)

    return () => clearInterval(interval)
  }, [book, rsvp.isPlaying, rsvp.wordIndex, rsvp.wpm])

  // Save on completion
  useEffect(() => {
    if (!book || !rsvp.isComplete) return
    api.post('/session/update', {
      bookId: book._id,
      lastWordIndex: rsvp.wordIndex,
      currentWPM: rsvp.wpm,
      timeSpent: timeSpentRef.current
    }).catch(() => {/* silent fail */})
  }, [book, rsvp.isComplete, rsvp.wordIndex, rsvp.wpm])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f]">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-[#0f0f0f]">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
          <p className="text-red-400">{error || 'Book not found'}</p>
          <Link to="/library" className="text-orange-400 hover:underline text-sm">Back to Library</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 gap-12">
        <h2 className="text-gray-500 text-sm tracking-wide">{book.title}</h2>

        {/* RSVP word display — centered */}
        <div className="flex items-center justify-center w-full overflow-hidden">
          <WordDisplay word={rsvp.currentWord} />
        </div>

        {/* Controls */}
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
      </main>
    </div>
  )
}
