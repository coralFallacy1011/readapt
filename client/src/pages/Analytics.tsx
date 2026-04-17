import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'

interface TrendPoint {
  date: string
  wpm: number
}

interface SessionStats {
  totalTime: number
  avgSession: number
  sessionCount: number
}

interface GenreItem {
  genre: string
  wordsRead: number
  percentage: number
}

interface ComparisonItem {
  metric: string
  change: number
}

type Period = 'week' | 'month'

function WPMChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <p className="text-gray-500 text-sm">No trend data yet.</p>

  const width = 500
  const height = 120
  const pad = 12
  const minWPM = Math.min(...data.map(d => d.wpm))
  const maxWPM = Math.max(...data.map(d => d.wpm))
  const range = maxWPM - minWPM || 1

  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((d.wpm - minWPM) / range) * (height - pad * 2)
    return { x, y, d }
  })

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
      <polyline points={polyline} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#f97316">
          <title>{p.d.date}: {p.d.wpm} WPM</title>
        </circle>
      ))}
    </svg>
  )
}

function GenreBar({ data }: { data: GenreItem[] }) {
  if (data.length === 0) return <p className="text-gray-500 text-sm">No genre data yet.</p>
  return (
    <div className="space-y-2">
      {data.map(item => (
        <div key={item.genre}>
          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
            <span>{item.genre}</span>
            <span>{item.percentage.toFixed(1)}%</span>
          </div>
          <div className="bg-gray-700 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(item.percentage, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function Analytics() {
  const [period, setPeriod] = useState<Period>('week')
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null)
  const [genres, setGenres] = useState<GenreItem[]>([])
  const [comparison, setComparison] = useState<ComparisonItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/analytics/trends?period=${period}`).catch(() => ({ data: [] })),
      api.get('/analytics/session-stats').catch(() => ({ data: null })),
      api.get('/analytics/genres').catch(() => ({ data: [] })),
      api.get(`/analytics/comparison?period=${period}`).catch(() => ({ data: [] })),
    ]).then(([trendsRes, statsRes, genresRes, compRes]) => {
      setTrends(Array.isArray(trendsRes.data) ? trendsRes.data : trendsRes.data.trends ?? [])
      setSessionStats(statsRes.data)
      setGenres(Array.isArray(genresRes.data) ? genresRes.data : genresRes.data.genres ?? [])
      setComparison(Array.isArray(compRes.data) ? compRes.data : compRes.data.comparison ?? [])
    }).finally(() => setLoading(false))
  }, [period])

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <div className="flex gap-2">
            {(['week', 'month'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${
                  period === p
                    ? 'bg-orange-500 text-white'
                    : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading analytics…</p>
        ) : (
          <>
            {/* WPM Trends */}
            <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-3">
              <h2 className="text-white font-semibold">WPM Over Time</h2>
              <div className="bg-gray-800 rounded-lg p-3">
                <WPMChart data={trends} />
              </div>
            </div>

            {/* Session stats */}
            {sessionStats && (
              <div className="bg-[#1a1a1a] rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4">Session Stats</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#111] rounded-lg p-4 text-center">
                    <p className="text-orange-500 text-2xl font-bold">{formatTime(sessionStats.totalTime)}</p>
                    <p className="text-gray-400 text-xs mt-1">Total Time</p>
                  </div>
                  <div className="bg-[#111] rounded-lg p-4 text-center">
                    <p className="text-orange-500 text-2xl font-bold">{formatTime(sessionStats.avgSession)}</p>
                    <p className="text-gray-400 text-xs mt-1">Avg Session</p>
                  </div>
                  <div className="bg-[#111] rounded-lg p-4 text-center">
                    <p className="text-orange-500 text-2xl font-bold">{sessionStats.sessionCount}</p>
                    <p className="text-gray-400 text-xs mt-1">Sessions</p>
                  </div>
                </div>
              </div>
            )}

            {/* Genre breakdown */}
            <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-3">
              <h2 className="text-white font-semibold">Genre Breakdown</h2>
              <GenreBar data={genres} />
            </div>

            {/* Period comparison */}
            {comparison.length > 0 && (
              <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-3">
                <h2 className="text-white font-semibold">vs. Previous {period}</h2>
                <div className="space-y-2">
                  {comparison.map(item => (
                    <div key={item.metric} className="flex items-center justify-between bg-[#111] rounded-lg px-4 py-3">
                      <span className="text-gray-300 text-sm capitalize">{item.metric.replace(/_/g, ' ')}</span>
                      <span className={`text-sm font-semibold ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
