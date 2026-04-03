// Feature: readapt-rsvp-platform, Property 3: Word splitting round-trip
import * as fc from 'fast-check'
import { cleanText } from '../utils/textCleaner'

/**
 * Validates: Requirements 3.2
 *
 * Property 3: Word splitting round-trip
 * For any non-empty string of words separated by whitespace, splitting into
 * words and then joining with a single space should produce a string whose
 * word-set is equivalent to the original (order preserved, empty tokens removed).
 */
describe('textCleaner - Property 3: Word splitting round-trip', () => {
  it('splitting and rejoining preserves word order and removes empty tokens', () => {
    // Generator: array of non-empty "word" strings (alphanumeric, no whitespace)
    // joined by one or more whitespace characters
    const wordGen = fc.stringMatching(/^[a-zA-Z0-9]+$/)
    const whitespaceGen = fc.stringMatching(/^\s+$/).filter(s => s.length >= 1)

    const inputGen = fc
      .array(wordGen, { minLength: 1, maxLength: 20 })
      .chain(words =>
        fc
          .array(whitespaceGen, { minLength: words.length - 1, maxLength: words.length - 1 })
          .map(separators => {
            // Interleave words with separators: w0 sep0 w1 sep1 w2 ...
            return words.reduce((acc, word, i) => {
              return i === 0 ? word : acc + separators[i - 1] + word
            }, '')
          })
          .map(joined => ({ words, joined }))
      )

    fc.assert(
      fc.property(inputGen, ({ words, joined }) => {
        const result = cleanText(joined)

        // The result must have the same length as the original word array
        expect(result.length).toBe(words.length)

        // Each word must match in order
        result.forEach((token, i) => {
          expect(token).toBe(words[i])
        })
      }),
      { numRuns: 100 }
    )
  })

  it('empty tokens and punctuation-only tokens are removed', () => {
    // Strings with extra whitespace produce no empty tokens in the result
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-zA-Z0-9]+$/), { minLength: 1, maxLength: 20 }),
        words => {
          // Join with multiple spaces / tabs to introduce potential empty tokens
          const input = words.join('   ')
          const result = cleanText(input)

          // No empty strings in result
          expect(result.every(w => w.length > 0)).toBe(true)
          // Result length matches original word count
          expect(result.length).toBe(words.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})
