import JSZip from 'jszip'
import { cleanText } from '../../utils/textCleaner'

export interface EPUBChapter {
  title: string
  text: string
  wordCount: number
}

export interface EPUBData {
  title: string
  author: string
  chapters: EPUBChapter[]
  totalWords: number
  language: string
}

/** Strip HTML tags and decode common HTML entities, normalize whitespace */
function stripHTML(html: string): string {
  // Remove script/style blocks entirely
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  // Normalize whitespace
  return text.replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}

/** Parse the OPF file to extract metadata and spine order */
function parseOPF(opfContent: string): {
  title: string
  author: string
  language: string
  spineIds: string[]
  manifestItems: Map<string, string>  // id -> href
} {
  const title = (opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i) || [])[1]?.trim() || 'Unknown Title'
  const author = (opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i) || [])[1]?.trim() || 'Unknown Author'
  const language = (opfContent.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i) || [])[1]?.trim() || 'en'

  // Build manifest: id -> href
  const manifestItems = new Map<string, string>()
  const manifestMatch = opfContent.match(/<manifest[^>]*>([\s\S]*?)<\/manifest>/i)
  if (manifestMatch) {
    const itemRegex = /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = itemRegex.exec(manifestMatch[1])) !== null) {
      manifestItems.set(m[1], m[2])
    }
  }

  // Build spine order: list of idref values
  const spineIds: string[] = []
  const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i)
  if (spineMatch) {
    const itemrefRegex = /<itemref[^>]+idref="([^"]+)"/gi
    let m: RegExpExecArray | null
    while ((m = itemrefRegex.exec(spineMatch[1])) !== null) {
      spineIds.push(m[1])
    }
  }

  return { title, author, language, spineIds, manifestItems }
}

/** Resolve a path relative to a base directory */
function resolvePath(base: string, href: string): string {
  if (href.startsWith('/')) return href.slice(1)
  const baseDir = base.includes('/') ? base.substring(0, base.lastIndexOf('/') + 1) : ''
  // Simple path resolution: combine and normalize
  const combined = baseDir + href
  const parts = combined.split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '..') resolved.pop()
    else if (part !== '.') resolved.push(part)
  }
  return resolved.join('/')
}

/** Extract a chapter title from HTML content */
function extractChapterTitle(html: string, fallback: string): string {
  const headingMatch = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i)
  if (headingMatch) return headingMatch[1].trim()
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) return titleMatch[1].trim()
  return fallback
}

/**
 * Truncate a string at the last word boundary (space) at or before `maxChars`.
 * Returns the input unchanged if its length does not exceed `maxChars`.
 *
 * Requirements: 3.4, 5.3
 */
export function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  // Find the last space at or before maxChars
  const slice = text.slice(0, maxChars)
  const lastSpace = slice.lastIndexOf(' ')

  // If no space found, hard-cut at maxChars
  if (lastSpace === -1) return slice

  return text.slice(0, lastSpace)
}

/**
 * Determine whether a chapter is a navigation, table-of-contents, or cover chapter
 * that should be skipped when selecting preview content.
 *
 * Returns true when the chapter title or plain-text content matches common nav/toc/cover
 * heuristics (case-insensitive).
 *
 * Requirements: 4.1
 */
export function isNavigationChapter(title: string, text: string): boolean {
  const NAV_PATTERNS = [
    /\btable\s+of\s+contents?\b/i,
    /\btoc\b/i,
    /\bnavigation\b/i,
    /\bnav\b/i,
    /\bcover\b/i,
    /\btitle\s*page\b/i,
    /\bcopyright\b/i,
    /\bdedication\b/i,
    /\bcontents?\b/i,
  ]

  const titleLower = title.toLowerCase().trim()
  const textLower = text.toLowerCase().trim()

  // Check title first — a title match is always decisive
  for (const pattern of NAV_PATTERNS) {
    if (pattern.test(titleLower)) return true
  }

  // For content: only flag as navigation if the text is short (< 300 chars) AND matches
  // a nav pattern, to avoid false-positives in chapters that merely mention these words.
  if (textLower.length < 300) {
    for (const pattern of NAV_PATTERNS) {
      if (pattern.test(textLower)) return true
    }
  }

  return false
}

/**
 * Extract a plain-text preview from EPUB chapters.
 * - Skips nav/toc/cover chapters (via isNavigationChapter)
 * - Skips chapters with fewer than 50 plain-text characters
 * - Returns the first 500 words of the first eligible chapter
 * - Strips any residual HTML tags
 * - Normalizes whitespace (collapses runs to a single space)
 * - Truncates at a word boundary to a maximum of 2000 characters
 * - Returns empty string if no eligible chapter is found
 *
 * Requirements: 1.1, 4.1, 4.2, 4.3, 4.4, 5.3
 */
