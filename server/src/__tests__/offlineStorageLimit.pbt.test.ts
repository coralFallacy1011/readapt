// Feature: ai-adaptive-features, Property 39: Offline storage limit enforcement
import * as fc from 'fast-check'

/**
 * Validates: Requirements 15.6
 *
 * Property 39: Offline storage limit enforcement
 * Tests the pure canCacheBook logic for storage limit constraints.
 */

// ---- Pure logic ----

function canCacheBook(
  currentBooks: number,
  currentSizeMB: number,
  newBookSizeMB: number,
  maxBooks: number = 50,
  maxSizeMB: number = 500
): boolean {
  return currentBooks < maxBooks && (currentSizeMB + newBookSizeMB) <= maxSizeMB
}

// ---- Arbitraries ----

const bookCountArb = fc.integer({ min: 0, max: 100 })
const sizeMBArb = fc.double({ min: 0, max: 600, noNaN: true })
const maxBooksArb = fc.integer({ min: 1, max: 200 })
const maxSizeMBArb = fc.double({ min: 1, max: 1000, noNaN: true })

// ---- Tests ----

describe('Offline Storage Limit - Property 39: Offline storage limit enforcement', () => {
  /**
   * Property 1: currentBooks >= maxBooks → cannot cache
   */
  it('cannot cache when book count is at or above the limit', () => {
    fc.assert(
      fc.property(
        maxBooksArb,
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (maxBooks, currentSizeMB, newBookSizeMB) => {
          // currentBooks >= maxBooks
          const currentBooks = maxBooks + fc.sample(fc.integer({ min: 0, max: 50 }), 1)[0]
          const result = canCacheBook(currentBooks, currentSizeMB, newBookSizeMB, maxBooks, 500)
          return result === false
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: currentSizeMB + newBookSizeMB > maxSizeMB → cannot cache
   */
  it('cannot cache when total size would exceed the limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49 }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        (currentBooks, maxSizeMB, extra) => {
          // currentSizeMB + newBookSizeMB > maxSizeMB
          const currentSizeMB = maxSizeMB
          const newBookSizeMB = extra
          const result = canCacheBook(currentBooks, currentSizeMB, newBookSizeMB, 50, maxSizeMB)
          return result === false
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Both within limits → can cache
   */
  it('can cache when both book count and size are within limits', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49 }),
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 99, noNaN: true }),
        (currentBooks, currentSizeMB, newBookSizeMB) => {
          // Ensure total size <= 500
          const safeCurrent = Math.min(currentSizeMB, 400)
          const safeNew = Math.min(newBookSizeMB, 500 - safeCurrent)
          const result = canCacheBook(currentBooks, safeCurrent, safeNew, 50, 500)
          return result === true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Exactly at book limit → cannot cache (>= check)
   */
  it('cannot cache when book count is exactly at the limit', () => {
    fc.assert(
      fc.property(
        maxBooksArb,
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (maxBooks, currentSizeMB, newBookSizeMB) => {
          const result = canCacheBook(maxBooks, currentSizeMB, newBookSizeMB, maxBooks, 500)
          return result === false
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Exactly at size limit → cannot cache (> check means exactly at limit is allowed)
   * canCacheBook uses <= so exactly at limit IS allowed
   */
  it('can cache when total size is exactly at the limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49 }),
        maxSizeMBArb,
        fc.double({ min: 0, max: 500, noNaN: true }),
        (currentBooks, maxSizeMB, currentSizeMB) => {
          const safeCurrentSizeMB = Math.min(currentSizeMB, maxSizeMB)
          const newBookSizeMB = maxSizeMB - safeCurrentSizeMB
          const result = canCacheBook(currentBooks, safeCurrentSizeMB, newBookSizeMB, 50, maxSizeMB)
          return result === true
        }
      ),
      { numRuns: 100 }
    )
  })
})
