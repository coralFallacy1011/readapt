interface ORPSettingsPanelProps {
  status: 'inactive' | 'training' | 'active'
  trainingDataCount: number
  improvementPercentage?: number
  personalizedEnabled: boolean
  onToggle: () => void
}

const TRAINING_TARGET = 2000

export default function ORPSettingsPanel({
  status,
  trainingDataCount,
  improvementPercentage,
  personalizedEnabled,
  onToggle,
}: ORPSettingsPanelProps) {
  const progress = Math.min((trainingDataCount / TRAINING_TARGET) * 100, 100)
  const mode = personalizedEnabled && status === 'active' ? 'Personalized' : 'Standard'

  const statusLabel: Record<typeof status, string> = {
    inactive: 'Not started',
    training: 'Training in progress',
    active: 'Model ready',
  }

  const statusColor: Record<typeof status, string> = {
    inactive: 'text-gray-400',
    training: 'text-yellow-400',
    active: 'text-green-400',
  }

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-6 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">ORP Settings</h3>
        <span className="text-sm text-gray-400">
          Mode: <span className="text-orange-400 font-medium">{mode}</span>
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Model status</span>
        <span className={`font-medium ${statusColor[status]}`}>{statusLabel[status]}</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Training data</span>
          <span>
            {trainingDataCount.toLocaleString()} / {TRAINING_TARGET.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">{TRAINING_TARGET - trainingDataCount > 0
          ? `${(TRAINING_TARGET - trainingDataCount).toLocaleString()} more data points needed`
          : 'Enough data collected'}</p>
      </div>

      {status === 'active' && improvementPercentage !== undefined && (
        <div className="bg-green-900/30 border border-green-700/40 rounded-lg px-4 py-2 text-sm text-green-400">
          Personalized model improves accuracy by{' '}
          <span className="font-semibold">{improvementPercentage.toFixed(1)}%</span>
        </div>
      )}

      <button
        onClick={onToggle}
        disabled={status === 'inactive' || status === 'training'}
        className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          personalizedEnabled
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-orange-500 hover:bg-orange-600 text-white'
        }`}
      >
        {personalizedEnabled ? 'Disable Personalized ORP' : 'Enable Personalized ORP'}
      </button>
    </div>
  )
}
