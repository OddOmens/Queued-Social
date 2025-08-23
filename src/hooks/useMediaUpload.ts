import { useState, useCallback } from 'react'
import { Platform } from '@/types'

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

interface MediaUploadState {
  uploading: boolean
  uploadProgress: number
  error: string | null
  uploadedFiles: UploadedMediaFile[]
}

interface UseMediaUploadReturn {
  state: MediaUploadState
  uploadFiles: (files: File[], platform: Platform) => Promise<UploadedMediaFile[]>
  deleteFile: (fileId: string) => Promise<void>
  clearError: () => void
  reset: () => void
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [state, setState] = useState<MediaUploadState>({
    uploading: false,
    uploadProgress: 0,
    error: null,
    uploadedFiles: []
  })

  const uploadFiles = useCallback(async (files: File[], platform: Platform): Promise<UploadedMediaFile[]> => {
    setState(prev => ({
      ...prev,
      uploading: true,
      uploadProgress: 0,
      error: null
    }))

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })
      formData.append('platform', platform)

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error('Upload failed')
      }

      const uploadedFiles = result.uploads || []
      
      setState(prev => ({
        ...prev,
        uploading: false,
        uploadProgress: 100,
        uploadedFiles: [...prev.uploadedFiles, ...uploadedFiles],
        error: result.errors && result.errors.length > 0 
          ? `Some files failed to upload: ${result.errors.map((e: any) => e.filename).join(', ')}`
          : null
      }))

      return uploadedFiles
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setState(prev => ({
        ...prev,
        uploading: false,
        uploadProgress: 0,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/media/${fileId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Delete failed')
      }

      setState(prev => ({
        ...prev,
        uploadedFiles: prev.uploadedFiles.filter(file => file.id !== fileId)
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }))
  }, [])

  const reset = useCallback(() => {
    setState({
      uploading: false,
      uploadProgress: 0,
      error: null,
      uploadedFiles: []
    })
  }, [])

  return {
    state,
    uploadFiles,
    deleteFile,
    clearError,
    reset
  }
}