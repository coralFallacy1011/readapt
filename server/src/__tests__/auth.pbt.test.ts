// Feature: readapt-rsvp-platform, Property 4: Password is never stored in plaintext
// Validates: Requirements 1.4, 1.5

import * as fc from 'fast-check'
import bcrypt from 'bcryptjs'

/**
 * Property 4: Password is never stored in plaintext
 *
 * For any registered user, the passwordHash field stored in the database
 * must not equal the original plaintext password.
 *
 * We test this directly against the bcrypt hashing logic used in authController,
 * without mocking, to verify the real behaviour.
 */
describe('Property 4: Password is never stored in plaintext', () => {
  it('bcrypt.hash never returns the original plaintext password', async () => {
    // Use cost factor 1 (minimum valid bcrypt rounds) to keep 100 iterations fast.
    // The property under test is about the output value, not the work factor.
    const SALT_ROUNDS = 1

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary non-empty password strings (printable ASCII)
        fc.string({ minLength: 1, maxLength: 72 }),
        async (password) => {
          const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

          // The stored hash must never equal the plaintext password
          expect(passwordHash).not.toBe(password)

          // The hash must be a valid bcrypt hash (starts with $2b$ or $2a$)
          expect(passwordHash).toMatch(/^\$2[ab]\$/)
        }
      ),
      { numRuns: 100 }
    )
  }, 60_000) // generous timeout for 100 async bcrypt operations
})
