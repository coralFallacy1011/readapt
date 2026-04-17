import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'

const VOICES: Record<string, Array<{ name: string; languageCode: string; gender: string }>> = {
  en: [
    { name: 'en-US-Neural2-A', languageCode: 'en-US', gender: 'FEMALE' },
    { name: 'en-US-Neural2-D', languageCode: 'en-US', gender: 'MALE' },
    { name: 'en-GB-Neural2-A', languageCode: 'en-GB', gender: 'FEMALE' },
    { name: 'en-GB-Neural2-B', languageCode: 'en-GB', gender: 'MALE' },
  ],
  es: [
    { name: 'es-ES-Neural2-A', languageCode: 'es-ES', gender: 'FEMALE' },
    { name: 'es-ES-Neural2-B', languageCode: 'es-ES', gender: 'MALE' },
  ],
  fr: [
    { name: 'fr-FR-Neural2-A', languageCode: 'fr-FR', gender: 'FEMALE' },
    { name: 'fr-FR-Neural2-B', languageCode: 'fr-FR', gender: 'MALE' },
  ],
  de: [
    { name: 'de-DE-Neural2-A', languageCode: 'de-DE', gender: 'FEMALE' },
    { name: 'de-DE-Neural2-B', languageCode: 'de-DE', gender: 'MALE' },
  ],
  it: [
    { name: 'it-IT-Neural2-A', languageCode: 'it-IT', gender: 'FEMALE' },
    { name: 'it-IT-Neural2-C', languageCode: 'it-IT', gender: 'MALE' },
  ],
}

export async function synthesizeSpeech(req: AuthRequest, res: Response): Promise<void> {
  const { text, languageCode = 'en-US', voiceName, wpm } = req.body as {
    text: string
    languageCode?: string
    voiceName?: string
    wpm?: number
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' })
    return
  }

  const lang = languageCode.split('-')[0].toLowerCase()
  const voices = VOICES[lang] ?? VOICES['en']
  const resolvedVoice = voiceName ?? voices[0].name

  // Estimate duration: average reading speed ~150 wpm, ~5 chars per word
  const wordsPerMinute = wpm ?? 150
  const wordCount = text.trim().split(/\s+/).length
  const duration = Math.round((wordCount / wordsPerMinute) * 60)

  res.json({
    audioUrl: `https://placeholder.tts/audio/${Date.now()}.mp3`,
    duration,
    languageCode,
    voiceName: resolvedVoice,
  })
}

export async function listVoices(req: AuthRequest, res: Response): Promise<void> {
  const language = (req.query.language as string | undefined) ?? 'en'
  const lang = language.split('-')[0].toLowerCase()
  const voices = VOICES[lang] ?? []

  res.json({ voices })
}
