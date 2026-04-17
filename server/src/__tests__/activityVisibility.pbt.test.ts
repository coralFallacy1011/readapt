// Feature: ai-adaptive-features
// Property 29: Activity visibility respects privacy settings
// Validates: Requirements 9.7

import * as fc from 'fast-check'

/**
 * Validates: Requirements 9.7
 *
 * Property 29: Activity visibility respects privacy settings
 *
 * From activityManager.ts:
 * - Only show activities with visibility 'public' or 'followers' (not 'private')
 * - Only show activities from users with activitySharingEnabled: true
 *
 * Tests the pure filtering logic.
 */

type Visibility = 'public' | 'followers' | 'private'

interface UserSettings {
  userId: string
  activitySharingEnabled: boolean
}

interface ActivityRecord {
  id: string
  userId: string
  visibility: Visibility
}

/** Pure filter: mirrors the query in activityManager.ts */
function filterFeedActivities(
  activities: ActivityRecord[],
  userSettings: Map<string, UserSettings>
): ActivityRecord[] {
  return activities.filter(activity => {
    const settings = userSettings.get(activity.userId)
    if (!settings) return false
    if (!settings.activitySharingEnabled) return false
    if (activity.visibility === 'private') return false
    return true
  })
}

// Arbitraries
const visibilityArb = fc.constantFrom<Visibility>('public', 'followers', 'private')
const userIdArb = fc.string({ minLength: 1, maxLength: 8 })

const activityArb = fc.record({
  id: fc.uuid(),
  userId: userIdArb,
  visibility: visibilityArb,
})

const userSettingsArb = (userId: string) =>
  fc.record({
    userId: fc.constant(userId),
    activitySharingEnabled: fc.boolean(),
  })

describe('Activity Visibility - Property 29', () => {
  /**
   * Property 29a: Private activities are never shown in feed
   */
  it('private activities are never shown in feed', () => {
    fc.assert(
      fc.property(
        fc.array(activityArb, { minLength: 1, maxLength: 20 }),
        (activities) => {
          // All users have sharing enabled — only visibility matters
          const userSettings = new Map<string, UserSettings>()
          for (const a of activities) {
            userSettings.set(a.userId, { userId: a.userId, activitySharingEnabled: true })
          }

          const feed = filterFeedActivities(activities, userSettings)

          for (const activity of feed) {
            expect(activity.visibility).not.toBe('private')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 29b: Activities from users with activitySharingEnabled=false are never shown
   */
  it('activities from users with activitySharingEnabled=false are never shown', () => {
    fc.assert(
      fc.property(
        fc.array(activityArb, { minLength: 1, maxLength: 20 }),
        (activities) => {
          // All users have sharing DISABLED
          const userSettings = new Map<string, UserSettings>()
          for (const a of activities) {
            userSettings.set(a.userId, { userId: a.userId, activitySharingEnabled: false })
          }

          const feed = filterFeedActivities(activities, userSettings)

          expect(feed).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 29c: Public activities from enabled users are shown
   */
  it('public activities from enabled users are shown', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.integer({ min: 1, max: 10 }),
        (userId, count) => {
          const activities: ActivityRecord[] = Array.from({ length: count }, (_, i) => ({
            id: `act-${i}`,
            userId,
            visibility: 'public' as Visibility,
          }))

          const userSettings = new Map<string, UserSettings>([
            [userId, { userId, activitySharingEnabled: true }],
          ])

          const feed = filterFeedActivities(activities, userSettings)

          expect(feed).toHaveLength(count)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 29d: Followers-only activities from enabled users are shown
   */
  it('followers-only activities from enabled users are shown', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.integer({ min: 1, max: 10 }),
        (userId, count) => {
          const activities: ActivityRecord[] = Array.from({ length: count }, (_, i) => ({
            id: `act-${i}`,
            userId,
            visibility: 'followers' as Visibility,
          }))

          const userSettings = new Map<string, UserSettings>([
            [userId, { userId, activitySharingEnabled: true }],
          ])

          const feed = filterFeedActivities(activities, userSettings)

          expect(feed).toHaveLength(count)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 29e: Combined filter — only public/followers from enabled users pass
   */
  it('only public or followers activities from enabled users appear in feed', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            userId: userIdArb,
            visibility: visibilityArb,
            sharingEnabled: fc.boolean(),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (items) => {
          const activities: ActivityRecord[] = items.map(({ id, userId, visibility }) => ({
            id,
            userId,
            visibility,
          }))

          const userSettings = new Map<string, UserSettings>()
          for (const item of items) {
            userSettings.set(item.userId, {
              userId: item.userId,
              activitySharingEnabled: item.sharingEnabled,
            })
          }

          const feed = filterFeedActivities(activities, userSettings)

          for (const activity of feed) {
            const settings = userSettings.get(activity.userId)!
            expect(settings.activitySharingEnabled).toBe(true)
            expect(['public', 'followers']).toContain(activity.visibility)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
