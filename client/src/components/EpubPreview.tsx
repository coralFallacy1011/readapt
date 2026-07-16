import { useEffect, useState } from 'react'
import api from '../api'

interface EpubPreviewProps {
  bookId: string
}

export default function EpubPreview({ bookId }: EpubPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/books/${bookId}/preview`)
      .then(res => {
        const preview: string = res.data.previewContent ?? ''
        setContent(preview)
      })
      .catch(() => {
        setContent(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [bookId])

  if (loading) {
    return (
      <div style={{
        height: '80px',
        borderRadius: '6px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, var(--border) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s infinite',
        }} />
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    )
  }

  if (!content) {
    return (
      <div style={{
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        color: 'var(--text-muted)',
      }}>
        📖
      </div>
    )
  }

  const displayText = content.length > 200 ? content.slice(0, 200) + '…' : content

  return (
    <div style={{
      height: '80px',
      padding: '0.5rem 0.6rem',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      overflow: 'hidden',
      fontSize: '0.7rem',
      lineHeight: 1.45,
      color: 'var(--text-muted)',
      wordBreak: 'break-word',
    }}>
      {displayText}
    </div>
  )
}
