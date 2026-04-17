import {
  uploadBook,
  uploadAudio,
  uploadOfflineBundle,
  generateBookDownloadUrl,
  generateAudioStreamUrl,
  generateOfflineBundleUrl,
  deleteFile,
  fileExists,
  getFileSize
} from '../services/storage/s3Storage'
import { s3Client, S3_BUCKET } from '../config/s3'

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/s3-request-presigner')

describe('S3 Storage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('uploadBook', () => {
    it('should upload a PDF book with correct key format', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      s3Client.send = mockSend

      const buffer = Buffer.from('test pdf content')
      const userId = 'user123'
      const filename = 'my-book.pdf'
      const format = 'pdf'

      const key = await uploadBook(buffer, userId, filename, format)

      expect(key).toMatch(/^books\/user123\/\d+_my-book\.pdf$/)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should upload an EPUB book with correct content type', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      s3Client.send = mockSend

      const buffer = Buffer.from('test epub content')
      const userId = 'user456'
      const filename = 'my-book.epub'
      const format = 'epub'

      const key = await uploadBook(buffer, userId, filename, format)

      expect(key).toMatch(/^books\/user456\/\d+_my-book\.epub$/)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should sanitize filenames with special characters', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      s3Client.send = mockSend

      const buffer = Buffer.from('test content')
      const userId = 'user789'
      const filename = 'my book (2024) #1.pdf'
      const format = 'pdf'

      const key = await uploadBook(buffer, userId, filename, format)

      expect(key).toMatch(/^books\/user789\/\d+_my_book__2024___1\.pdf$/)
    })
  })

  describe('uploadAudio', () => {
    it('should upload audio with correct key format', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      s3Client.send = mockSend

      const buffer = Buffer.from('test audio content')
      const userId = 'user123'
      const bookId = 'book456'

      const key = await uploadAudio(buffer, userId, bookId)

      expect(key).toMatch(/^audio\/user123\/book456\/\d+\.mp3$/)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('uploadOfflineBundle', () => {
    it('should upload offline bundle as JSON', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      s3Client.send = mockSend

      const data = { book: { title: 'Test Book' }, metadata: { version: 1 } }
      const userId = 'user123'
      const bookId = 'book456'

      const key = await uploadOfflineBundle(data, userId, bookId)

      expect(key).toMatch(/^offline\/user123\/book456_\d+\.json$/)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('generateSignedUrl', () => {
    it('should generate signed URL for book download', async () => {
      const mockGetSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com/book')

      const key = 'books/user123/1234567890_book.pdf'
      const url = await generateBookDownloadUrl(key)

      expect(url).toBe('https://signed-url.com/book')
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
    })

    it('should generate signed URL for audio streaming', async () => {
      const mockGetSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com/audio')

      const key = 'audio/user123/book456/1234567890.mp3'
      const url = await generateAudioStreamUrl(key)

      expect(url).toBe('https://signed-url.com/audio')
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
    })

    it('should generate signed URL for offline bundle', async () => {
      const mockGetSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl
      mockGetSignedUrl.mockResolvedValue('https://signed-url.com/offline')

      const key = 'offline/user123/book456_1234567890.json'
      const url = await generateOfflineBundleUrl(key)

      expect(url).toBe('https://signed-url.com/offline')
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteFile', () => {
    it('should delete a file from S3', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      s3Client.send = mockSend

      const key = 'books/user123/1234567890_book.pdf'
      await deleteFile(key)

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const mockSend = jest.fn().mockResolvedValue({ ContentLength: 1024 })
      s3Client.send = mockSend

      const key = 'books/user123/1234567890_book.pdf'
      const exists = await fileExists(key)

      expect(exists).toBe(true)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should return false if file does not exist', async () => {
      const mockSend = jest.fn().mockRejectedValue({ name: 'NotFound' })
      s3Client.send = mockSend

      const key = 'books/user123/nonexistent.pdf'
      const exists = await fileExists(key)

      expect(exists).toBe(false)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should throw error for other errors', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Network error'))
      s3Client.send = mockSend

      const key = 'books/user123/book.pdf'

      await expect(fileExists(key)).rejects.toThrow('Network error')
    })
  })

  describe('getFileSize', () => {
    it('should return file size in bytes', async () => {
      const mockSend = jest.fn().mockResolvedValue({ ContentLength: 2048 })
      s3Client.send = mockSend

      const key = 'books/user123/1234567890_book.pdf'
      const size = await getFileSize(key)

      expect(size).toBe(2048)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should return 0 if ContentLength is undefined', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      s3Client.send = mockSend

      const key = 'books/user123/1234567890_book.pdf'
      const size = await getFileSize(key)

      expect(size).toBe(0)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })
})
