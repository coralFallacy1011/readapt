import { useEffect, useState, useRef, FormEvent } from 'react'
import Navbar from '../components/Navbar'
import BookCard from '../components/BookCard'
import api from '../api'

interface Book {
  _id: string
  title: string
  totalWords: number
  createdAt: string
}

export default function Library() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
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
    if (!file.name.endsWith('.pdf')) {
      setUploadError('Only PDF files are accepted')
      return
    }
    setUploadError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post('/books/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (fileRef.current) fileRef.current.value = ''
      fetchBooks()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setUploadError(msg ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">My Library</h1>
        </div>

        {/* Upload form */}
        <form onSubmit={handleUpload} className="bg-[#1a1a1a] rounded-xl p-6 mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">Upload a PDF</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
            />
            {uploadError && <p className="text-red-400 text-sm mt-2">{uploadError}</p>}
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {uploading ? 'Uploading...' : 'Upload PDF'}
          </button>
        </form>

        {loading && <p className="text-gray-400">Loading...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && books.length === 0 && (
          <p className="text-gray-500">No books yet. Upload a PDF to get started.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map(book => (
            <BookCard
              key={book._id}
              id={book._id}
              title={book.title}
              totalWords={book.totalWords}
              createdAt={book.createdAt}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
