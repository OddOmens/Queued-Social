import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaUpload } from '@/hooks/useMediaUpload'
import { Platform } from '@/types'

// Mock fetch
global.fetch = vi.fn()

describe('useMediaUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMediaUpload())

    expect(result.current.state).toEqual({
      uploading: false,
      uploadProgress: 0,
      error: null,
      uploadedFiles: []
    })
  })

  it('should upload files successfully', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        uploads: [
          {
            id: 'file-1',
            filename: 'test.jpg',
            originalFilename: 'original.jpg',
            url: 'https://example.com/test.jpg',
            fileSize: 1024,
            mimeType: 'image/jpeg'
          }
        ]
      })
    }

    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const { result } = renderHook(() => useMediaUpload())
    const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })]

    let uploadedFiles: any[] = []
    await act(async () => {
      uploadedFiles = await result.current.uploadFiles(files, 'threads' as Platform)
    })

    expect(result.current.state.uploading).toBe(false)
    expect(result.current.state.uploadProgress).toBe(100)
    expect(result.current.state.error).toBe(null)
    expect(result.current.state.uploadedFiles).toHaveLength(1)
    expect(uploadedFiles).toHaveLength(1)
    expect(uploadedFiles[0].id).toBe('file-1')
  })

  it('should handle upload errors', async () => {
    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: 'Upload failed'
      })
    }

    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const { result } = renderHook(() => useMediaUpload())
    const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })]

    await act(async () => {
      try {
        await result.current.uploadFiles(files, 'threads' as Platform)
      } catch (error) {
        // Expected to throw
      }
    })

    expect(result.current.state.uploading).toBe(false)
    expect(result.current.state.uploadProgress).toBe(0)
    expect(result.current.state.error).toBe('Upload failed')
    expect(result.current.state.uploadedFiles).toHaveLength(0)
  })

  it('should handle partial upload failures', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        uploads: [
          {
            id: 'file-1',
            filename: 'test.jpg',
            originalFilename: 'original.jpg',
            url: 'https://example.com/test.jpg',
            fileSize: 1024,
            mimeType: 'image/jpeg'
          }
        ],
        errors: [
          {
            filename: 'failed.jpg',
            errors: ['File too large']
          }
        ]
      })
    }

    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const { result } = renderHook(() => useMediaUpload())
    const files = [
      new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
      new File(['large'], 'failed.jpg', { type: 'image/jpeg' })
    ]

    await act(async () => {
      await result.current.uploadFiles(files, 'threads' as Platform)
    })

    expect(result.current.state.uploading).toBe(false)
    expect(result.current.state.uploadedFiles).toHaveLength(1)
    expect(result.current.state.error).toContain('Some files failed to upload: failed.jpg')
  })

  it('should delete files successfully', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        message: 'File deleted'
      })
    }

    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const { result } = renderHook(() => useMediaUpload())

    // Set initial state with uploaded files
    act(() => {
      result.current.state.uploadedFiles = [
        {
          id: 'file-1',
          filename: 'test.jpg',
          originalFilename: 'original.jpg',
          url: 'https://example.com/test.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg'
        }
      ]
    })

    await act(async () => {
      await result.current.deleteFile('file-1')
    })

    expect(result.current.state.uploadedFiles).toHaveLength(0)
    expect(fetch).toHaveBeenCalledWith('/api/media/file-1', {
      method: 'DELETE'
    })
  })

  it('should handle delete errors', async () => {
    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: 'Delete failed'
      })
    }

    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const { result } = renderHook(() => useMediaUpload())

    await act(async () => {
      try {
        await result.current.deleteFile('file-1')
      } catch (error) {
        // Expected to throw
      }
    })

    expect(result.current.state.error).toBe('Delete failed')
  })

  it('should clear errors', () => {
    const { result } = renderHook(() => useMediaUpload())

    // Set error state
    act(() => {
      result.current.state.error = 'Test error'
    })

    act(() => {
      result.current.clearError()
    })

    expect(result.current.state.error).toBe(null)
  })

  it('should reset state', () => {
    const { result } = renderHook(() => useMediaUpload())

    // Set some state
    act(() => {
      result.current.state.uploading = true
      result.current.state.uploadProgress = 50
      result.current.state.error = 'Test error'
      result.current.state.uploadedFiles = [
        {
          id: 'file-1',
          filename: 'test.jpg',
          originalFilename: 'original.jpg',
          url: 'https://example.com/test.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg'
        }
      ]
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toEqual({
      uploading: false,
      uploadProgress: 0,
      error: null,
      uploadedFiles: []
    })
  })
})