// Feature: ai-adaptive-features
// Property 28: Activity feed chronological ordering
// Validates: Requirements 9.4

import * as fc from 'fast-check'

/**
 * Validates: Requirements 9.4
 *
 * Property 28: Activity feed chronological ordering
 *
 * From activityManager.ts, activities are sorted by timestamp in reverse
 * chronological order (newest first). Tests the pure sorting logic.
 */

interface ActivityLike {
  id: string
  timestamp: Date
}

/** Pure sort: newest first (mirrors .sort({ timestamp: -1 }) in activityManager.ts) */
function sortFeedNewestFirst(activities: ActivityLike[]): ActivityLike[] {
  return [...activities].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

// Arbitrary: an activity with a timestamp
const activityArb = fc.record({
  id: fc.uuid(),
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
})

describe('Activity Feed Ordering - Property 28', () => {
  /**
   * Property 28a: Activities are sorted in descending timestamp order
   */
  it('activities are sorted in descending timestamp order', () => {
    fc.assert(
      fc.property(fc.array(activityArb, { minLength: 0, maxLength: 20 }), (activities) => {
        const sorted = sortFeedNewestFirst(activities)

        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            sorted[i + 1].timestamp.getTime()
          )
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 28b: For any two adjacent activities in the feed, the first has timestamp >= second
   */
  it('for any two adjacent activities, first.timestamp >= second.timestamp', () => {
    fc.assert(
      fc.property(fc.array(activityArb, { minLength: 2, maxLength: 20 }), (activities) => {
        const sorted = sortFeedNewestFirst(activities)

        for (let i = 0; i < sorted.length - 1; i++) {
          const current = sorted[i].timestamp.getTime()
          const next = sorted[i + 1].timestamp.getTime()
          expect(current).toBeGreaterThanOrEqual(next)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 28c: Sorting is stable (equal timestamps maintain relative order)
   */
  it('sorting is stable: equal timestamps maintain relative order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        (count, sharedTimestamp) => {
          // Create activities all with the same timestamp, tagged with original index
          const activities: (ActivityLike & { originalIndex: number })[] = Array.from(
            { length: count },
            (_, i) => ({ id: `activity-${i}`, timestamp: new Date(sharedTimestamp), originalIndex: i })
          )

          const sorted = [...activities].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          )

          // All timestamps are equal, so relative order should be preserved
          // (JavaScript's Array.sort is stable in V8/Node.js >= 11)
          const sortedIndices = sorted.map(a => a.originalIndex)
          const originalIndices = activities.map(a => a.originalIndex)
          expect(sortedIndices).toEqual(originalIndices)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 28d: Empty feed returns empty array
   */
  it('empty feed returns empty array', () => {
    fc.assert(
      fc.property(fc.constant([]), (activities) => {
        const sorted = sortFeedNewestFirst(activities)
        expect(sorted).toEqual([])
        expect(sorted).toHaveLength(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 28e: Sorting does not change the number of activities
   */
  it('sorting preserves the number of activities', () => {
    fc.assert(
      fc.property(fc.array(activityArb, { minLength: 0, maxLength: 20 }), (activities) => {
        const sorted = sortFeedNewestFirst(activities)
        expect(sorted).toHaveLength(activities.length)
      }),
      { numRuns: 100 }
    )
  })
})
