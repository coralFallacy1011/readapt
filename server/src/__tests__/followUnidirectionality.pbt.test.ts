// Feature: ai-adaptive-features
// Property 27: Follow relationship is unidirectional
// Validates: Requirements 8.6

import * as fc from 'fast-check'

/**
 * Validates: Requirements 8.6
 *
 * Property 27: Follow relationship is unidirectional
 *
 * A follow relationship (A→B) does NOT imply (B→A).
 * Tests the pure data model: Follow has followerId and followingId.
 */

interface FollowRecord {
  followerId: string
  followingId: string
}

/** Pure model: a set of follow relationships */
function hasFollow(follows: FollowRecord[], followerId: string, followingId: string): boolean {
  return follows.some(f => f.followerId === followerId && f.followingId === followingId)
}

function addFollow(follows: FollowRecord[], followerId: string, followingId: string): FollowRecord[] {
  if (hasFollow(follows, followerId, followingId)) return follows
  return [...follows, { followerId, followingId }]
}

function removeFollow(follows: FollowRecord[], followerId: string, followingId: string): FollowRecord[] {
  return follows.filter(f => !(f.followerId === followerId && f.followingId === followingId))
}

function followerCount(follows: FollowRecord[], userId: string): number {
  return follows.filter(f => f.followingId === userId).length
}

function followingCount(follows: FollowRecord[], userId: string): number {
  return follows.filter(f => f.followerId === userId).length
}

// Arbitrary: a short user ID string
const userIdArb = fc.string({ minLength: 1, maxLength: 8 })

// Two distinct user IDs
const distinctPairArb = fc
  .tuple(userIdArb, userIdArb)
  .filter(([a, b]) => a !== b)

describe('Follow Unidirectionality - Property 27', () => {
  /**
   * Property 27a: Follow(A,B) and Follow(B,A) are distinct records
   */
  it('Follow(A,B) and Follow(B,A) are distinct records', () => {
    fc.assert(
      fc.property(distinctPairArb, ([a, b]) => {
        const forwardFollow: FollowRecord = { followerId: a, followingId: b }
        const reverseFollow: FollowRecord = { followerId: b, followingId: a }

        // They are structurally different objects
        expect(forwardFollow.followerId).toBe(reverseFollow.followingId)
        expect(forwardFollow.followingId).toBe(reverseFollow.followerId)
        // They are not equal as records
        expect(forwardFollow).not.toEqual(reverseFollow)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 27b: Following A→B does not create B→A
   */
  it('following A→B does not create B→A', () => {
    fc.assert(
      fc.property(distinctPairArb, ([a, b]) => {
        const follows = addFollow([], a, b)

        // A follows B
        expect(hasFollow(follows, a, b)).toBe(true)
        // B does NOT follow A
        expect(hasFollow(follows, b, a)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 27c: Unfollowing A→B does not affect B→A
   */
  it('unfollowing A→B does not affect B→A', () => {
    fc.assert(
      fc.property(distinctPairArb, ([a, b]) => {
        // Start with both A→B and B→A
        let follows = addFollow([], a, b)
        follows = addFollow(follows, b, a)

        // Unfollow A→B
        follows = removeFollow(follows, a, b)

        // A→B is gone
        expect(hasFollow(follows, a, b)).toBe(false)
        // B→A is unaffected
        expect(hasFollow(follows, b, a)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 27d: A user can have different follower and following counts
   */
  it('a user can have different follower and following counts', () => {
    fc.assert(
      fc.property(
        fc.array(userIdArb, { minLength: 3, maxLength: 6 }).filter(ids => new Set(ids).size >= 3),
        (ids) => {
          const uniqueIds = [...new Set(ids)]
          const [center, ...others] = uniqueIds

          // center follows nobody, but others follow center
          let follows: FollowRecord[] = []
          for (const other of others) {
            follows = addFollow(follows, other, center)
          }

          const fCount = followerCount(follows, center)
          const fgCount = followingCount(follows, center)

          // center has followers but follows nobody
          expect(fCount).toBe(others.length)
          expect(fgCount).toBe(0)
          // follower count != following count (since others.length >= 2)
          if (others.length > 0) {
            expect(fCount).not.toBe(fgCount)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 27e: Follow relationship is identified by (followerId, followingId) pair
   */
  it('follow relationship is uniquely identified by (followerId, followingId) pair', () => {
    fc.assert(
      fc.property(distinctPairArb, ([a, b]) => {
        let follows: FollowRecord[] = []
        follows = addFollow(follows, a, b)
        // Adding the same follow again does not create a duplicate
        follows = addFollow(follows, a, b)

        const count = follows.filter(f => f.followerId === a && f.followingId === b).length
        expect(count).toBe(1)
      }),
      { numRuns: 100 }
    )
  })
})
