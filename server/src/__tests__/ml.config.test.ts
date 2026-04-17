import {
  getTTSClient,
  getLanguageClient,
  TTS_CONFIG,
  LANGUAGE_CONFIG,
  checkMLServicesHealth,
  cleanupMLClients
} from '../config/ml'

describe('ML Configuration', () => {
  describe('TTS Client', () => {
    it('should initialize TTS client', () => {
      const client = getTTSClient()
      expect(client).toBeDefined()
      expect(client).toBeTruthy()
    })

    it('should return the same TTS client instance on multiple calls', () => {
      const client1 = getTTSClient()
      const client2 = getTTSClient()
      expect(client1).toBe(client2)
    })
  })

  describe('Language Client', () => {
    it('should initialize Language client', () => {
      const client = getLanguageClient()
      expect(client).toBeDefined()
      expect(client).toBeTruthy()
    })

    it('should return the same Language client instance on multiple calls', () => {
      const client1 = getLanguageClient()
      const client2 = getLanguageClient()
      expect(client1).toBe(client2)
    })
  })

  describe('TTS Configuration Constants', () => {
    it('should have correct audio encoding', () => {
      expect(TTS_CONFIG.audioEncoding).toBe('MP3')
    })

    it('should have default speaking rate of 1.0', () => {
      expect(TTS_CONFIG.defaultSpeakingRate).toBe(1.0)
    })

    it('should have default pitch of 0.0', () => {
      expect(TTS_CONFIG.defaultPitch).toBe(0.0)
    })

    it('should support required languages', () => {
      const requiredLanguages = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT']
      expect(TTS_CONFIG.supportedLanguages).toEqual(requiredLanguages)
    })

    it('should have default voices for all supported languages', () => {
      const supportedLanguages = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'] as const
      supportedLanguages.forEach(lang => {
        expect(TTS_CONFIG.defaultVoices[lang]).toBeDefined()
        expect(TTS_CONFIG.defaultVoices[lang]).toContain(lang)
      })
    })
  })

  describe('Language Configuration Constants', () => {
    it('should have max detection length of 1000 characters', () => {
      expect(LANGUAGE_CONFIG.maxDetectionLength).toBe(1000)
    })

    it('should have minimum confidence threshold', () => {
      expect(LANGUAGE_CONFIG.minConfidence).toBe(0.5)
      expect(LANGUAGE_CONFIG.minConfidence).toBeGreaterThanOrEqual(0)
      expect(LANGUAGE_CONFIG.minConfidence).toBeLessThanOrEqual(1)
    })

    it('should have default language fallback', () => {
      expect(LANGUAGE_CONFIG.defaultLanguage).toBe('en')
    })

    it('should support required languages', () => {
      const requiredLanguages = ['en', 'es', 'fr', 'de', 'it']
      expect(LANGUAGE_CONFIG.supportedLanguages).toEqual(requiredLanguages)
    })
  })

  describe('ML Services Health Check', () => {
    // Skip health check tests when credentials are not configured
    // These tests require actual Google Cloud credentials
    it.skip('should return health status object with correct structure', async () => {
      const health = await checkMLServicesHealth()
      
      expect(health).toHaveProperty('tts')
      expect(health).toHaveProperty('language')
      expect(health).toHaveProperty('errors')
      
      expect(typeof health.tts).toBe('boolean')
      expect(typeof health.language).toBe('boolean')
      expect(Array.isArray(health.errors)).toBe(true)
    })

    it.skip('should populate errors array when services are unavailable', async () => {
      // Without proper credentials, services should fail
      const health = await checkMLServicesHealth()
      
      // Without credentials, both services should fail
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        expect(health.tts).toBe(false)
        expect(health.language).toBe(false)
        expect(health.errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Cleanup', () => {
    it('should cleanup ML clients without throwing errors', () => {
      expect(() => cleanupMLClients()).not.toThrow()
    })
  })

  describe('Configuration Validation', () => {
    it('should have matching language codes between TTS and Language configs', () => {
      // Extract base language codes from TTS config
      const ttsLanguages = TTS_CONFIG.supportedLanguages.map(lang => lang.split('-')[0])
      const uniqueTTSLanguages = [...new Set(ttsLanguages)]
      
      // Should match Language config supported languages
      expect(uniqueTTSLanguages.sort()).toEqual(LANGUAGE_CONFIG.supportedLanguages.sort())
    })

    it('should have default voice for each supported TTS language', () => {
      TTS_CONFIG.supportedLanguages.forEach(lang => {
        const voice = TTS_CONFIG.defaultVoices[lang as keyof typeof TTS_CONFIG.defaultVoices]
        expect(voice).toBeDefined()
        expect(voice).toBeTruthy()
      })
    })
  })
})
