interface SpeedRecommendationModalProps {
  isOpen: boolean
  currentWPM: number
  recommendedWPM: number
  rationale: string
  confidence: number // 0-1
  onAccept: (wpm: number) => void
  onReject: () => void
}

export default function SpeedRecommendationModal({
  isOpen,
  currentWPM,
  recommendedWPM,
  rationale,
  confidence,
  onAccept,
  onReject,
}: SpeedRecommendationModalProps) {
  if (!isOpen) return null

  const confidencePct = Math.round(confidence * 100)
  const wpmDiff = recommendedWPM - currentWPM
  const diffLabel = wpmDiff > 0 ? `+${wpmDiff}` : `${wpmDiff}`
  const diffColor = wpmDiff > 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1a1a1a] rounded-xl p-6 shadow-xl w-full max-w-md mx-4">
        <h2 className="text-white text-xl font-bold mb-1">Speed Recommendation</h2>
        <p className="text-gray-400 text-sm mb-5">AI-powered reading speed suggestion</p>

        <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4 mb-4">
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1">Current</p>
            <p className="text-white text-2xl font-bold">{currentWPM}</p>
            <p className="text-gray-500 text-xs">WPM</p>
          </div>
          <div className="text-center">
            <span className={`text-lg font-semibold ${diffColor}`}>{diffLabel} WPM</span>
            <p className="text-gray-500 text-xs mt-1">change</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1">Recommended</p>
            <p className="text-orange-500 text-2xl font-bold">{recommendedWPM}</p>
            <p className="text-gray-500 text-xs">WPM</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-gray-300 text-sm leading-relaxed">{rationale}</p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 bg-gray-700 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className="text-gray-400 text-xs whitespace-nowrap">{confidencePct}% confidence</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 px-4 py-2 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => onAccept(recommendedWPM)}
            className="flex-1 px-4 py-2 rounded-lg font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
          >
            Accept {recommendedWPM} WPM
          </button>
        </div>
      </div>
    </div>
  )
}
