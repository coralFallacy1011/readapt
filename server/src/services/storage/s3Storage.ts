import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client, S3_BUCKET, SIGNED_URL_EXPIRY } from '../../config/s3'

/**
 * Upload a file buffer to S3
 * @param buffer - File content as Buffer
 * @param key - S3 object key (path)
 * @param contentType - MIME type of the file
 * @returns S3 object key
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Set cache control for optimal performance
    CacheControl: 'private, max-age=31536000'  // 1 year for immutable content
  })

  await s3Client.send(command)
  return key
}

/**
 * Upload a book file (PDF or EPUB) to S3
 * @param buffer - Book file content
 * @param userId - User ID for organizing storage
 * @param filename - Original filename
 * @param format - File format ('pdf' or 'epub')
 * @returns S3 object key
 */
export async function uploadBook(
  buffer: Buffer,
  userId: string,
  filename: string,
  format: 'pdf' | 'epub'
): Promise<string> {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const key = `books/${userId}/${timestamp}_${sanitizedFilename}`
  
  const contentType = format === 'pdf' ? 'application/pdf' : 'application/epub+zip'
  
  await uploadFile(buffer, key, contentType)
  return key
}

/**
 * Upload audio file (TTS generated) to S3
 * @param buffer - Audio file content
 * @param userId - User ID for organizing storage
 * @param bookId - Book ID for reference
 * @returns S3 object key
 */
export async function uploadAudio(
  buffer: Buffer,
  userId: string,
  bookId: string
): Promise<string> {
  const timestamp = Date.now()
  const key = `audio/${userId}/${bookId}/${timestamp}.mp3`
  
  await uploadFile(buffer, key, 'audio/mpeg')
  return key
}

/**
 * Upload offline bundle (JSON) to S3
 * @param data - Bundle data object
 * @param userId - User ID
 * @param bookId - Book ID
 * @returns S3 object key
 */
export async function uploadOfflineBundle(
  data: object,
  userId: string,
  bookId: string
): Promise<string> {
  const timestamp = Date.now()
  const key = `offline/${userId}/${bookId}_${timestamp}.json`
  const buffer = Buffer.from(JSON.stringify(data), 'utf-8')
  
  await uploadFile(buffer, key, 'application/json')
  return key
}

/**
 * Generate a signed URL for secure file access
 * @param key - S3 object key
 * @param expiresIn - Expiration time in seconds
 * @returns Signed URL
 */
export async function generateSignedUrl(
  key: string,
  expiresIn: number = SIGNED_URL_EXPIRY.BOOK_DOWNLOAD
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key
  })

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn })
  return signedUrl
}

/**
 * Generate a signed URL for book download
 * @param key - S3 object key
 * @returns Signed URL valid for 1 hour
 */
export async function generateBookDownloadUrl(key: string): Promise<string> {
  return generateSignedUrl(key, SIGNED_URL_EXPIRY.BOOK_DOWNLOAD)
}

/**
 * Generate a signed URL for audio streaming
 * @param key - S3 object key
 * @returns Signed URL valid for 2 hours
 */
export async function generateAudioStreamUrl(key: string): Promise<string> {
  return generateSignedUrl(key, SIGNED_URL_EXPIRY.AUDIO_STREAM)
}

/**
 * Generate a signed URL for offline bundle download
 * @param key - S3 object key
 * @returns Signed URL valid for 24 hours
 */
export async function generateOfflineBundleUrl(key: string): Promise<string> {
  return generateSignedUrl(key, SIGNED_URL_EXPIRY.OFFLINE_BUNDLE)
}

/**
 * Delete a file from S3
 * @param key - S3 object key
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key
  })

  await s3Client.send(command)
}

/**
 * Check if a file exists in S3
 * @param key - S3 object key
 * @returns true if file exists, false otherwise
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key
    })

    await s3Client.send(command)
    return true
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      return false
    }
    throw error
  }
}

/**
 * Get file size from S3
 * @param key - S3 object key
 * @returns File size in bytes
 */
export async function getFileSize(key: string): Promise<number> {
  const command = new HeadObjectCommand({
    Bucket: S3_BUCKET,
    Key: key
  })

  const response = await s3Client.send(command)
  return response.ContentLength || 0
}
