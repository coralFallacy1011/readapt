interface GoalProgressProps {
  type: 'words' | 'time' | 'books'
  targetValue: number
  currentValue: number
  period: 'daily' | 'weekly' | 'monthly'
  status: 'active' | 'achieved' | 'failed' | 'cancelled'
  dailyPace?: number
  endDate?: string
}

const typeIcon: Record<GoalProgressProps['type'], string> = {
  words: '📖',
  time: '⏱️',
  books: '📚',
}

const typeUnit: Record<GoalProgressProps['type'], string> = {
  words: 'words',
  time: 'min',
  books: 'books',
}

const statusStyles: Record<GoalProgressProps['status'], { bar: string; badge: string; label: string }> = {
  active: { bar: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-400', label: 'Active' },
  achieved: { bar: 'bg-green-500', badge: 'bg-green-500/20 text-green-400', label: 'Achieved ✓' },
  failed: { bar: 'bg-red-500', badge: 'bg-red-500/20 text-red-400', label: 'Failed' },
  cancelled: { bar: 'bg-gray-600', badge: 'bg-gray-700 text-gray-400', label: 'Cancelled' },
}

export default function GoalProgress({
  type,
  targetValue,
  currentValue,
  period,
  status,
  dailyPace,
  endDate,
}: GoalProgressProps) {
  const progress = Math.min((currentValue / targetValue) * 100, 100)
  const unit = typeUnit[type]
  const styles = statusStyles[status]

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeIcon[type]}</span>
          <div>
            <p className="text-white font-semibold capitalize">{period} {type} goal</p>
            {endDate && (
              <p className="text-xs text-gray-500">
                Ends {new Date(endDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles.badge}`}>
          {styles.label}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Progress</span>
          <span className="text-white font-medium">
            {currentValue.toLocaleString()} / {targetValue.toLocaleString()} {unit}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${styles.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-right">{progress.toFixed(0)}% complete</p>
      </div>

      {dailyPace !== undefined && status === 'active' && (
        <div className="text-sm text-gray-400">
          Daily pace needed:{' '}
          <span className="text-orange-400 font-medium">
            {dailyPace.toLocaleString()} {unit}/day
          </span>
        </div>
      )}
    </div>
  )
}
