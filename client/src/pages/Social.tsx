import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'

interface UserResult {
  _id: string
  name: string
  email: string
}

interface ActivityItem {
  _id: string
  type: string
  createdAt: string
  user?: { name: string }
  userId?: { name: string }
}

interface FollowCounts {
  followers: number
  following: number
}

export default function Social() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [feed, setFeed] = useState<ActivityItem[]>([])
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 })
  const [searching, setSearching] = useState(false)
  const [loadingFeed, setLoadingFeed] = useState(true)

  useEffect(() => {
    // Load activity feed
    api.get('/social/activity/feed')
      .then(res => setFeed(Array.isArray(res.data) ? res.data : res.data.activities ?? []))
      .catch(() => {})
      .finally(() => setLoadingFeed(false))

    // Load follower/following counts
    Promise.all([
      api.get('/social/followers').catch(() => ({ data: [] })),
      api.get('/social/following').catch(() => ({ data: [] })),
    ]).then(([followersRes, followingRes]) => {
      const followersList = Array.isArray(followersRes.data) ? followersRes.data : followersRes.data.followers ?? []
      const followingList = Array.isArray(followingRes.data) ? followingRes.data : followingRes.data.following ?? []
      setCounts({ followers: followersList.length, following: followingList.length })
      setFollowing(new Set(followingList.map((u: UserResult) => u._id)))
    })
  }, [])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await api.get(`/social/users/search?q=${encodeURIComponent(query)}`)
      setSearchResults(Array.isArray(res.data) ? res.data : res.data.users ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  async function toggleFollow(userId: string) {
    if (following.has(userId)) {
      await api.delete(`/social/follow/${userId}`).catch(() => {})
      setFollowing(prev => { const s = new Set(prev); s.delete(userId); return s })
      setCounts(c => ({ ...c, following: Math.max(0, c.following - 1) }))
    } else {
      await api.post('/social/follow', { userId }).catch(() => {})
      setFollowing(prev => new Set(prev).add(userId))
      setCounts(c => ({ ...c, following: c.following + 1 }))
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function activityLabel(type: string) {
    const map: Record<string, string> = {
      reading_session: '📖 Reading session',
      book_completed: '✅ Completed a book',
      goal_achieved: '🎯 Achieved a goal',
      challenge_joined: '⚔️ Joined a challenge',
      challenge_completed: '🏆 Completed a challenge',
    }
    return map[type] ?? type
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Social</h1>
          <div className="flex gap-4 text-sm text-gray-400">
            <span><span className="text-white font-semibold">{counts.followers}</span> followers</span>
            <span><span className="text-white font-semibold">{counts.following}</span> following</span>
          </div>
        </div>

        {/* User search */}
        <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Find Readers</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="flex-1 bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={searching}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {searching ? '…' : 'Search'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <ul className="space-y-2">
              {searchResults.map(u => (
                <li key={u._id} className="flex items-center justify-between bg-[#111] rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{u.name}</p>
                    <p className="text-gray-500 text-xs">{u.email}</p>
                  </div>
                  <button
                    onClick={() => toggleFollow(u._id)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      following.has(u._id)
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    {following.has(u._id) ? 'Unfollow' : 'Follow'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity feed */}
        <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Activity Feed</h2>
          {loadingFeed ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : feed.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity yet. Follow some readers to see their activity.</p>
          ) : (
            <ul className="space-y-2">
              {feed.map(item => {
                const userName = item.user?.name ?? item.userId?.name ?? 'Someone'
                return (
                  <li key={item._id} className="flex items-start gap-3 bg-[#111] rounded-lg px-4 py-3">
                    <div className="flex-1">
                      <p className="text-white text-sm">{userName} — {activityLabel(item.type)}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{formatTime(item.createdAt)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
