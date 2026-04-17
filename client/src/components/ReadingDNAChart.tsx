interface ReadingDNAChartProps {
  wpmHistory: Array<{ date: string; wpm: number }>
  activityHeatmap: number[][] // 24x7 grid (hours x days)
  genreAffinity: Array<{ genre: string; wordsRead: number; percentage: number }>
  onShare?: () => void
}

function WPMLineChart({ data }: { data: Array<{ date: string; wpm: number }> }) {
  if (data.length === 0) return <p className="text-gray-500 text-sm">No WPM history yet.</p>

  const width = 400
  const height = 100
  const padding = 10
  const minWPM = Math.min(...data.map((d) => d.wpm))
  const maxWPM = Math.max(...data.map((d) => d.wpm))
  const range = maxWPM - minWPM || 1

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2)
    const y = height - padding - ((d.wpm - minWPM) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((_d, i) => {
        const [x, y] = points[i].split(',').map(Number)
        return <circle key={i} cx={x} cy={y} r="3" fill="#f97316" />
      })}
    </svg>
  )
}

function ActivityHeatmap({ grid }: { grid: number[][] }) {
  // grid: 24 rows (hours) x 7 cols (days)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const maxVal = Math.max(...grid.flat(), 1)

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {Array.from({ length: 7 }, (_, dayIdx) => (
          <div key={dayIdx} className="flex flex-col gap-0.5">
            <span className="text-gray-500 text-xs text-center mb-1">{days[dayIdx]}</span>
            {Array.from({ length: 24 }, (_, hourIdx) => {
              const val = grid[hourIdx]?.[dayIdx] ?? 0
              const opacity = val === 0 ? 0.1 : 0.2 + (val / maxVal) * 0.8
              return (
                <div
                  key={hourIdx}
                  title={`${days[dayIdx]} ${hourIdx}:00 — ${val} words`}
                  className="w-4 h-2 rounded-sm bg-orange-500"
                  style={{ opacity }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function GenreBarChart({ data }: { data: Array<{ genre: string; wordsRead: number; percentage: number }> }) {
  if (data.length === 0) return <p className="text-gray-500 text-sm">No genre data yet.</p>

  return (
    <div className="space-y-2">
      {data.map((item) => (
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

export default function ReadingDNAChart({
  wpmHistory,
  activityHeatmap,
  genreAffinity,
  onShare,
}: ReadingDNAChartProps) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-xl font-bold">Reading DNA</h2>
        {onShare && (
          <button
            onClick={onShare}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
          >
            Share
          </button>
        )}
      </div>

      <section>
        <h3 className="text-gray-300 text-sm font-semibold mb-2">WPM History</h3>
        <div className="bg-gray-800 rounded-lg p-3">
          <WPMLineChart data={wpmHistory} />
        </div>
      </section>

      <section>
        <h3 className="text-gray-300 text-sm font-semibold mb-2">Activity Heatmap</h3>
        <div className="bg-gray-800 rounded-lg p-3">
          <ActivityHeatmap grid={activityHeatmap} />
        </div>
      </section>

      <section>
        <h3 className="text-gray-300 text-sm font-semibold mb-2">Genre Distribution</h3>
        <div className="bg-gray-800 rounded-lg p-3">
          <GenreBarChart data={genreAffinity} />
        </div>
      </section>
    </div>
  )
}
