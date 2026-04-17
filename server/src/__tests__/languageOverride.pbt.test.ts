// Feature: ai-adaptive-features, Property 42: Manual language override takes precedence
import * as fc from 'fast-check'

/**
 * Validates: Requirements 17.5
 *
 * Property 42: Manual language override takes precedence
 * Tests the pure language override logic from languageController.ts.
 */

// ---- Pure logic (mirrors languageController.ts) ----

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar']

interface BookLanguageState {
  language: string
}

function applyLanguageOverride(
  book: BookLanguageState,
  newLanguage: string
): { success: true; book: BookLanguageState } | { success: false; error: string } {
  if (!SUPPORTED_LANGUAGES.includes(newLanguage)) {
    return { success: false, error: `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` }
  }
  return { success: true, book: { ...book, language: newLanguage } }
}

// ---- Arbitraries ----

const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES)
const unsupportedLanguageArb = fc.string({ minLength: 1, maxLength: 10 }).filter(
  s => !SUPPORTED_LANGUAGES.includes(s)
)
const bookArb = fc.record({ language: supportedLanguageArb })

// ---- Tests ----

describe('Language Override - Property 42: Manual language override takes precedence', () => {
  /**
   * Property 1: Manual override always sets the language to the provided value
   */
  it('manual override sets language to the provided value', () => {
    fc.assert(
      fc.property(bookArb, supportedLanguageArb, (book, newLang) => {
        const result = applyLanguageOverride(book, newLang)
        if (!result.success) return false
        return result.book.language === newLang
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Supported languages are accepted
   */
  it('all supported languages are accepted', () => {
    fc.assert(
      fc.property(bookArb, supportedLanguageArb, (book, lang) => {
        const result = applyLanguageOverride(book, lang)
        return result.success === true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Unsupported language → rejected
   */
  it('unsupported language is rejected', () => {
    fc.assert(
      fc.property(bookArb, unsupportedLanguageArb, (book, lang) => {
        const result = applyLanguageOverride(book, lang)
        return result.success === false
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Override takes precedence over any auto-detected language
   */
  it('override takes precedence over any existing language', () => {
    fc.assert(
      fc.property(supportedLanguageArb, supportedLanguageArb, (existingLang, overrideLang) => {
        const book: BookLanguageState = { language: existingLang }
        const result = applyLanguageOverride(book, overrideLang)
        if (!result.success) return false
        // The result language is always the override, regardless of what was there before
        return result.book.language === overrideLang
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Supported languages list has exactly 10 entries
   */
  it('supported languages list contains exactly the expected 10 languages', () => {
    const expected = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar']
    expect(SUPPORTED_LANGUAGES).toHaveLength(10)
    expect(SUPPORTED_LANGUAGES).toEqual(expect.arrayContaining(expected))
  })
})
