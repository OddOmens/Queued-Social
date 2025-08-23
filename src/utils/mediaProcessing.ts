// ============================================================================
// MEDIA PROCESSING UTILITIES
// ============================================================================

import { Platform } from '../types'
import { PLATFORM_CONFIGS } from '../types/platform'

// ============================================================================
// MEDIA FILE PROCESSING
// ============================================================================

export interface ProcessedMediaFile {
  originalFile: File
  processedUrl?: string
  thumbnailUrl?: string
  metadata: {
    width?: number
    height?: number
    duration?: number
    size: number
    type: string
    format: string
  }
}

export interface MediaProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number // 0-1 for images
  generateThumbnail?: boolean
  thumbnailSize?: { width: number; height: number }
}

/**
 * Process media file for platform-specific requirements
 */
export const processMediaFile = async (
  file: File,
  platform: Platform,
  options: MediaProcessingOptions = {}
): Promise<ProcessedMediaFile> => {
  const config = PLATFORM_CONFIGS[platform]
  const metadata = await extractMediaMetadata(file)
  
  let processedUrl: string | undefined
  let thumbnailUrl: string | undefined

  // Generate object URL for the original file
  processedUrl = URL.createObjectURL(file)

  // Generate thumbnail if requested
  if (options.generateThumbnail && file.type.startsWith('image/')) {
    thumbnailUrl = await generateImageThumbnail(file, options.thumbnailSize)
  }

  return {
    originalFile: file,
    processedUrl,
    thumbnailUrl,
    metadata
  }
}

/**
 * Extract metadata from media file
 */
export const extractMediaMetadata = async (file: File): Promise<ProcessedMediaFile['metadata']> => {
  const metadata: ProcessedMediaFile['metadata'] = {
    size: file.size,
    type: file.type,
    format: file.type.split('/')[1] || 'unknown'
  }

  if (file.type.startsWith('image/')) {
    const dimensions = await getImageDimensions(file)
    metadata.width = dimensions.width
    metadata.height = dimensions.height
  } else if (file.type.startsWith('video/')) {
    const videoDimensions = await getVideoDimensions(file)
    metadata.width = videoDimensions.width
    metadata.height = videoDimensions.height
    metadata.duration = videoDimensions.duration
  }

  return metadata
}

/**
 * Get image dimensions
 */
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
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

/**
 * Get video dimensions and duration
 */
const getVideoDimensions = (file: File): Promise<{ width: number; height: number; duration: number }> => {
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

/**
 * Generate thumbnail for image
 */
const generateImageThumbnail = async (
  file: File,
  size: { width: number; height: number } = { width: 150, height: 150 }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }
    
    img.onload = () => {
      // Calculate aspect ratio
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
      
      // Convert to blob URL
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob))
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

/**
 * Validate media file against platform requirements
 */
export const validateMediaForPlatform = (
  file: File,
  platform: Platform
): { isValid: boolean; errors: string[] } => {
  const config = PLATFORM_CONFIGS[platform]
  const errors: string[] = []
  
  // Check file size (assuming 50MB default limit)
  const maxSize = 50 * 1024 * 1024 // 50MB
  if (file.size > maxSize) {
    errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds ${(maxSize / 1024 / 1024)}MB limit`)
  }
  
  // Check MIME type
  if (!config.contentLimits.supportedMediaTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not supported by ${config.displayName}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Clean up object URLs to prevent memory leaks
 */
export const cleanupMediaUrls = (urls: string[]): void => {
  urls.forEach(url => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  })
}

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get supported file extensions for platform
 */
export const getSupportedExtensions = (platform: Platform): string[] => {
  const config = PLATFORM_CONFIGS[platform]
  const extensions: string[] = []
  
  config.contentLimits.supportedMediaTypes.forEach(mimeType => {
    switch (mimeType) {
      case 'image/jpeg':
        extensions.push('.jpg', '.jpeg')
        break
      case 'image/png':
        extensions.push('.png')
        break
      case 'image/gif':
        extensions.push('.gif')
        break
      case 'video/mp4':
        extensions.push('.mp4')
        break
      case 'video/quicktime':
        extensions.push('.mov')
        break
      default:
        // Extract extension from MIME type
        const ext = mimeType.split('/')[1]
        if (ext) extensions.push(`.${ext}`)
    }
  })
  
  return extensions
}