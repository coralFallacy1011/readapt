type RecommendationType = 'book' | 'time' | 'wpm'

interface RecommendationCardProps {
  type: RecommendationType
  title: string
  subtitle?: string
  value?: string | number
  description?: string
  onAction?: () => void
  actionLabel?: string
}

const typeIcon: Record<RecommendationType, string> = {
  book: '📖',
  time: '⏰',
  wpm: '⚡',
}

const typeLabel: Record<RecommendationType, string> = {
  book: 'Book Recommendation',
  time: 'Optimal Reading Time',
  wpm: 'Speed Recommendation',
}

export default function RecommendationCard({
  type,
  title,
  subtitle,
  value,
  description,
  onAction,
  actionLabel = 'View',
}: RecommendationCardProps) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 shadow-lg flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
        <span>{typeIcon[type]}</span>
        <span>{typeLabel[type]}</span>
      </div>

      <div>
        <h4 className="text-white font-semibold text-base leading-snug">{title}</h4>
        {subtitle && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
      </div>

      {value !== undefined && (
        <div className="text-orange-400 font-bold text-xl">{value}</div>
      )}

      {description && (
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      )}

      {onAction && (
        <button
          onClick={onAction}
          className="mt-auto self-start px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
