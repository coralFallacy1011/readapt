import { describe, it, expect } from 'vitest'
import { getORPIndex } from './orp'

describe('getORPIndex', () => {
  // length 1–3: floor(length / 2)
  it('length 1 → 0', () => expect(getORPIndex(1)).toBe(0))
  it('length 2 → 1', () => expect(getORPIndex(2)).toBe(1))
  it('length 3 → 1', () => expect(getORPIndex(3)).toBe(1))

  // length 4–7: floor(length / 4)
  it('length 4 → 1', () => expect(getORPIndex(4)).toBe(1))
  it('length 5 → 1', () => expect(getORPIndex(5)).toBe(1))
  it('length 7 → 1', () => expect(getORPIndex(7)).toBe(1))

  // length 8+: floor(length / 3) - 1
  it('length 8 → 1', () => expect(getORPIndex(8)).toBe(1))
  it('length 9 → 2', () => expect(getORPIndex(9)).toBe(2))
  it('length 20 → 5', () => expect(getORPIndex(20)).toBe(5))

  // result is always within [0, length - 1]
  it('index is within word bounds for all boundary values', () => {
    for (const len of [1, 2, 3, 4, 5, 6, 7, 8, 9, 20]) {
      const idx = getORPIndex(len)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(len)
    }
  })
})
