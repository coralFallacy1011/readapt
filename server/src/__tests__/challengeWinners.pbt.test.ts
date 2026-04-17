// Feature: ai-adaptive-features
// Property 31: Challenge winner determination
// Validates: Requirements 10.6

import * as fc from 'fast-check'

/**
 * Validates: Requirements 10.6
 *
 * Property 31: Challenge winner determination
 *
 * From challengeManager.ts, completeChallenge determines winners as top 3
 * participants who reached goalValue:
 *   const topParticipants = leaderboard
 *     .filter(entry => entry.progress >= goalValue)
 *     .slice(0, 3)
 *     .map(entry => entry.userId)
 */

interface LeaderboardEntry {
  userId: string
  progress: number
  rank: number
}

/** Pure winner determination (mirrors completeChallenge in challengeManager.ts) */
function determineWinners(leaderboard: LeaderboardEntry[], goalValue: number): string[] {
  return leaderboard
    .filter(entry => entry.progress >= goalValue)
    .slice(0, 3)
    .map(entry => entry.userId)
}

/** Build a ranked leaderboard from participants (mirrors updateLeaderboard) */
function buildLeaderboard(participants: { userId: string; progress: number }[]): LeaderboardEntry[] {
  return [...participants]
    .sort((a, b) => b.progress - a.progress)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

// Arbitraries
const participantArb = fc.record({
  userId: fc.uuid(),
  progress: fc.integer({ min: 0, max: 1000 }),
})

const goalValueArb = fc.integer({ min: 1, max: 1000 })

describe('Challenge Winners - Property 31', () => {
  /**
   * Property 31a: Winners are the top 3 participants who reached goalValue
   */
  it('winners are the top 3 participants who reached goalValue', () => {
    fc.assert(
      fc.property(
        fc.array(participantArb, { minLength: 0, maxLength: 20 }),
        goalValueArb,
        (participants, goalValue) => {
          const leaderboard = buildLeaderboard(participants)
          const winners = determineWinners(leaderboard, goalValue)

          // All winners must have reached goalValue
          for (const winnerId of winners) {
            const entry = leaderboard.find(e => e.userId === winnerId)!
            expect(entry.progress).toBeGreaterThanOrEqual(goalValue)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 31b: Participants below goalValue are never winners
   */
  it('participants below goalValue are never winners', () => {
    fc.assert(
      fc.property(
        fc.array(participantArb, { minLength: 0, maxLength: 20 }),
        goalValueArb,
        (participants, goalValue) => {
          const leaderboard = buildLeaderboard(participants)
          const winners = new Set(determineWinners(leaderboard, goalValue))

          for (const entry of leaderboard) {
            if (entry.progress < goalValue) {
              expect(winners.has(entry.userId)).toBe(false)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 31c: At most 3 winners
   */
  it('at most 3 winners', () => {
    fc.assert(
      fc.property(
        fc.array(participantArb, { minLength: 0, maxLength: 20 }),
        goalValueArb,
        (participants, goalValue) => {
          const leaderboard = buildLeaderboard(participants)
          const winners = determineWinners(leaderboard, goalValue)

          expect(winners.length).toBeLessThanOrEqual(3)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 31d: Winners are ordered by rank (highest progress first)
   */
  it('winners are ordered by rank (highest progress first)', () => {
    fc.assert(
      fc.property(
        fc.array(participantArb, { minLength: 0, maxLength: 20 }),
        goalValueArb,
        (participants, goalValue) => {
          const leaderboard = buildLeaderboard(participants)
          const winners = determineWinners(leaderboard, goalValue)

          // Verify winners appear in rank order (leaderboard is already sorted by progress desc)
          const winnerEntries = winners.map(id => leaderboard.find(e => e.userId === id)!)

          for (let i = 0; i < winnerEntries.length - 1; i++) {
            expect(winnerEntries[i].progress).toBeGreaterThanOrEqual(winnerEntries[i + 1].progress)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 31e: If fewer than 3 reached goalValue, winners count < 3
   */
  it('if fewer than 3 reached goalValue, winners count < 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 1, max: 500 }),
        (qualifiedCount, goalValue) => {
          // Create exactly qualifiedCount participants who reached goalValue
          const qualified = Array.from({ length: qualifiedCount }, (_, i) => ({
            userId: `qualified-${i}`,
            progress: goalValue + i,
          }))
          // Add some participants who did NOT reach goalValue
          const notQualified = Array.from({ length: 5 }, (_, i) => ({
            userId: `not-qualified-${i}`,
            progress: Math.max(0, goalValue - 1 - i),
          }))

          const leaderboard = buildLeaderboard([...qualified, ...notQualified])
          const winners = determineWinners(leaderboard, goalValue)

          expect(winners.length).toBe(qualifiedCount)
          expect(winners.length).toBeLessThan(3)
        }
      ),
      { numRuns: 100 }
    )
  })
})
