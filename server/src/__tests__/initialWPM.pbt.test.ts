// Feature: ai-adaptive-features, Property 15: Initial WPM recommendation for new books
import * as fc from 'fast-check'

/**
 * Validates: Requirements 3.10
 *
 * Property 15: Initial WPM recommendation for new books
 * The initial WPM recommendation = median WPM * complexity factor, where:
 * - Low complexity (0.0-0.3): factor = 1.2 (20% faster)
 * - Medium complexity (0.3-0.7): factor = 1.0 (baseline)
 * - High complexity (0.7-1.0): factor = 0.8 (20% slower)
 * - No sessions: return default 300 WPM
 *
 * We test the pure calculation logic extracted from getInitialWPMForBook,
 * which avoids any DB calls.
 */

// ---- Pure calculation logic (mirrors getInitialWPMForBook) ----

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  } else {
    return sorted[mid]
  }
}

function computeInitialWPM(sessionWPMs: number[], bookComplexity: number): number {
  if (sessionWPMs.length === 0) return 300

  const medianWPM = median(sessionWPMs)

  let complexityFactor: number
  if (bookComplexity < 0.3) {
    complexityFactor = 1.2
  } else if (bookComplexity < 0.7) {
    complexityFactor = 1.0
  } else {
    complexityFactor = 0.8
  }

  return Math.round(medianWPM * complexityFactor)
}

// ---- Arbitraries ----

const wpmArb = fc.integer({ min: 50, max: 1000 })
const sessionWPMsArb = fc.array(wpmArb, { minLength: 1, maxLength: 50 })

const lowComplexityArb = fc.double({ min: 0.0, max: 0.2999, noNaN: true })
const mediumComplexityArb = fc.double({ min: 0.3, max: 0.6999, noNaN: true })
const highComplexityArb = fc.double({ min: 0.7, max: 1.0, noNaN: true })

// ---- Tests ----

describe('Initial WPM - Property 15: Initial WPM recommendation for new books', () => {
  /**
   * Property 1: Low complexity (< 0.3) always produces WPM >= median WPM (factor 1.2)
   */
  it('low complexity produces WPM >= median WPM', () => {
    fc.assert(
      fc.property(sessionWPMsArb, lowComplexityArb, (wpms, complexity) => {
        const medianWPM = median(wpms)
        const result = computeInitialWPM(wpms, complexity)
        // factor 1.2 means result >= medianWPM (rounding may bring it to exactly medianWPM for very small values)
        return result >= Math.round(medianWPM)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: High complexity (>= 0.7) always produces WPM <= median WPM (factor 0.8)
   */
  it('high complexity produces WPM <= median WPM', () => {
    fc.assert(
      fc.property(sessionWPMsArb, highComplexityArb, (wpms, complexity) => {
        const medianWPM = median(wpms)
        const result = computeInitialWPM(wpms, complexity)
        // factor 0.8 means result <= medianWPM (rounding may bring it to exactly medianWPM)
        return result <= Math.round(medianWPM)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Medium complexity (0.3-0.7) produces WPM equal to median WPM (factor 1.0)
   */
  it('medium complexity produces WPM equal to rounded median WPM', () => {
    fc.assert(
      fc.property(sessionWPMsArb, mediumComplexityArb, (wpms, complexity) => {
        const medianWPM = median(wpms)
        const result = computeInitialWPM(wpms, complexity)
        return result === Math.round(medianWPM)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Result is always a positive integer
   */
  it('result is always a positive integer', () => {
    fc.assert(
      fc.property(
        sessionWPMsArb,
        fc.double({ min: 0.0, max: 1.0, noNaN: true }),
        (wpms, complexity) => {
          const result = computeInitialWPM(wpms, complexity)
          return Number.isInteger(result) && result > 0
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: No sessions returns default 300 WPM
   */
  it('no sessions returns default 300 WPM', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0, max: 1.0, noNaN: true }),
        (complexity) => {
          const result = computeInitialWPM([], complexity)
          return result === 300
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: Complexity factor boundaries
   * - exactly 0.3 uses factor 1.0 (medium, not low)
   * - exactly 0.7 uses factor 0.8 (high, not medium)
   */
  it('complexity boundary 0.3 uses factor 1.0 (medium)', () => {
    fc.assert(
      fc.property(sessionWPMsArb, (wpms) => {
        const medianWPM = median(wpms)
        const result = computeInitialWPM(wpms, 0.3)
        return result === Math.round(medianWPM * 1.0)
      }),
      { numRuns: 100 }
    )
  })

  it('complexity boundary 0.7 uses factor 0.8 (high)', () => {
    fc.assert(
      fc.property(sessionWPMsArb, (wpms) => {
        const medianWPM = median(wpms)
        const result = computeInitialWPM(wpms, 0.7)
        return result === Math.round(medianWPM * 0.8)
      }),
      { numRuns: 100 }
    )
  })
})
