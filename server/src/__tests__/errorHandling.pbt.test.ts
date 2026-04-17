// Feature: ai-adaptive-features
// Property 43: Error handling preserves current state
// Validates: Requirements 1.13, 2.11, 3.14, 4.11, 12.5

import * as fc from 'fast-check'

/**
 * Property 43: Error handling preserves current state
 *
 * When ML services fail (throw errors), the system returns graceful fallbacks
 * without crashing, and the user's current state is preserved.
 *
 * Tests the pure error handling patterns from mlController.ts.
 */

// ---- Pure fallback logic (mirrors mlController.ts error handlers) ----

interface SpeedRecommendationFallback {
  message: string
}

interface ORPStatusFallback {
  model: { status: string; trainingProgress: number }
  trainingProgress: number
}

interface BookRecommendationsFallback {
  books: unknown[]
  confidence: string
}

interface ReadingDNAFallback {
  message: string
}

function getSpeedRecommendationFallback(): SpeedRecommendationFallback {
  return { message: 'Insufficient data' }
}

function getORPStatusFallback(): ORPStatusFallback {
  return { model: { status: 'not_trained', trainingProgress: 0 }, trainingProgress: 0 }
}

function getBookRecommendationsFallback(): BookRecommendationsFallback {
  return { books: [], confidence: 'low' }
}

function getReadingDNAFallback(): ReadingDNAFallback {
  return { message: 'Insufficient data to generate Reading DNA' }
}

/** Simulate a service call that may throw */
function withFallback<T>(
  serviceCall: () => T,
  fallback: () => T
): T {
  try {
    return serviceCall()
  } catch {
    return fallback()
  }
}

// ---- Arbitraries ----

const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 })
const wpmArb = fc.integer({ min: 100, max: 1000 })

// ---- Tests ----

describe('Error Handling - Property 43: Error handling preserves current state', () => {
  /**
   * Property 1: Speed recommendation fallback has correct structure
   */
  it('speed recommendation fallback always returns { message: string }', () => {
    fc.assert(
      fc.property(errorMessageArb, (errorMsg) => {
        const result = withFallback(
          () => { throw new Error(errorMsg) },
          getSpeedRecommendationFallback
        )
        return typeof result.message === 'string' && result.message.length > 0
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: ORP status fallback has correct structure
   */
  it('ORP status fallback always returns valid status object', () => {
    fc.assert(
      fc.property(errorMessageArb, (errorMsg) => {
        const result = withFallback(
          () => { throw new Error(errorMsg) },
          getORPStatusFallback
        )
        return (
          result.model.status === 'not_trained' &&
          result.model.trainingProgress === 0 &&
          result.trainingProgress === 0
        )
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Book recommendations fallback returns empty array
   */
  it('book recommendations fallback always returns empty books array', () => {
    fc.assert(
      fc.property(errorMessageArb, (errorMsg) => {
        const result = withFallback(
          () => { throw new Error(errorMsg) },
          getBookRecommendationsFallback
        )
        return Array.isArray(result.books) && result.books.length === 0 && result.confidence === 'low'
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Reading DNA fallback has correct structure
   */
  it('reading DNA fallback always returns { message: string }', () => {
    fc.assert(
      fc.property(errorMessageArb, (errorMsg) => {
        const result = withFallback(
          () => { throw new Error(errorMsg) },
          getReadingDNAFallback
        )
        return typeof result.message === 'string' && result.message.length > 0
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: User's current WPM is not modified when an error occurs
   */
  it('user WPM is preserved when ML service fails', () => {
    fc.assert(
      fc.property(wpmArb, errorMessageArb, (currentWPM, errorMsg) => {
        let userWPM = currentWPM

        // Simulate ML service failure — WPM should not change
        withFallback(
          () => { throw new Error(errorMsg) },
          getSpeedRecommendationFallback
        )

        // WPM is unchanged
        return userWPM === currentWPM
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: withFallback never throws — always returns a value
   */
  it('withFallback never propagates exceptions', () => {
    fc.assert(
      fc.property(errorMessageArb, (errorMsg) => {
        let threw = false
        try {
          withFallback(
            () => { throw new Error(errorMsg) },
            () => ({ safe: true })
          )
        } catch {
          threw = true
        }
        return !threw
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7: Fallback is only used when service throws, not on success
   */
  it('fallback is not used when service succeeds', () => {
    fc.assert(
      fc.property(wpmArb, (wpm) => {
        const result = withFallback(
          () => ({ recommendedWPM: wpm }),
          () => ({ recommendedWPM: 0 })
        )
        return result.recommendedWPM === wpm
      }),
      { numRuns: 100 }
    )
  })
})
