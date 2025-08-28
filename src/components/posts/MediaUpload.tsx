'use client'

import { useState, useRef, useCallback } from 'react'
import { Platform } from '@/types'
import { validateMediaForPlatform, formatFileSize, getSupportedExtensions, processMediaFile, cleanupMediaUrls } from '@/utils/mediaProcessing'
import { uploadMediaToStorage, createMediaRecord } from '@/services/mediaStorage'
import { useAuth } from '@/hooks/useAuth'

interface MediaUploadProps {
  files: File[]
  onChange: (files: File[]) => void
  onUpload?: (uploadedFiles: UploadedMediaFile[]) => void
  platform: Platform
  maxFiles?: number
  required?: boolean
  disabled?: boolean
  className?: string
  autoUpload?: boolean
}

interface MediaPreview {
  file: File
  url: string
  thumbnailUrl?: string
  error?: string
  uploading?: boolean
  uploaded?: boolean
  uploadedFile?: UploadedMediaFile
}

interface UploadedMediaFile {
  id: string
  filename: string
  originalFilename: string
  url: string
  thumbnailUrl?: string
  fileSize: number
  mimeType: string
  width?: number
  height?: number
  duration?: number
}

export function MediaUpload({
  files,
  onChange,
  onUpload,
  platform,
  maxFiles = 10,
  required = false,
  disabled = false,
  className = '',
  autoUpload = false
}: MediaUploadProps) {
  const [previews, setPreviews] = useState<MediaPreview[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supportedExtensions = getSupportedExtensions(platform)
  const acceptedTypes = supportedExtensions.join(',')

  const { user } = useAuth()

  // Upload files to Supabase storage
  const uploadFiles = useCallback(async (filesToUpload: File[]): Promise<{ success: boolean; uploads: any[] }> => {
    if (!user) {
      throw new Error('User must be authenticated to upload files')
    }

    const uploads: UploadedMediaFile[] = []
    
    for (const file of filesToUpload) {
      try {
        // Upload to Supabase storage
        const uploadResult = await uploadMediaToStorage(file, user.id)
        
        // Create database record
        const mediaRecord = await createMediaRecord({
          userId: user.id,
          filename: uploadResult.filename,
          originalFilename: file.name,
          filePath: uploadResult.path,
          fileSize: file.size,
          mimeType: file.type,
          width: uploadResult.metadata?.width,
          height: uploadResult.metadata?.height,
          duration: uploadResult.metadata?.duration,
          thumbnailPath: uploadResult.thumbnailPath,
          storageBucket: uploadResult.bucket,
          metadata: uploadResult.metadata || {}
        })
        
        uploads.push({
          id: mediaRecord.id,
          filename: uploadResult.filename,
          originalFilename: file.name,
          url: uploadResult.publicUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          fileSize: file.size,
          mimeType: file.type,
          width: uploadResult.metadata?.width,
          height: uploadResult.metadata?.height,
          duration: uploadResult.metadata?.duration
        })
        
      } catch (error) {
        console.error('Failed to upload file:', file.name, error)
        throw error
      }
    }

    return {
      success: true,
      uploads
    }
  }, [user])

  // Process files and create previews
  const processFiles = useCallback(async (newFiles: File[]) => {
    setUploading(true)
    const processedPreviews: MediaPreview[] = []

    for (const file of newFiles) {
      const validation = validateMediaForPlatform(file, platform)
      
      if (!validation.isValid) {
        processedPreviews.push({
          file,
          url: '',
          error: validation.errors[0]
        })
        continue
      }

      try {
        const processed = await processMediaFile(file, platform, {
          generateThumbnail: true,
          thumbnailSize: { width: 150, height: 150 }
        })

        const preview: MediaPreview = {
          file,
          url: processed.processedUrl || '',
          thumbnailUrl: processed.thumbnailUrl,
          uploading: autoUpload
        }

        processedPreviews.push(preview)

        // Auto-upload if enabled
        if (autoUpload) {
          try {
            const uploadResult = await uploadFiles([file])
            if (uploadResult.success && uploadResult.uploads.length > 0) {
              const uploadedFile = uploadResult.uploads[0]
              preview.uploading = false
              preview.uploaded = true
              preview.uploadedFile = uploadedFile
              preview.url = uploadedFile.url
              preview.thumbnailUrl = uploadedFile.thumbnailUrl || preview.thumbnailUrl
              
              // Notify parent component
              if (onUpload) {
                onUpload([uploadedFile])
              }
            }
          } catch (error) {
            preview.uploading = false
            preview.error = 'Upload failed'
          }
        }
      } catch (error) {
        processedPreviews.push({
          file,
          url: '',
          error: 'Failed to process file'
        })
      }
    }

    setPreviews(prev => {
      // Clean up old URLs
      const oldUrls = prev.flatMap(p => [p.url, p.thumbnailUrl].filter(Boolean) as string[])
      cleanupMediaUrls(oldUrls)
      
      return [...prev, ...processedPreviews]
    })

    // Update files list (only valid files)
    const allValidFiles = [...files, ...processedPreviews
      .filter(p => !p.error)
      .map(p => p.file)]
    
    onChange(allValidFiles)
    setUploading(false)
  }, [platform, onChange, onUpload, autoUpload, uploadFiles, files])

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || disabled) return

    const newFiles = Array.from(selectedFiles)
    const totalFiles = files.length + newFiles.length

    if (totalFiles > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files`)
      return
    }

    processFiles(newFiles)
  }

  const uploadManually = async (index: number) => {
    const preview = previews[index]
    if (!preview || preview.uploaded || preview.uploading) return

    const updatedPreviews = [...previews]
    updatedPreviews[index] = { ...preview, uploading: true }
    setPreviews(updatedPreviews)

    try {
      const uploadResult = await uploadFiles([preview.file])
      if (uploadResult.success && uploadResult.uploads.length > 0) {
        const uploadedFile = uploadResult.uploads[0]
        updatedPreviews[index] = {
          ...preview,
          uploading: false,
          uploaded: true,
          uploadedFile,
          url: uploadedFile.url,
          thumbnailUrl: uploadedFile.thumbnailUrl || preview.thumbnailUrl
        }
        
        // Notify parent component
        if (onUpload) {
          onUpload([uploadedFile])
        }
      }
    } catch (error) {
      updatedPreviews[index] = {
        ...preview,
        uploading: false,
        error: 'Upload failed'
      }
    }

    setPreviews(updatedPreviews)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled) return

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelect(droppedFiles)
    }
  }, [disabled, handleFileSelect])

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    
    // Clean up removed preview URLs
    const removedPreview = previews[index]
    if (removedPreview) {
      cleanupMediaUrls([removedPreview.url, removedPreview.thumbnailUrl].filter(Boolean) as string[])
    }
    
    setPreviews(newPreviews)
    onChange(newFiles)
  }

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Media Files
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : disabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-gray-600">Processing files...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg
              className="w-12 h-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-gray-600 mb-2">
              {dragActive
                ? 'Drop files here'
                : 'Drag and drop files here, or click to select'}
            </p>
            <button
              type="button"
              onClick={openFileDialog}
              disabled={disabled}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Choose Files
            </button>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-4 text-xs text-gray-500">
            {files.length} / {maxFiles} files selected
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="mt-2 text-xs text-gray-500">
        <p>Supported formats: {supportedExtensions.join(', ')}</p>
        <p>Maximum {maxFiles} files, up to 50MB each</p>
      </div>

      {/* File Previews */}
      {previews.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Files</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  {preview.error ? (
                    <div className="flex items-center justify-center h-full p-2">
                      <div className="text-center">
                        <svg className="w-8 h-8 text-red-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-red-600">{preview.error}</p>
                      </div>
                    </div>
                  ) : preview.file.type.startsWith('image/') ? (
                    <img
                      src={preview.thumbnailUrl || preview.url}
                      alt={preview.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs text-gray-600">Video</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* File Info Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-end">
                  <div className="w-full p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs truncate">{preview.file.name}</p>
                    <p className="text-xs">{formatFileSize(preview.file.size)}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="absolute -top-2 -right-2 flex gap-1">
                  {!autoUpload && !preview.uploaded && !preview.uploading && !preview.error && (
                    <button
                      type="button"
                      onClick={() => uploadManually(index)}
                      disabled={disabled}
                      className="w-6 h-6 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Upload file"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={disabled}
                    className="w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove file"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Upload Status Indicators */}
                {preview.uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
                
                {preview.uploaded && (
                  <div className="absolute top-1 left-1">
                    <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}