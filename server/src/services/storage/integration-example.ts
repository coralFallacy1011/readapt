/**
 * Integration Example: Using S3 Storage in Book Upload
 * 
 * This file demonstrates how to integrate the S3 storage service
 * into the existing book upload flow.
 */

import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth'
import { extractTextWithPageCounts } from '../../utils/pdfExtractor'
import { cleanText } from '../../utils/textCleaner'
import Book from '../../models/Book'
import {
  uploadBook as uploadBookToS3,
  generateBookDownloadUrl,
  deleteFile
} from './s3Storage'

/**
 * Example: Upload book with S3 storage
 * 
 * This replaces the current implementation that stores pdfData in MongoDB
 * with S3 storage for better scalability and performance.
 */
export async function uploadBookWithS3(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'Only PDF files are accepted' })
    return
  }

  try {
    // Step 1: Extract text from PDF (existing logic)
    const { text: rawText, pageWordCounts } = await extractTextWithPageCounts(req.file.buffer)
    const words = cleanText(rawText)
    const title = req.file.originalname.replace(/\.pdf$/i, '')

    // Step 2: Calculate metadata (existing logic)
    const totalLength = words.reduce((sum, word) => sum + word.length, 0)
    const averageWordLength = words.length > 0 ? totalLength / words.length : 0
    const complexityScore = Math.min(1.0, averageWordLength / 10)

    // Step 3: Upload PDF to S3 (NEW)
    const s3Key = await uploadBookToS3(
      req.file.buffer,
      req.user!.id,
      req.file.originalname,
      'pdf'
    )

    // Step 4: Create book document with S3 reference (MODIFIED)
    const book = await Book.create({
      userId: req.user!.id,
      title,
      totalWords: words.length,
      words,
      pageWordCounts,
      format: 'pdf',
      fileUrl: s3Key,  // Store S3 key instead of buffer
      fileSize: req.file.buffer.length,
      language: 'en',
      averageWordLength,
      complexityScore,
      isCompleted: false,
      isAvailableOffline: false
      // Note: pdfData field is no longer used
    })

    res.status(201).json({
      book: {
        _id: book._id,
        title: book.title,
        totalWords: book.totalWords,
        createdAt: book.createdAt,
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Could not extract text from PDF') {
      res.status(422).json({ error: message })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

/**
 * Example: Serve PDF from S3 with signed URL
 * 
 * This replaces the current implementation that serves pdfData from MongoDB
 * with a redirect to a signed S3 URL.
 */
export async function getPDFFromS3(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findById(req.params.id).select('userId fileUrl')
    
    if (!book) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    
    if (book.userId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    
    if (!book.fileUrl) {
      res.status(404).json({ error: 'PDF not stored — re-upload the document' })
      return
    }

    // Generate signed URL (valid for 1 hour)
    const signedUrl = await generateBookDownloadUrl(book.fileUrl)
    
    // Option 1: Redirect to signed URL (recommended for web)
    res.redirect(signedUrl)
    
    // Option 2: Return signed URL in JSON (recommended for mobile apps)
    // res.json({ url: signedUrl, expiresIn: 3600 })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Example: Delete book and cleanup S3 storage
 * 
 * This ensures that when a book is deleted, the associated S3 file
 * is also removed to prevent orphaned files.
 */
export async function deleteBookWithS3Cleanup(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findById(req.params.id).select('userId fileUrl')
    
    if (!book) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    
    if (book.userId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    // Delete from S3 first
    if (book.fileUrl) {
      try {
        await deleteFile(book.fileUrl)
      } catch (error) {
        console.error('Failed to delete S3 file:', error)
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await Book.findByIdAndDelete(req.params.id)
    
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Example: EPUB upload with S3 storage
 * 
 * This demonstrates how to handle EPUB uploads with S3 storage.
 */
export async function uploadEPUBWithS3(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'Only EPUB files are accepted' })
    return
  }

  try {
    // Step 1: Extract text from EPUB (to be implemented in task 5.1)
    // const { title, author, chapters } = await extractEPUB(req.file.buffer)
    
    // For now, placeholder implementation
    const title = req.file.originalname.replace(/\.epub$/i, '')
    const words = ['placeholder', 'words']  // Will be replaced with actual extraction

    // Step 2: Upload EPUB to S3
    const s3Key = await uploadBookToS3(
      req.file.buffer,
      req.user!.id,
      req.file.originalname,
      'epub'
    )

    // Step 3: Create book document
    const book = await Book.create({
      userId: req.user!.id,
      title,
      totalWords: words.length,
      words,
      format: 'epub',
      fileUrl: s3Key,
      fileSize: req.file.buffer.length,
      language: 'en',
      averageWordLength: 5,
      complexityScore: 0.5,
      isCompleted: false,
      isAvailableOffline: false
    })

    res.status(201).json({
      book: {
        _id: book._id,
        title: book.title,
        totalWords: book.totalWords,
        createdAt: book.createdAt,
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
}

/**
 * Example: Offline bundle creation with S3 storage
 * 
 * This demonstrates how to create and store offline bundles for mobile apps.
 */
export async function createOfflineBundle(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findById(req.params.bookId).select('-pdfData')
    
    if (!book) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    
    if (book.userId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    // Create offline bundle (from design.md)
    const bundle = {
      book: {
        _id: book._id,
        title: book.title,
        author: book.author,
        totalWords: book.totalWords,
        words: book.words,
        chapters: book.chapters,
        format: book.format
      },
      metadata: {
        cachedAt: new Date(),
        version: 1
      }
    }

    // Upload bundle to S3
    const { uploadOfflineBundle } = await import('./s3Storage')
    const s3Key = await uploadOfflineBundle(
      bundle,
      req.user!.id,
      req.params.bookId
    )

    // Generate signed URL for download
    const { generateOfflineBundleUrl } = await import('./s3Storage')
    const bundleUrl = await generateOfflineBundleUrl(s3Key)

    // Update book record
    book.isAvailableOffline = true
    book.offlineCacheSize = JSON.stringify(bundle).length
    await book.save()

    res.json({
      cacheUrl: bundleUrl,
      size: book.offlineCacheSize,
      expiresIn: 86400  // 24 hours
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
