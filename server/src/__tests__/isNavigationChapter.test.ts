import { isNavigationChapter } from '../services/epub/epubProcessor'

describe('isNavigationChapter', () => {
  // --- title-based detection ---

  it('returns true for title "Table of Contents"', () => {
    expect(isNavigationChapter('Table of Contents', 'some body text that is longer than three hundred characters and goes on and on with placeholder content just to exceed the short-text threshold so the content check is not triggered here')).toBe(true)
  })

  it('returns true for title "toc" (case-insensitive)', () => {
    expect(isNavigationChapter('TOC', '')).toBe(true)
  })

  it('returns true for title "Navigation"', () => {
    expect(isNavigationChapter('Navigation', '')).toBe(true)
  })

  it('returns true for title "nav"', () => {
    expect(isNavigationChapter('nav', '')).toBe(true)
  })

  it('returns true for title "Cover"', () => {
    expect(isNavigationChapter('Cover', '')).toBe(true)
  })

  it('returns true for title "Title Page"', () => {
    expect(isNavigationChapter('Title Page', '')).toBe(true)
  })

  it('returns true for title "Copyright"', () => {
    expect(isNavigationChapter('Copyright', '')).toBe(true)
  })

  it('returns true for title "Dedication"', () => {
    expect(isNavigationChapter('Dedication', '')).toBe(true)
  })

  it('returns true for title "Contents"', () => {
    expect(isNavigationChapter('Contents', '')).toBe(true)
  })

  it('is case-insensitive for titles', () => {
    expect(isNavigationChapter('TABLE OF CONTENTS', '')).toBe(true)
    expect(isNavigationChapter('table of contents', '')).toBe(true)
    expect(isNavigationChapter('TaBle Of CoNtEnTs', '')).toBe(true)
  })

  // --- content-based detection (short text) ---

  it('returns true for short text containing "table of contents"', () => {
    expect(isNavigationChapter('Chapter 1', 'table of contents')).toBe(true)
  })

  it('returns true for short text containing "navigation"', () => {
    expect(isNavigationChapter('Intro', 'navigation')).toBe(true)
  })

  it('returns true for short text containing "cover"', () => {
    expect(isNavigationChapter('', 'cover image')).toBe(true)
  })

  // --- normal chapters should NOT be flagged ---

  it('returns false for a normal chapter title', () => {
    expect(isNavigationChapter('Chapter One', 'It was a dark and stormy night...')).toBe(false)
  })

  it('returns false for a regular prologue title', () => {
    expect(isNavigationChapter('Prologue', 'The world had changed in ways no one had anticipated.')).toBe(false)
  })

  it('returns false for an empty title and normal long content', () => {
    const longContent = 'word '.repeat(100)   // 500+ chars, no nav pattern
    expect(isNavigationChapter('', longContent)).toBe(false)
  })

  // --- long content with nav keywords should NOT be flagged (avoid false positives) ---

  it('does not flag a long chapter that merely mentions "table of contents" in passing', () => {
    // Over 300 chars, so the content heuristic is not applied
    const longText =
      'This book begins with a table of contents but then goes on to describe many fascinating things. ' +
      'The protagonist ventures through lands never before explored by anyone from the old world, encountering ' +
      'mysteries and wonders at every turn until the very end of this lengthy chapter. ' +
      'Additional sentences are included here to ensure the total length well exceeds three hundred characters.'
    expect(isNavigationChapter('Part One: The Journey', longText)).toBe(false)
  })

  // --- edge cases ---

  it('returns false for empty title and empty text', () => {
    expect(isNavigationChapter('', '')).toBe(false)
  })

  it('returns false for whitespace-only title and text', () => {
    expect(isNavigationChapter('   ', '   ')).toBe(false)
  })

  it('returns true when title has surrounding whitespace matching a nav keyword', () => {
    expect(isNavigationChapter('  cover  ', '')).toBe(true)
  })
})
