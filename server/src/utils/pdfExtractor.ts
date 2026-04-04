// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
  options?: { pagerender?: (pageData: { getTextContent: () => Promise<{ items: { str: string }[] }> }) => Promise<string> }
) => Promise<{ text: string; numpages: number }>

import { cleanText } from './textCleaner'

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch {
    throw new Error('Could not extract text from PDF')
  }
}

export async function extractTextWithPageCounts(buffer: Buffer): Promise<{
  text: string
  pageWordCounts: number[]
}> {
  try {
    const pageTexts: string[] = []

    await pdfParse(buffer, {
      pagerender: async (pageData) => {
        const content = await pageData.getTextContent()
        const text = content.items.map((i) => i.str).join(' ')
        pageTexts.push(text)
        return text
      }
    })

    const pageWordCounts = pageTexts.map(t => cleanText(t).length)
    const text = pageTexts.join(' ')
    return { text, pageWordCounts }
  } catch {
    throw new Error('Could not extract text from PDF')
  }
}
