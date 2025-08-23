import { createClient } from './supabase'
import { createServerSupabaseClient } from './supabase-server'
import { Platform } from '@/types'
import { validateMediaForPlatform } from '@/utils/mediaProcessing'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface MediaUploadResult {
  filename: string
  path: string
  publicUrl: string
  bucket: string
  thumbnailPath?: string
  thumbnailUrl?: string
  metadata?: MediaMetadata
}

export interface MediaMetadata {
  width?: number
  height?: number
  duration?: number
  format?: string
  [key: string]: any
}

export interface MediaFileRecord {
  userId: string
  filename: string
  originalFilename: string
  filePath: string
  fileSize: number
  mimeType: string
  width?: number
  height?: number
  duration?: number
  thumbnailPath?: string
  storageBucket: string
  metadata: Record<string, any>
}

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

const STORAGE_BUCKETS = {
  MEDIA_FILES: 'media-files',
  THUMBNAILS: 'thumbnails'
} as const

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const THUMBNAIL_SIZE = { width: 300, height: 300 }

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export async function validateMediaFile(
  file: File,
  platform: Platform
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = []

  // Basic file validation
  if (!file) {
    errors.push('No file provided')
    return { isValid: false, errors }
  }

  if (file.size === 0) {
    errors.push('File is empty')
    return { isValid: false, errors }
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
  }

  // Platform-specific validation
  const platformValidation = validateMediaForPlatform(file, platform)
  if (!platformValidation.isValid) {
    errors.push(...platformValidation.errors)
  }

  // Additional security checks
  if (!isValidMimeType(file.type)) {
    errors.push(`File type ${file.type} is not allowed`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

function isValidMimeType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
  return allowedTypes.includes(mimeType)
}

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

export async function uploadMediaToStorage(
  file: File,
  userId: string
): Promise<MediaUploadResult> {
  const supabase = createServerSupabaseClient()
  
  // Generate unique filename
  const fileExtension = getFileExtension(file.name)
  const filename = `${uuidv4()}${fileExtension}`
  const filePath = `${userId}/${filename}`

  // Extract metadata before upload
  const metadata = await extractFileMetadata(file)

  // Upload main file
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.MEDIA_FILES)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`)
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKETS.MEDIA_FILES)
    .getPublicUrl(filePath)

  const result: MediaUploadResult = {
    filename,
    path: filePath,
    publicUrl: publicUrlData.publicUrl,
    bucket: STORAGE_BUCKETS.MEDIA_FILES,
    metadata
  }

  // Generate thumbnail for images
  if (file.type.startsWith('image/')) {
    try {
      const thumbnailResult = await generateAndUploadThumbnail(file, userId, filename)
      result.thumbnailPath = thumbnailResult.path
      result.thumbnailUrl = thumbnailResult.publicUrl
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error)
      // Continue without thumbnail - not critical
    }
  }

  return result
}

async function generateAndUploadThumbnail(
  file: File,
  userId: string,
  originalFilename: string
): Promise<{ path: string; publicUrl: string }> {
  const supabase = createServerSupabaseClient()
  
  // Generate thumbnail blob
  const thumbnailBlob = await createImageThumbnail(file, THUMBNAIL_SIZE)
  
  // Upload thumbnail
  const thumbnailFilename = `thumb_${originalFilename}`
  const thumbnailPath = `${userId}/${thumbnailFilename}`

  const { error: thumbnailError } = await supabase.storage
    .from(STORAGE_BUCKETS.THUMBNAILS)
    .upload(thumbnailPath, thumbnailBlob, {
      cacheControl: '3600',
      upsert: false
    })

  if (thumbnailError) {
    throw new Error(`Failed to upload thumbnail: ${thumbnailError.message}`)
  }

  // Get thumbnail public URL
  const { data: thumbnailUrlData } = supabase.storage
    .from(STORAGE_BUCKETS.THUMBNAILS)
    .getPublicUrl(thumbnailPath)

  return {
    path: thumbnailPath,
    publicUrl: thumbnailUrlData.publicUrl
  }
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

async function extractFileMetadata(file: File): Promise<MediaMetadata> {
  const metadata: MediaMetadata = {
    format: getFileExtension(file.name).slice(1) // Remove the dot
  }

  if (file.type.startsWith('image/')) {
    const imageDimensions = await getImageDimensions(file)
    metadata.width = imageDimensions.width
    metadata.height = imageDimensions.height
  } else if (file.type.startsWith('video/')) {
    const videoDimensions = await getVideoDimensions(file)
    metadata.width = videoDimensions.width
    metadata.height = videoDimensions.height
    metadata.duration = videoDimensions.duration
  }

  return metadata
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.width, height: img.height })
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    
    img.src = url
  })
}

function getVideoDimensions(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration
      })
    }
    
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }
    
    video.src = url
  })
}

// ============================================================================
// THUMBNAIL GENERATION
// ============================================================================

function createImageThumbnail(
  file: File,
  size: { width: number; height: number }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }
    
    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      const aspectRatio = img.width / img.height
      let { width, height } = size
      
      if (aspectRatio > 1) {
        height = width / aspectRatio
      } else {
        width = height * aspectRatio
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to generate thumbnail'))
        }
      }, 'image/jpeg', 0.8)
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image for thumbnail'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

export async function createMediaRecord(record: MediaFileRecord) {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('media_files')
    .insert({
      user_id: record.userId,
      filename: record.filename,
      original_filename: record.originalFilename,
      file_path: record.filePath,
      file_size: record.fileSize,
      mime_type: record.mimeType,
      width: record.width,
      height: record.height,
      duration: record.duration,
      thumbnail_path: record.thumbnailPath,
      storage_bucket: record.storageBucket,
      metadata: record.metadata
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create media record: ${error.message}`)
  }

  return data
}

