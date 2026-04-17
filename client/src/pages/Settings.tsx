import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import ORPSettingsPanel from '../components/ORPSettingsPanel'
import api from '../api'

interface Settings {
  aiSpeedEnabled: boolean
  personalizedORPEnabled: boolean
  minWPM: number
  maxWPM: number
  profileVisibility: 'private' | 'public' | 'followers-only'
  activitySharingEnabled: boolean
  preferredLanguage: string
}

interface ORPStatus {
  status: 'inactive' | 'training' | 'active'
  trainingDataCount: number
  improvementPercentage?: number
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
]

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-orange-500' : 'bg-gray-600'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    aiSpeedEnabled: false,
    personalizedORPEnabled: false,
    minWPM: 100,
    maxWPM: 800,
    profileVisibility: 'private',
    activitySharingEnabled: false,
    preferredLanguage: 'en',
  })
  const [orp, setOrp] = useState<ORPStatus>({ status: 'inactive', trainingDataCount: 0 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        const u = res.data.user ?? res.data
        setSettings(prev => ({
          ...prev,
          aiSpeedEnabled: u.aiSpeedEnabled ?? prev.aiSpeedEnabled,
          personalizedORPEnabled: u.personalizedORPEnabled ?? prev.personalizedORPEnabled,
          minWPM: u.minWPM ?? prev.minWPM,
          maxWPM: u.maxWPM ?? prev.maxWPM,
          profileVisibility: u.profileVisibility ?? prev.profileVisibility,
          activitySharingEnabled: u.activitySharingEnabled ?? prev.activitySharingEnabled,
          preferredLanguage: u.preferredLanguage ?? prev.preferredLanguage,
        }))
      })
      .catch(() => {})

    api.get('/ml/orp/status')
      .then(res => setOrp(res.data))
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await api.patch('/auth/settings', settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      try {
        await api.put('/auth/profile', settings)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch {
        setError('Failed to save settings.')
      }
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>

        {/* AI/ML Settings */}
        <section className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">AI / ML Settings</h2>
          <Toggle
            label="AI Speed Adjustment"
            enabled={settings.aiSpeedEnabled}
            onToggle={() => update('aiSpeedEnabled', !settings.aiSpeedEnabled)}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Min WPM</label>
              <input
                type="number"
                min={50}
                max={settings.maxWPM - 1}
                value={settings.minWPM}
                onChange={e => update('minWPM', Number(e.target.value))}
                className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Max WPM</label>
              <input
                type="number"
                min={settings.minWPM + 1}
                max={2000}
                value={settings.maxWPM}
                onChange={e => update('maxWPM', Number(e.target.value))}
                className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <ORPSettingsPanel
            status={orp.status}
            trainingDataCount={orp.trainingDataCount}
            improvementPercentage={orp.improvementPercentage}
            personalizedEnabled={settings.personalizedORPEnabled}
            onToggle={() => update('personalizedORPEnabled', !settings.personalizedORPEnabled)}
          />
        </section>

        {/* Privacy Settings */}
        <section className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Privacy</h2>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Profile Visibility</label>
            <select
              value={settings.profileVisibility}
              onChange={e => update('profileVisibility', e.target.value as Settings['profileVisibility'])}
              className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="followers-only">Followers Only</option>
            </select>
          </div>
          <Toggle
            label="Activity Sharing"
            enabled={settings.activitySharingEnabled}
            onToggle={() => update('activitySharingEnabled', !settings.activitySharingEnabled)}
          />
        </section>

        {/* Language Preferences */}
        <section className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Language Preferences</h2>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Preferred Language</label>
            <select
              value={settings.preferredLanguage}
              onChange={e => update('preferredLanguage', e.target.value)}
              className="w-full bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </main>
    </div>
  )
}
