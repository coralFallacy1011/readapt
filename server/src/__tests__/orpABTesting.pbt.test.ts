import * as fc from 'fast-check'
import { shouldUseTestORP, getORPIndexWithTesting } from '../services/ml/orpOptimizer'

/**
 * Property 6: ORP A/B testing maintains 20/80 distribution
 * 
 * **Validates: Requirements 2.3**
 * 
 * For any user in the ORP A/B testing phase, over a sufficiently large sample of words (n ≥ 100),
 * the proportion of test words (standard ORP ± 1) must be within 20% ± 5% and control words
 * must be within 80% ± 5%.
 */
describe('Property 6: ORP A/B testing maintains 20/80 distribution', () => {
  describe('shouldUseTestORP distribution (Requirement 2.3)', () => {
    it('should maintain approximately 20% test words over large samples', () => {
      fc.assert(
        fc.property(
          fc.constant(1000), // Fixed large sample size
          (sampleSize) => {
            let testCount = 0

            // Run the function for each word in the sample
            for (let wordIndex = 0; wordIndex < sampleSize; wordIndex++) {
              if (shouldUseTestORP(wordIndex)) {
                testCount++
              }
            }

            const testPercentage = (testCount / sampleSize) * 100
            const controlPercentage = ((sampleSize - testCount) / sampleSize) * 100

            // Test words should be 20% ± 5% (15% to 25%)
            expect(testPercentage).toBeGreaterThanOrEqual(15)
            expect(testPercentage).toBeLessThanOrEqual(25)

            // Control words should be 80% ± 5% (75% to 85%)
            expect(controlPercentage).toBeGreaterThanOrEqual(75)
            expect(controlPercentage).toBeLessThanOrEqual(85)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('getORPIndexWithTesting distribution (Requirement 2.3)', () => {
    it('should apply test ORP (±1 offset) to approximately 20% of words', () => {
      fc.assert(
        fc.property(
          fc.constant(1000), // Fixed sample size
          (sampleSize) => {
            let testORPCount = 0

            // Helper to get standard ORP
            const getStandardORP = (wordLength: number): number => {
              if (wordLength <= 3) return Math.floor(wordLength / 2)
              if (wordLength <= 7) return Math.floor(wordLength / 4)
              return Math.floor(wordLength / 3) - 1
            }

            // Use a fixed word length to simplify
            const word = 'testing' // 7 characters
            const standardORP = getStandardORP(word.length)

            // Process each word
            for (let i = 0; i < sampleSize; i++) {
              const orpIndex = getORPIndexWithTesting(word, i)

              // Check if this is a test word (ORP differs from standard)
              const isTestWord = orpIndex !== standardORP

              if (isTestWord) {
                testORPCount++

                // Verify test ORP is indeed ±1 from standard (within bounds)
                const expectedTestORP1 = Math.max(0, standardORP - 1)
                const expectedTestORP2 = Math.min(word.length - 1, standardORP + 1)

                expect(
                  orpIndex === expectedTestORP1 || orpIndex === expectedTestORP2
                ).toBeTruthy()
              }
            }

            const testPercentage = (testORPCount / sampleSize) * 100
            const controlPercentage = ((sampleSize - testORPCount) / sampleSize) * 100

            // Test words should be 20% ± 5%
            expect(testPercentage).toBeGreaterThanOrEqual(15)
            expect(testPercentage).toBeLessThanOrEqual(25)

            // Control words should be 80% ± 5%
            expect(controlPercentage).toBeGreaterThanOrEqual(75)
            expect(controlPercentage).toBeLessThanOrEqual(85)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should ensure test ORP is always within word bounds', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 100, maxLength: 200 }),
          (words) => {
            for (let i = 0; i < words.length; i++) {
              const word = words[i]
              const orpIndex = getORPIndexWithTesting(word, i)

              // ORP must always be within bounds [0, word.length - 1]
              expect(orpIndex).toBeGreaterThanOrEqual(0)
              expect(orpIndex).toBeLessThan(word.length)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle edge cases: single character words always return index 0', () => {
      const word = 'I'
      const sampleSize = 500

      for (let i = 0; i < sampleSize; i++) {
        const orpIndex = getORPIndexWithTesting(word, i)
        // For single character, ORP must be 0
        expect(orpIndex).toBe(0)
      }
    })
  })

  describe('Statistical properties of the distribution', () => {
    it('should have mean test percentage close to 20%', () => {
      fc.assert(
        fc.property(
          fc.constant(1000), // Fixed large sample
          (sampleSize) => {
            let testCount = 0

            for (let i = 0; i < sampleSize; i++) {
              if (shouldUseTestORP(i)) {
                testCount++
              }
            }

            const testPercentage = (testCount / sampleSize) * 100

            // With large samples, should be closer to 20%
            expect(testPercentage).toBeGreaterThanOrEqual(15)
            expect(testPercentage).toBeLessThanOrEqual(25)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
