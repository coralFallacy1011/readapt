import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Card from '../components/Card'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface Analytics {
  totalWordsRead: number
  booksUploaded: number
  lastSession: { date: string; currentWPM: number } | null
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-white text-3xl font-bold">{value}</p>
      {sub && <p className="text-gray-600 text-xs">{sub}</p>}
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics')
      .then(res => setAnalytics(res.data))
      .catch(() => {/* silent fail */})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-gray-500 mb-8">Here's your reading summary.</p>

        {loading ? (
          <p className="text-gray-400">Loading analytics...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <StatCard
              label="Total Words Read"
              value={analytics?.totalWordsRead.toLocaleString() ?? '0'}
            />
            <StatCard
              label="Books Uploaded"
              value={analytics?.booksUploaded ?? 0}
            />
            <StatCard
              label="Last Session"
              value={analytics?.lastSession ? `${analytics.lastSession.currentWPM} WPM` : '—'}
              sub={analytics?.lastSession ? new Date(analytics.lastSession.date).toLocaleDateString() : undefined}
            />
          </div>
        )}

        <div className="flex gap-4">
          <Link
            to="/library"
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Go to Library
          </Link>
        </div>
      </main>
    </div>
  )
}
