import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { LanguageServiceClient } from '@google-cloud/language'

// Google Cloud Text-to-Speech Configuration
let ttsClient: TextToSpeechClient | null = null

export function getTTSClient(): TextToSpeechClient {
  if (!ttsClient) {
    // Initialize with credentials from environment or default application credentials
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
      : undefined

    ttsClient = new TextToSpeechClient(credentials)
    console.log('Google Cloud Text-to-Speech client initialized')
  }

  return ttsClient
}

// Google Cloud Language API Configuration
let languageClient: LanguageServiceClient | null = null

export function getLanguageClient(): LanguageServiceClient {
  if (!languageClient) {
    // Initialize with credentials from environment or default application credentials
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
      : undefined

    languageClient = new LanguageServiceClient(credentials)
    console.log('Google Cloud Language API client initialized')
  }

  return languageClient
}

// TTS Configuration Constants
export const TTS_CONFIG = {
  // Default audio encoding
  audioEncoding: 'MP3' as const,
  
  // Default speaking rate (1.0 = normal speed)
  defaultSpeakingRate: 1.0,
  
  // Default pitch (0.0 = normal pitch)
  defaultPitch: 0.0,
  
  // Supported language codes
  supportedLanguages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'],
  
  // Default voices by language
  defaultVoices: {
    'en-US': 'en-US-Neural2-A',
    'es-ES': 'es-ES-Neural2-A',
    'fr-FR': 'fr-FR-Neural2-A',
    'de-DE': 'de-DE-Neural2-A',
    'it-IT': 'it-IT-Neural2-A'
  }
}

// Language Detection Configuration Constants
export const LANGUAGE_CONFIG = {
  // Maximum text length for language detection (first N characters)
  maxDetectionLength: 1000,
  
  // Minimum confidence threshold for language detection (0.0-1.0)
  minConfidence: 0.5,
  
  // Default language fallback
  defaultLanguage: 'en',
  
  // Supported languages for ORP and TTS
  supportedLanguages: ['en', 'es', 'fr', 'de', 'it']
}

// ML Service Health Check
export async function checkMLServicesHealth(): Promise<{
  tts: boolean
  language: boolean
  errors: string[]
}> {
  const errors: string[] = []
  let ttsHealthy = false
  let languageHealthy = false

  // Check TTS service
  try {
    const client = getTTSClient()
    // Simple health check: list voices for English
    await client.listVoices({ languageCode: 'en-US' })
    ttsHealthy = true
  } catch (error) {
    errors.push(`TTS service error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Check Language service
  try {
    const client = getLanguageClient()
    // Simple health check: analyze sentiment of a test string
    await client.analyzeSentiment({
      document: {
        content: 'Hello world',
        type: 'PLAIN_TEXT'
      }
    })
    languageHealthy = true
  } catch (error) {
    errors.push(`Language service error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    tts: ttsHealthy,
    language: languageHealthy,
    errors
  }
}

// Cleanup function for graceful shutdown
export function cleanupMLClients(): void {
  if (ttsClient) {
    ttsClient.close()
    ttsClient = null
    console.log('Google Cloud Text-to-Speech client closed')
  }

  if (languageClient) {
    languageClient.close()
    languageClient = null
    console.log('Google Cloud Language API client closed')
  }
}
