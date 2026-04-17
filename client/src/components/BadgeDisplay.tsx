interface BadgeDisplayProps {
  earnedBadges: string[]
}

interface BadgeDef {
  id: string
  label: string
  icon: string
  description: string
}

const ALL_BADGES: BadgeDef[] = [
  // Streak milestones
  { id: 'streak_7', label: '7-Day Streak', icon: '🔥', description: 'Read 7 days in a row' },
  { id: 'streak_30', label: '30-Day Streak', icon: '🌟', description: 'Read 30 days in a row' },
  { id: 'streak_100', label: '100-Day Streak', icon: '💎', description: 'Read 100 days in a row' },
  { id: 'streak_365', label: '365-Day Streak', icon: '👑', description: 'Read every day for a year' },
  // Challenge winners
  { id: 'challenge_winner_1st', label: '1st Place', icon: '🥇', description: 'Won a reading challenge' },
  { id: 'challenge_winner_2nd', label: '2nd Place', icon: '🥈', description: '2nd in a reading challenge' },
  { id: 'challenge_winner_3rd', label: '3rd Place', icon: '🥉', description: '3rd in a reading challenge' },
]

export default function BadgeDisplay({ earnedBadges }: BadgeDisplayProps) {
  const earnedSet = new Set(earnedBadges)

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 shadow-lg space-y-4">
      <h3 className="text-white font-semibold text-lg">Badges</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {ALL_BADGES.map((badge) => {
          const earned = earnedSet.has(badge.id)
          return (
            <div
              key={badge.id}
              title={badge.description}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                earned
                  ? 'border-orange-500/50 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800/40 opacity-40 grayscale'
              }`}
            >
              <span className="text-2xl">{badge.icon}</span>
              <span className={`text-xs text-center font-medium leading-tight ${earned ? 'text-white' : 'text-gray-400'}`}>
                {badge.label}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-500">
        {earnedBadges.length} / {ALL_BADGES.length} badges earned
      </p>
    </div>
  )
}
