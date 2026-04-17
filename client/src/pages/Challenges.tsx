import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'

interface Challenge {
  _id: string
  name: string
  status: 'active' | 'completed' | 'cancelled'
  goalType: 'words' | 'books' | 'time'
  goalValue: number
  participants: string[]
  endDate?: string
}

const defaultForm = {
  name: '',
  goalType: 'words' as Challenge['goalType'],
  goalValue: 10000,
  duration: 7,
  participantIds: '',
}

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(defaultForm)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/social/challenges')
      .then(res => setChallenges(Array.isArray(res.data) ? res.data : res.data.challenges ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    setError('')
    try {
      const participantIds = form.participantIds
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const res = await api.post('/social/challenges', {
        name: form.name,
        goalType: form.goalType,
        goalValue: form.goalValue,
        duration: form.duration,
        participantIds,
      })
      setChallenges(prev => [res.data.challenge ?? res.data, ...prev])
      setForm(defaultForm)
    } catch {
      setError('Failed to create challenge.')
    } finally {
      setCreating(false)
    }
  }

  function statusBadge(status: Challenge['status']) {
    const map = {
      active: 'bg-green-500/20 text-green-400',
      completed: 'bg-orange-500/20 text-orange-400',
      cancelled: 'bg-gray-700 text-gray-400',
    }
    return map[status] ?? map.cancelled
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-white">Challenges</h1>

        {/* Create form */}
        <form onSubmit={handleCreate} className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">New Challenge</h2>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Summer Reading Sprint"
              className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Goal Type</label>
              <select
                value={form.goalType}
                onChange={e => setForm(f => ({ ...f, goalType: e.target.value as Challenge['goalType'] }))}
                className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="words">Words</option>
                <option value="books">Books</option>
                <option value="time">Time (min)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Goal Value</label>
              <input
                type="number"
                min={1}
                value={form.goalValue}
                onChange={e => setForm(f => ({ ...f, goalValue: Number(e.target.value) }))}
                className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Duration (days)</label>
              <input
                type="number"
                min={1}
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
                className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Participant IDs (comma-separated, optional)</label>
            <input
              type="text"
              value={form.participantIds}
              onChange={e => setForm(f => ({ ...f, participantIds: e.target.value }))}
              placeholder="userId1, userId2, …"
              className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {creating ? 'Creating…' : 'Create Challenge'}
          </button>
        </form>

        {/* Challenges list */}
        {loading ? (
          <p className="text-gray-500 text-sm">Loading challenges…</p>
        ) : challenges.length === 0 ? (
          <p className="text-gray-500 text-sm">No challenges yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {challenges.map(c => (
              <div key={c._id} className="bg-[#1a1a1a] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{c.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {c.goalValue.toLocaleString()} {c.goalType} · {c.participants.length} participant{c.participants.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusBadge(c.status)}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
