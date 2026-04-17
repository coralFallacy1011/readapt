import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/index'

interface Voice {
  name: string
  languageCode: string
  gender: string
}

export interface UseTTSReturn {
  voices: Voice[]
  selectedVoice: string | null
  setSelectedVoice: (voice: string) => void
  isPlaying: boolean
  synthesize: (text: string, wpm: number) => Promise<void>
  stop: () => void
}

export function useTTS(language = 'en'): UseTTSReturn {
  const [voices, setVoices] = useState<Voice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Fetch available voices on mount / language change
  useEffect(() => {
    let cancelled = false

    api
      .get<{ voices: Voice[] }>(`/tts/voices?language=${language}`)
      .then((res) => {
        if (cancelled) return
        const fetchedVoices = res.data.voices ?? []
        setVoices(fetchedVoices)
        if (fetchedVoices.length > 0 && !selectedVoice) {
          setSelectedVoice(fetchedVoices[0].name)
        }
      })
      .catch(() => {
        // Silently ignore — voices remain empty
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const synthesize = useCallback(
    async (text: string, wpm: number) => {
      stop()

      const res = await api.post<{ audioUrl: string }>('/tts/synthesize', {
        text,
        wpm,
        voice: selectedVoice,
        language,
      })

      const { audioUrl } = res.data
      if (!audioUrl) return

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      // Adjust playback rate to match WPM (baseline 150 WPM = 1.0x)
      const baselineWPM = 150
      audio.playbackRate = Math.max(0.5, Math.min(4.0, wpm / baselineWPM))

      audio.addEventListener('ended', () => setIsPlaying(false))
      audio.addEventListener('pause', () => setIsPlaying(false))
      audio.addEventListener('play', () => setIsPlaying(true))

      await audio.play()
    },
    [language, selectedVoice, stop]
  )

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    isPlaying,
    synthesize,
    stop,
  }
}