export async function deleteMediaFile(mediaId: string, userId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  // Get media file details
  const { data: mediaFile, error: fetchError } = await supabase
    .from('media_files')
    .select('*')
    .eq('id', mediaId)
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch media file: ${fetchError.message}`)
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(mediaFile.storage_bucket)
    .remove([mediaFile.file_path])

  if (storageError) {
    console.warn('Failed to delete file from storage:', storageError)
    // Continue with database deletion even if storage deletion fails
  }

  // Delete thumbnail if exists
  if (mediaFile.thumbnail_path) {
    const { error: thumbnailError } = await supabase.storage
      .from(STORAGE_BUCKETS.THUMBNAILS)
      .remove([mediaFile.thumbnail_path])

    if (thumbnailError) {
      console.warn('Failed to delete thumbnail from storage:', thumbnailError)
    }
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('media_files')
    .delete()
    .eq('id', mediaId)
    .eq('user_id', userId)

  if (dbError) {
    throw new Error(`Failed to delete media record: ${dbError.message}`)
  }
}

// ============================================================================
// CLEANUP OPERATIONS
// ============================================================================

export async function cleanupOrphanedFiles(userId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  // Get all media files for user
  const { data: mediaFiles, error } = await supabase
    .from('media_files')
    .select('file_path, thumbnail_path, storage_bucket')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch media files: ${error.message}`)
  }

  // Get all files in user's storage folder
  const { data: storageFiles, error: storageError } = await supabase.storage
    .from(STORAGE_BUCKETS.MEDIA_FILES)
    .list(userId)

  if (storageError) {
    console.warn('Failed to list storage files:', storageError)
    return
  }

  // Find orphaned files (in storage but not in database)
  const dbFilePaths = new Set(mediaFiles?.map(f => f.file_path.split('/').pop()) || [])
  const orphanedFiles = storageFiles?.filter(file => !dbFilePaths.has(file.name)) || []

  // Delete orphaned files
  if (orphanedFiles.length > 0) {
    const pathsToDelete = orphanedFiles.map(file => `${userId}/${file.name}`)
    const { error: deleteError } = await supabase.storage
      .from(STORAGE_BUCKETS.MEDIA_FILES)
      .remove(pathsToDelete)

    if (deleteError) {
      console.warn('Failed to delete orphaned files:', deleteError)
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex !== -1 ? filename.slice(lastDotIndex) : ''
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ============================================================================
// STORAGE BUCKET SETUP
// ============================================================================

export async function initializeStorageBuckets(): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  try {
    // Create media-files bucket if it doesn't exist
    const { error: mediaError } = await supabase.storage.createBucket(STORAGE_BUCKETS.MEDIA_FILES, {
      public: true,
      allowedMimeTypes: [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/webm'
      ],
      fileSizeLimit: MAX_FILE_SIZE
    })
    
    if (mediaError && !mediaError.message.includes('already exists')) {
      console.warn('Failed to create media-files bucket:', mediaError)
    }

    // Create thumbnails bucket if it doesn't exist
    const { error: thumbError } = await supabase.storage.createBucket(STORAGE_BUCKETS.THUMBNAILS, {
      public: true,
      allowedMimeTypes: ['image/jpeg'],
      fileSizeLimit: 5 * 1024 * 1024 // 5MB for thumbnails
    })
    
    if (thumbError && !thumbError.message.includes('already exists')) {
      console.warn('Failed to create thumbnails bucket:', thumbError)
    }

  } catch (error) {
    console.warn('Storage bucket initialization failed:', error)
  }
}