import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import GoalProgress from '../components/GoalProgress'
import api from '../api'

interface Goal {
  _id: string
  type: 'words' | 'time' | 'books'
  period: 'daily' | 'weekly' | 'monthly'
  targetValue: number
  currentValue: number
  status: 'active' | 'achieved' | 'failed' | 'cancelled'
  dailyPace?: number
  endDate?: string
}

const defaultForm = { type: 'words' as Goal['type'], period: 'daily' as Goal['period'], targetValue: 1000 }

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(defaultForm)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/gamification/goals')
      .then(res => setGoals(Array.isArray(res.data) ? res.data : res.data.goals ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const res = await api.post('/gamification/goals', form)
      setGoals(prev => [res.data.goal ?? res.data, ...prev])
      setForm(defaultForm)
    } catch {
      setError('Failed to create goal.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/gamification/goals/${id}`)
      setGoals(prev => prev.filter(g => g._id !== id))
    } catch {
      setError('Failed to delete goal.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-white">Reading Goals</h1>

        {/* Create form */}
        <form onSubmit={handleCreate} className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">New Goal</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as Goal['type'] }))}
                className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="words">Words</option>
                <option value="time">Time (min)</option>
                <option value="books">Books</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Period</label>
              <select
                value={form.period}
                onChange={e => setForm(f => ({ ...f, period: e.target.value as Goal['period'] }))}
                className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Target</label>
              <input
                type="number"
                min={1}
                value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: Number(e.target.value) }))}
                className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {creating ? 'Creating…' : 'Create Goal'}
          </button>
        </form>

        {/* Goals list */}
        {loading ? (
          <p className="text-gray-500 text-sm">Loading goals…</p>
        ) : goals.length === 0 ? (
          <p className="text-gray-500 text-sm">No goals yet. Create one above.</p>
        ) : (
          <div className="space-y-4">
            {goals.map(goal => (
              <div key={goal._id} className="relative">
                <GoalProgress
                  type={goal.type}
                  targetValue={goal.targetValue}
                  currentValue={goal.currentValue}
                  period={goal.period}
                  status={goal.status}
                  dailyPace={goal.dailyPace}
                  endDate={goal.endDate}
                />
                <button
                  onClick={() => handleDelete(goal._id)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-red-400 text-xs transition-colors"
                  title="Delete goal"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
