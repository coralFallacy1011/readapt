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
  isPlaying, isComplete, wpm, wordIndex, totalWords: _totalWords,
  onStart, onPause, onResume, onReset, onWPMChange
}: ReaderControlsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '480px' }}>

      {/* Playback buttons */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {!isPlaying && !isComplete && wordIndex === 0 && (
          <button onClick={onStart} className="btn-accent">Start</button>
        )}
        {isPlaying && (
          <button onClick={onPause} className="btn-ghost">Pause</button>
        )}
        {!isPlaying && !isComplete && wordIndex > 0 && (
          <button onClick={onResume} className="btn-accent">Resume</button>
        )}
        <button onClick={onReset} className="btn-ghost">Reset</button>
      </div>

      {/* WPM slider */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
        <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{wpm} WPM</label>
        <input
          type="range"
          min={100}
          max={1000}
          step={10}
          value={wpm}
          onChange={e => onWPMChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#f97316' }}
          aria-label="Words per minute"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>100</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>1000</span>
        </div>
      </div>

      {isComplete && (
        <p style={{ color: 'var(--text-accent)', fontWeight: 700, fontSize: '1rem' }}>Reading complete!</p>
      )}
    </div>
  )
}
