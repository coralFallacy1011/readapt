import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useRSVP } from './useRSVP'

const WORDS = ['hello', 'world', 'foo', 'bar', 'baz']

describe('useRSVP', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initialises with first word and default state', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS }))
    expect(result.current.currentWord).toBe('hello')
    expect(result.current.wordIndex).toBe(0)
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.isComplete).toBe(false)
  })

  it('respects initialIndex', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialIndex: 2 }))
    expect(result.current.currentWord).toBe('foo')
    expect(result.current.wordIndex).toBe(2)
  })

  it('clamps initialWPM below 100 to 100', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialWPM: 50 }))
    expect(result.current.wpm).toBe(100)
  })

  it('clamps initialWPM above 1000 to 1000', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialWPM: 2000 }))
    expect(result.current.wpm).toBe(1000)
  })

  // Req 5.1 — sequential display at configured WPM
  it('advances words sequentially when started', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialWPM: 300 }))
    const intervalMs = Math.round(60_000 / 300) // 200ms

    act(() => { result.current.start() })
    expect(result.current.isPlaying).toBe(true)

    act(() => { vi.advanceTimersByTime(intervalMs) })
    expect(result.current.wordIndex).toBe(1)

    act(() => { vi.advanceTimersByTime(intervalMs) })
    expect(result.current.wordIndex).toBe(2)
  })

  // Req 5.2 — pause holds current word
  it('pause stops advancing and holds current word', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialWPM: 300 }))
    const intervalMs = Math.round(60_000 / 300)

    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(intervalMs) })
    expect(result.current.wordIndex).toBe(1)

    act(() => { result.current.pause() })
    expect(result.current.isPlaying).toBe(false)

    act(() => { vi.advanceTimersByTime(intervalMs * 5) })
    expect(result.current.wordIndex).toBe(1) // still at 1
  })

  // Req 5.3 — resume continues from paused position
  it('resume continues from the paused word index', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialWPM: 300 }))
    const intervalMs = Math.round(60_000 / 300)

    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(intervalMs * 2) })
    act(() => { result.current.pause() })
    expect(result.current.wordIndex).toBe(2)

    act(() => { result.current.resume() })
    expect(result.current.isPlaying).toBe(true)
    act(() => { vi.advanceTimersByTime(intervalMs) })
    expect(result.current.wordIndex).toBe(3)
  })

  // Req 5.4 — reset returns to first word
  it('reset returns to word index 0 and stops playing', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialWPM: 300 }))
    const intervalMs = Math.round(60_000 / 300)

    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(intervalMs * 3) })
    expect(result.current.wordIndex).toBe(3)

    act(() => { result.current.reset() })
    expect(result.current.wordIndex).toBe(0)
    expect(result.current.currentWord).toBe('hello')
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.isComplete).toBe(false)
  })

  // Req 5.5 — auto-stop on last word
  it('sets isComplete and stops after the last word', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialWPM: 300 }))
    const intervalMs = Math.round(60_000 / 300)

    act(() => { result.current.start() })
    // Advance past all words
    act(() => { vi.advanceTimersByTime(intervalMs * WORDS.length) })

    expect(result.current.isComplete).toBe(true)
    expect(result.current.isPlaying).toBe(false)
    // wordIndex stays at last valid index
    expect(result.current.wordIndex).toBe(WORDS.length - 1)
  })

  // Req 5.5 — resume does nothing when complete
  it('resume does nothing when isComplete is true', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS, initialWPM: 300 }))
    const intervalMs = Math.round(60_000 / 300)

    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(intervalMs * WORDS.length) })
    expect(result.current.isComplete).toBe(true)

    act(() => { result.current.resume() })
    expect(result.current.isPlaying).toBe(false)
  })

  // Req 5.6 — setWPM clamps values
  it('setWPM clamps values below 100 to 100', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS }))
    act(() => { result.current.setWPM(50) })
    expect(result.current.wpm).toBe(100)
  })

  it('setWPM clamps values above 1000 to 1000', () => {
    const { result } = renderHook(() => useRSVP({ words: WORDS }))
    act(() => { result.current.setWPM(9999) })
    expect(result.current.wpm).toBe(1000)
  })

  it('start does nothing when words array is empty', () => {
    const { result } = renderHook(() => useRSVP({ words: [] }))
    act(() => { result.current.start() })
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.currentWord).toBe('')
  })
})
