interface ReaderControlsProps {
  isPlaying: boolean
  isComplete: boolean
  wpm: number
  wordIndex: number
  totalWords: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
  onWPMChange: (wpm: number) => void
}

export default function ReaderControls({
  isPlaying,
  isComplete,
  wpm,
  wordIndex,
  totalWords,
  onStart,
  onPause,
  onResume,
  onReset,
  onWPMChange
}: ReaderControlsProps) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      {/* Progress */}
      <p className="text-gray-500 text-sm">
        {wordIndex + 1} / {totalWords} words
      </p>

      {/* Playback buttons */}
      <div className="flex gap-3">
        {!isPlaying && !isComplete && wordIndex === 0 && (
          <button
            onClick={onStart}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Start
          </button>
        )}
        {isPlaying && (
          <button
            onClick={onPause}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Pause
          </button>
        )}
        {!isPlaying && !isComplete && wordIndex > 0 && (
          <button
            onClick={onResume}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Resume
          </button>
        )}
        <button
          onClick={onReset}
          className="bg-transparent border border-gray-700 hover:bg-gray-800 text-gray-300 font-semibold px-6 py-2 rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>

      {/* WPM slider */}
      <div className="flex flex-col items-center gap-2 w-full">
        <label className="text-gray-400 text-sm">{wpm} WPM</label>
        <input
          type="range"
          min={100}
          max={1000}
          step={10}
          value={wpm}
          onChange={e => onWPMChange(Number(e.target.value))}
          className="w-full accent-orange-500"
          aria-label="Words per minute"
        />
        <div className="flex justify-between w-full text-xs text-gray-600">
          <span>100</span>
          <span>1000</span>
        </div>
      </div>

      {isComplete && (
        <p className="text-orange-400 font-semibold text-lg">Reading complete!</p>
      )}
    </div>
  )
}
