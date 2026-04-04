import { useState, useEffect, useRef, useCallback } from 'react'

const MIN_WPM = 100
const MAX_WPM = 1000

function clampWPM(wpm: number): number {
  return Math.max(MIN_WPM, Math.min(MAX_WPM, wpm))
}

interface UseRSVPOptions {
  words: string[]
  initialIndex?: number
  initialWPM?: number
}

interface UseRSVPReturn {
  currentWord: string
  wordIndex: number
  wpm: number
  isPlaying: boolean
  isComplete: boolean
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setWPM: (wpm: number) => void
  seekTo: (index: number) => void
}

export function useRSVP({ words, initialIndex = 0, initialWPM = 300 }: UseRSVPOptions): UseRSVPReturn {
  const [wordIndex, setWordIndex] = useState(initialIndex)
  const [wpm, setWPMState] = useState(clampWPM(initialWPM))
  const [isPlaying, setIsPlaying] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startTimer = useCallback((_fromIndex: number, currentWPM: number) => {
    clearTimer()
    const intervalMs = Math.round(60_000 / currentWPM)
    intervalRef.current = setInterval(() => {
      setWordIndex(prev => {
        const next = prev + 1
        if (next >= words.length) {
          clearTimer()
          setIsPlaying(false)
          setIsComplete(true)
          return prev
        }
        return next
      })
    }, intervalMs)
  }, [words.length, clearTimer])

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer])

  const start = useCallback(() => {
    if (words.length === 0) return
    setIsComplete(false)
    setIsPlaying(true)
    startTimer(wordIndex, wpm)
  }, [words.length, wordIndex, wpm, startTimer])

  const pause = useCallback(() => {
    clearTimer()
    setIsPlaying(false)
  }, [clearTimer])

  const resume = useCallback(() => {
    if (isComplete) return
    setIsPlaying(true)
    startTimer(wordIndex, wpm)
  }, [isComplete, wordIndex, wpm, startTimer])

  const reset = useCallback(() => {
    clearTimer()
    setIsPlaying(false)
    setIsComplete(false)
    setWordIndex(0)
  }, [clearTimer])

  const setWPM = useCallback((newWPM: number) => {
    const clamped = clampWPM(newWPM)
    setWPMState(clamped)
    if (isPlaying) {
      startTimer(wordIndex, clamped)
    }
  }, [isPlaying, wordIndex, startTimer])

  const seekTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, words.length - 1))
    clearTimer()
    setIsPlaying(false)
    setIsComplete(false)
    setWordIndex(clamped)
  }, [words.length, clearTimer])

  return {
    currentWord: words[wordIndex] ?? '',
    wordIndex,
    wpm,
    isPlaying,
    isComplete,
    start,
    pause,
    resume,
    reset,
    setWPM,
    seekTo
  }
}
