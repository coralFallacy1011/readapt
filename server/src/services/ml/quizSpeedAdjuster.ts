/**
 * Quiz-based speed adjustment logic
 * Requirements: 12.9, 12.10
 */

/**
 * Returns true if the last 3 scores (including currentScore) are all >= 80
 */
export function hasThreeConsecutiveHighScores(
  currentScore: number,
  recentScores: number[]  // last N scores for this book (most recent last)
): boolean {
  // We need at least 2 prior scores to make 3 total
  if (recentScores.length < 2) return false

  const lastTwo = recentScores.slice(-2)
  return lastTwo[0] >= 80 && lastTwo[1] >= 80 && currentScore >= 80
}

/**
 * Returns the WPM adjustment factor based on quiz score
 * score < 60  → factor = 0.8 (20% reduction)
 * score >= 80 AND last 3 scores all >= 80 → factor = 1.1 (10% increase)
 * otherwise   → factor = 1.0 (no change)
 */
export function getSpeedAdjustmentFactor(
  currentScore: number,
  recentScores: number[]  // last N scores for this book (most recent last)
): number {
  if (currentScore < 60) return 0.8
  if (hasThreeConsecutiveHighScores(currentScore, recentScores)) return 1.1
  return 1.0
}
