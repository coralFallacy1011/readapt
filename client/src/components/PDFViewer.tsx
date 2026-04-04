import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

interface PDFViewerProps {
  pdfUrl: string
  currentPage: number
  totalPages: number
}

export default function PDFViewer({ pdfUrl, currentPage, totalPages }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  // Load PDF once
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    async function load() {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(pdfUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = await res.arrayBuffer()
        if (cancelled) return
        pdfRef.current = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
        if (cancelled) return
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          console.error('PDF load error:', e)
          setError('Could not load PDF. Re-upload the document.')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [pdfUrl])

  // Render page — scale to fill the container (fit-to-page, like a PDF viewer)
  useEffect(() => {
    if (loading || error || !pdfRef.current || !canvasRef.current || !containerRef.current) return

    const pdf = pdfRef.current
    const canvas = canvasRef.current
    const container = containerRef.current
    const pageNum = Math.max(1, Math.min(currentPage, pdf.numPages))

    renderTaskRef.current?.cancel()

    async function render() {
      try {
        const page = await pdf.getPage(pageNum)

        // Get container dimensions (subtract small padding)
        const availW = container.clientWidth - 16
        const availH = container.clientHeight - 16

        // Base viewport at scale 1 to get natural page dimensions
        const baseVp = page.getViewport({ scale: 1 })

        // Scale to fit both width and height — like "fit page" in a PDF viewer
        const scaleW = availW / baseVp.width
        const scaleH = availH / baseVp.height
        const scale = Math.min(scaleW, scaleH)

        const viewport = page.getViewport({ scale })

        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d')!
        const task = page.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = task
        await task.promise
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'RenderingCancelledException') {
          console.error('PDF render error:', e)
        }
      }
    }

    render()

    // Re-render on container resize (e.g. window resize)
    const observer = new ResizeObserver(() => {
      renderTaskRef.current?.cancel()
      render()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [loading, error, currentPage])

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: '#111' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: '28px', height: '28px', border: '3px solid #374151', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>Loading PDF...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', background: '#111' }}>
        <div>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</p>
          <p style={{ color: '#ef4444', fontSize: '0.8rem', lineHeight: 1.6 }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
      {/* Page indicator bar */}
      <div style={{
        padding: '0.3rem 1rem',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', justifyContent: 'center',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
          Page {currentPage} of {totalPages}
        </span>
      </div>

      {/* Canvas container — fills all remaining height, centers the page */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '8px',
          background: '#1a1a1a',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            boxShadow: '0 4px 32px rgba(0,0,0,0.8)',
            borderRadius: '2px',
            // Ensure canvas never overflows its container
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>
    </div>
  )
}
