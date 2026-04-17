interface StreakDisplayProps {
  currentStreak: number
  longestStreak: number
  lastReadDate?: string
  badges?: string[]
}

const MILESTONE_BADGES: Array<{ days: number; label: string; emoji: string }> = [
  { days: 7, label: '1 Week', emoji: '🌟' },
  { days: 30, label: '1 Month', emoji: '🏆' },
  { days: 100, label: '100 Days', emoji: '💎' },
  { days: 365, label: '1 Year', emoji: '👑' },
]

function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

export default function StreakDisplay({
  currentStreak,
  longestStreak,
  lastReadDate,
  badges = [],
}: StreakDisplayProps) {
  const days = last7Days()
  const today = new Date().toISOString().split('T')[0]

  // Mark days as active based on streak count working backwards from lastReadDate
  const lastRead = lastReadDate ? lastReadDate.split('T')[0] : null
  const activeDays = new Set<string>()
  if (lastRead && currentStreak > 0) {
    const base = new Date(lastRead)
    for (let i = 0; i < currentStreak; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() - i)
      activeDays.add(d.toISOString().split('T')[0])
    }
  }

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-4xl">🔥</span>
        <div>
          <p className="text-white text-3xl font-bold leading-none">{currentStreak}</p>
          <p className="text-gray-400 text-sm">day streak</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-gray-400 text-xs">Longest</p>
          <p className="text-orange-500 text-xl font-bold">{longestStreak}</p>
          <p className="text-gray-500 text-xs">days</p>
        </div>
      </div>

      {/* 7-day calendar */}
      <div className="flex gap-2 mb-5">
        {days.map((date, i) => {
          const isActive = activeDays.has(date)
          const isToday = date === today
          return (
            <div key={date} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-gray-500 text-xs">{dayLabels[(new Date(date).getDay())]}</span>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${isActive ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-500'}
                  ${isToday ? 'ring-2 ring-orange-400' : ''}
                `}
              >
                {new Date(date).getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Milestone badges */}
      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Milestones</p>
        <div className="flex gap-2 flex-wrap">
          {MILESTONE_BADGES.map(({ days: threshold, label, emoji }) => {
            const earned = currentStreak >= threshold || badges.includes(label)
            return (
              <div
                key={threshold}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                  ${earned ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-gray-800 text-gray-600 border border-gray-700'}
                `}
              >
                <span>{emoji}</span>
                <span>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
