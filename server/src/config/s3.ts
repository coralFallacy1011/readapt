import { S3Client } from '@aws-sdk/client-s3'

// S3 Configuration
// Supports AWS S3 or compatible services (MinIO, DigitalOcean Spaces, etc.)
const s3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    : undefined,
  // Optional: Custom endpoint for S3-compatible services
  ...(process.env.S3_ENDPOINT && {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true  // Required for MinIO and some S3-compatible services
  })
}

export const s3Client = new S3Client(s3Config)

export const S3_BUCKET = process.env.S3_BUCKET_NAME || 'readapt-storage'

// Signed URL expiration times (in seconds)
export const SIGNED_URL_EXPIRY = {
  BOOK_DOWNLOAD: 3600,      // 1 hour for book downloads
  AUDIO_STREAM: 7200,       // 2 hours for audio streaming
  OFFLINE_BUNDLE: 86400,    // 24 hours for offline bundles
  UPLOAD: 300               // 5 minutes for direct uploads
}
