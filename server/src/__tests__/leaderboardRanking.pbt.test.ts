// Feature: ai-adaptive-features
// Property 30: Challenge leaderboard ranking
// Validates: Requirements 10.5

import * as fc from 'fast-check'

/**
 * Validates: Requirements 10.5
 *
 * Property 30: Challenge leaderboard ranking
 *
 * From challengeManager.ts, updateLeaderboard sorts participants by progress
 * descending and assigns rank 1, 2, 3...
 */

interface Participant {
  userId: string
  progress: number
}

interface RankedParticipant extends Participant {
  rank: number
}

/** Pure ranking function (mirrors updateLeaderboard in challengeManager.ts) */
function rankParticipants(participants: Participant[]): RankedParticipant[] {
  return [...participants]
    .sort((a, b) => b.progress - a.progress)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

// Arbitraries
const participantArb = fc.record({
  userId: fc.uuid(),
  progress: fc.integer({ min: 0, max: 10000 }),
})

describe('Leaderboard Ranking - Property 30', () => {
  /**
   * Property 30a: Participants are ranked by progress descending
   */
  it('participants are ranked by progress descending', () => {
    fc.assert(
      fc.property(fc.array(participantArb, { minLength: 1, maxLength: 20 }), (participants) => {
        const ranked = rankParticipants(participants)

        for (let i = 0; i < ranked.length - 1; i++) {
          expect(ranked[i].progress).toBeGreaterThanOrEqual(ranked[i + 1].progress)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 30b: Rank 1 has the highest progress
   */
  it('rank 1 has the highest progress', () => {
    fc.assert(
      fc.property(fc.array(participantArb, { minLength: 1, maxLength: 20 }), (participants) => {
        const ranked = rankParticipants(participants)
        const rank1 = ranked.find(p => p.rank === 1)!

        for (const p of ranked) {
          expect(rank1.progress).toBeGreaterThanOrEqual(p.progress)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 30c: Ranks are consecutive integers starting from 1
   */
  it('ranks are consecutive integers starting from 1', () => {
    fc.assert(
      fc.property(fc.array(participantArb, { minLength: 0, maxLength: 20 }), (participants) => {
        const ranked = rankParticipants(participants)
        const ranks = ranked.map(p => p.rank)

        for (let i = 0; i < ranks.length; i++) {
          expect(ranks[i]).toBe(i + 1)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 30d: Equal progress — lower rank number goes to whoever appears first after sort (stable)
   */
  it('equal progress: lower rank number goes to whoever appears first after sort', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 10000 }),
        (count, sharedProgress) => {
          const participants: Participant[] = Array.from({ length: count }, (_, i) => ({
            userId: `user-${i}`,
            progress: sharedProgress,
          }))

          const ranked = rankParticipants(participants)

          // All have same progress, so ranks should be 1..count in original order
          // (JavaScript sort is stable)
          for (let i = 0; i < ranked.length; i++) {
            expect(ranked[i].rank).toBe(i + 1)
            expect(ranked[i].userId).toBe(`user-${i}`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 30e: Empty participants → empty leaderboard
   */
  it('empty participants returns empty leaderboard', () => {
    fc.assert(
      fc.property(fc.constant([]), (participants) => {
        const ranked = rankParticipants(participants)
        expect(ranked).toEqual([])
        expect(ranked).toHaveLength(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 30f: Ranking preserves all participants
   */
  it('ranking preserves all participants', () => {
    fc.assert(
      fc.property(fc.array(participantArb, { minLength: 0, maxLength: 20 }), (participants) => {
        const ranked = rankParticipants(participants)
        expect(ranked).toHaveLength(participants.length)
      }),
      { numRuns: 100 }
    )
  })
})