export function generatePreview(chapters: EPUBChapter[]): string {
  for (const ch of chapters) {
    // Skip navigation/toc/cover chapters
    if (isNavigationChapter(ch.title, ch.text)) continue

    // Strip any residual HTML tags
    let text = ch.text.replace(/<[^>]+>/g, ' ')

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim()

    // Skip if fewer than 50 characters
    if (text.length < 50) continue

    // Extract first 500 words
    const words = text.split(' ')
    const first500 = words.slice(0, 500).join(' ')

    // Truncate to max 2000 characters at a word boundary
    return truncateAtWordBoundary(first500, 2000)
  }

  return ''
}

/**
 * Extract EPUB content from a Buffer.
 * Requirements: 5.1, 5.2
 */
export async function extractEPUB(buffer: Buffer): Promise<EPUBData> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new Error('EPUB file is corrupted or cannot be parsed')
  }

  // Find the OPF file via META-INF/container.xml
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml')
  }

  const containerXml = await containerFile.async('string')
  const opfPathMatch = containerXml.match(/full-path="([^"]+\.opf)"/i)
  if (!opfPathMatch) {
    throw new Error('Invalid EPUB: cannot locate OPF file')
  }
  const opfPath = opfPathMatch[1]

  const opfFile = zip.file(opfPath)
  if (!opfFile) {
    throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`)
  }

  const opfContent = await opfFile.async('string')
  const { title, author, language, spineIds, manifestItems } = parseOPF(opfContent)

  // Determine chapter files from spine, falling back to all HTML/XHTML files
  let chapterPaths: Array<{ id: string; path: string }> = []

  if (spineIds.length > 0) {
    for (const id of spineIds) {
      const href = manifestItems.get(id)
      if (href) {
        const resolved = resolvePath(opfPath, href)
        chapterPaths.push({ id, path: resolved })
      }
    }
  }

  // Fallback: find all HTML/XHTML files sorted alphabetically
  if (chapterPaths.length === 0) {
    const htmlFiles = Object.keys(zip.files)
      .filter(name => /\.(html|xhtml|htm)$/i.test(name) && !zip.files[name].dir)
      .sort()
    chapterPaths = htmlFiles.map(p => ({ id: p, path: p }))
  }

  if (chapterPaths.length === 0) {
    throw new Error('EPUB file contains no readable text content')
  }

  // Extract chapters
  const chapters: EPUBChapter[] = []
  let totalWords = 0

  for (let i = 0; i < chapterPaths.length; i++) {
    const { path } = chapterPaths[i]
    const file = zip.file(path)
    if (!file) continue

    const html = await file.async('string')
    const text = stripHTML(html)

    if (!text || text.length < 10) continue  // skip near-empty files (nav, toc, etc.)

    const chapterTitle = extractChapterTitle(html, `Chapter ${chapters.length + 1}`)
    const wordCount = countWords(text)

    chapters.push({ title: chapterTitle, text, wordCount })
    totalWords += wordCount
  }

  if (chapters.length === 0) {
    throw new Error('EPUB file contains no readable text content')
  }

  return { title, author, chapters, totalWords, language }
}

/**
 * Convert an EPUB buffer into a Book-ready data structure.
 * Combines chapters, calculates word boundaries, detects language, and computes complexity.
 * Requirements: 5.1, 5.2, 5.5
 */
export async function processEPUBToBook(
  userId: string,
  buffer: Buffer,
  fileSize: number,
  originalName: string
): Promise<{ book: Record<string, unknown>; words: string[] }> {
  const epubData = await extractEPUB(buffer)

  // Flatten all chapter text into a single word array
  const allText = epubData.chapters.map(c => c.text).join(' ')
  const words = cleanText(allText)

  // Calculate metadata
  const totalLength = words.reduce((sum, word) => sum + word.length, 0)
  const averageWordLength = words.length > 0 ? totalLength / words.length : 0
  // Complexity score 0.0–1.0 based on average word length (10+ chars = max complexity)
  const complexityScore = Math.min(1.0, averageWordLength / 10)

  // Build chapter word-index boundaries
  let wordOffset = 0
  const chapters = epubData.chapters.map(ch => {
    const chWords = cleanText(ch.text)
    const startWordIndex = wordOffset
    const endWordIndex = wordOffset + chWords.length - 1
    wordOffset += chWords.length
    return { title: ch.title, startWordIndex, endWordIndex }
  })

  // Mock S3 URL — replace with real S3 upload when storage service is wired
  const fileUrl = `https://s3.amazonaws.com/speedreader-books/${userId}/${Date.now()}-${originalName}`

  const book: Record<string, unknown> = {
    userId,
    title: epubData.title,
    author: epubData.author,
    totalWords: words.length,
    words,
    format: 'epub',
    fileUrl,
    fileSize,
    language: epubData.language,
    averageWordLength,
    complexityScore,
    chapters,
    isCompleted: false,
    isAvailableOffline: false,
  }

  return { book, words }
}
