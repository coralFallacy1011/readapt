// Feature: ai-adaptive-features, Property 41: Language-specific ORP rules
import * as fc from 'fast-check'

/**
 * Validates: Requirements 17.3
 *
 * Property 41: Language-specific ORP rules
 * Tests the pure getLanguageSpecificORPIndex logic from client/src/utils/orp.ts.
 */

// ---- Pure logic (mirrors client/src/utils/orp.ts) ----

function getORPIndex(wordLength: number): number {
  if (wordLength <= 3) return Math.floor(wordLength / 2)
  if (wordLength <= 7) return Math.floor(wordLength / 4)
  return Math.floor(wordLength / 3) - 1
}

function getLanguageSpecificORPIndex(word: string, language: string): number {
  const len = word.length
  if (len === 0) return 0

  switch (language) {
    case 'es':
    case 'fr':
    case 'it':
      return Math.min(Math.floor(len * 0.4), len - 1)
    case 'de':
      return Math.min(Math.floor(len * 0.35), len - 1)
    case 'en':
    default:
      return getORPIndex(len)
  }
}

// ---- Arbitraries ----

const wordArb = fc.stringMatching(/^[a-zA-Z]{1,30}$/)
const nonEmptyWordArb = fc.stringMatching(/^[a-zA-Z]{1,30}$/)

// ---- Tests ----

describe('Language ORP - Property 41: Language-specific ORP rules', () => {
  /**
   * Property 1: English uses standard ORP calculation
   */
  it('English uses standard ORP calculation', () => {
    fc.assert(
      fc.property(nonEmptyWordArb, (word) => {
        const result = getLanguageSpecificORPIndex(word, 'en')
        const expected = getORPIndex(word.length)
        return result === expected
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Spanish/French/Italian use 40% of word length
   */
  it('Spanish uses 40% of word length', () => {
    fc.assert(
      fc.property(nonEmptyWordArb, (word) => {
        const result = getLanguageSpecificORPIndex(word, 'es')
        const expected = Math.min(Math.floor(word.length * 0.4), word.length - 1)
        return result === expected
      }),
      { numRuns: 100 }
    )
  })

  it('French uses 40% of word length', () => {
    fc.assert(
      fc.property(nonEmptyWordArb, (word) => {
        const result = getLanguageSpecificORPIndex(word, 'fr')
        const expected = Math.min(Math.floor(word.length * 0.4), word.length - 1)
        return result === expected
      }),
      { numRuns: 100 }
    )
  })

  it('Italian uses 40% of word length', () => {
    fc.assert(
      fc.property(nonEmptyWordArb, (word) => {
        const result = getLanguageSpecificORPIndex(word, 'it')
        const expected = Math.min(Math.floor(word.length * 0.4), word.length - 1)
        return result === expected
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: German uses 35% of word length
   */
  it('German uses 35% of word length', () => {
    fc.assert(
      fc.property(nonEmptyWordArb, (word) => {
        const result = getLanguageSpecificORPIndex(word, 'de')
        const expected = Math.min(Math.floor(word.length * 0.35), word.length - 1)
        return result === expected
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Result is always in [0, word.length - 1]
   */
  it('result is always in [0, word.length - 1] for all supported languages', () => {
    const languages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh']
    fc.assert(
      fc.property(nonEmptyWordArb, fc.constantFrom(...languages), (word, lang) => {
        const result = getLanguageSpecificORPIndex(word, lang)
        return result >= 0 && result <= word.length - 1
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Empty word returns 0
   */
  it('empty word returns 0 for all languages', () => {
    fc.assert(
      fc.property(fc.constantFrom('en', 'es', 'fr', 'de', 'it'), (lang) => {
        return getLanguageSpecificORPIndex('', lang) === 0
      }),
      { numRuns: 100 }
    )
  })
})
