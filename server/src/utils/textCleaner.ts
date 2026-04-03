// Regex matching tokens that consist entirely of punctuation/symbols (no letters or digits)
const PUNCT_ONLY = /^[^\w]+$/

export function cleanText(rawText: string): string[] {
  return rawText
    .split(/\s+/)
    .map(token => token.replace(/^[^\w]+|[^\w]+$/g, ''))  // strip leading/trailing punctuation
    .filter(token => token.length > 0 && !PUNCT_ONLY.test(token))
}
