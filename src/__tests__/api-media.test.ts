import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as uploadPost, GET as uploadGet } from '@/app/api/media/upload/route'
import { GET as mediaGet, DELETE as mediaDelete } from '@/app/api/media/[id]/route'
import { POST as cleanupPost, DELETE as cleanupDelete } from '@/app/api/media/cleanup/route'

// Mock services
vi.mock('@/services/supabase-server', () => ({
  createServerSupabaseClient: () => mockSupabase
}))

vi.mock('@/services/mediaStorage', () => ({
  validateMediaFile: vi.fn(),
  uploadMediaToStorage: vi.fn(),
  createMediaRecord: vi.fn(),
  deleteMediaFile: vi.fn(),
  cleanupOrphanedFiles: vi.fn()
}))

vi.mock('@/utils/serverErrors', () => ({
  handleApiError: vi.fn((error) => Response.json({ error: error.message }, { status: 500 }))
}))

const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn(),
  storage: {
    from: vi.fn()
  }
}

const { validateMediaFile, uploadMediaToStorage, createMediaRecord, deleteMediaFile, cleanupOrphanedFiles } = await import('@/services/mediaStorage')

describe('Media API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/media/upload', () => {
    it('should upload files successfully', async () => {
      // Mock authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock validation and upload
      vi.mocked(validateMediaFile).mockResolvedValue({
        isValid: true,
        errors: []
      })

      vi.mocked(uploadMediaToStorage).mockResolvedValue({
        filename: 'test.jpg',
        path: 'user-123/test.jpg',
        publicUrl: 'https://example.com/test.jpg',
        bucket: 'media-files',
        metadata: { width: 800, height: 600 }
      })

      vi.mocked(createMediaRecord).mockResolvedValue({
        id: 'record-123',
        filename: 'test.jpg',
        original_filename: 'original.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600
      })

      // Create form data
      const formData = new FormData()
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('files', file)
      formData.append('platform', 'threads')

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData
      })

      const response = await uploadPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.uploads).toHaveLength(1)
      expect(data.uploads[0].id).toBe('record-123')
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const formData = new FormData()
      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData
      })

      const response = await uploadPost(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 for missing files', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const formData = new FormData()
      formData.append('platform', 'threads')

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData
      })

      const response = await uploadPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No files provided')
    })

    it('should handle validation errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      vi.mocked(validateMediaFile).mockResolvedValue({
        isValid: false,
        errors: ['File too large']
      })

      const formData = new FormData()
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('files', file)
      formData.append('platform', 'threads')

      const request = new NextRequest('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData
      })

      const response = await uploadPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.uploads).toHaveLength(0)
      expect(data.errors).toHaveLength(1)
      expect(data.errors[0].errors).toContain('File too large')
    })
  })

  describe('GET /api/media/upload', () => {
    it('should fetch user media files', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis()
      }

      mockQuery.range.mockResolvedValue({
        data: [
          {
            id: 'file-1',
            filename: 'test1.jpg',
            original_filename: 'original1.jpg',
            file_size: 1024,
            mime_type: 'image/jpeg'
          }
        ],
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery)
      })

      const request = new NextRequest('http://localhost/api/media/upload?limit=10&offset=0')

      const response = await uploadGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.files).toHaveLength(1)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.offset).toBe(0)
    })
  })

  describe('GET /api/media/[id]', () => {
    it('should fetch specific media file', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'file-1',
            filename: 'test.jpg',
            original_filename: 'original.jpg'
          },
          error: null
        })
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery)
      })

      const request = new NextRequest('http://localhost/api/media/file-1')

      const response = await mediaGet(request, { params: { id: 'file-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.file.id).toBe('file-1')
    })

    it('should return 404 for non-existent file', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery)
      })

      const request = new NextRequest('http://localhost/api/media/non-existent')

      const response = await mediaGet(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Media file not found')
    })
  })

  describe('DELETE /api/media/[id]', () => {
    it('should delete media file successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'file-1',
            file_path: 'user-123/test.jpg',
            storage_bucket: 'media-files'
          },
          error: null
        })
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery)
      })

      vi.mocked(deleteMediaFile).mockResolvedValue()

      const request = new NextRequest('http://localhost/api/media/file-1', {
        method: 'DELETE'
      })

      const response = await mediaDelete(request, { params: { id: 'file-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Media file deleted successfully')
      expect(deleteMediaFile).toHaveBeenCalledWith('file-1', 'user-123')
    })
  })

  describe('POST /api/media/cleanup', () => {
    it('should run cleanup successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      vi.mocked(cleanupOrphanedFiles).mockResolvedValue()

      const request = new NextRequest('http://localhost/api/media/cleanup', {
        method: 'POST'
      })

      const response = await cleanupPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Cleanup completed successfully')
      expect(cleanupOrphanedFiles).toHaveBeenCalledWith('user-123')
    })
  })

  describe('DELETE /api/media/cleanup', () => {
    it('should bulk delete old files', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis()
      }

      mockQuery.lt.mockResolvedValue({
        data: [
          {
            id: 'file-1',
            file_path: 'user-123/old1.jpg',
            thumbnail_path: 'user-123/thumb_old1.jpg',
            storage_bucket: 'media-files'
          },
          {
            id: 'file-2',
            file_path: 'user-123/old2.jpg',
            thumbnail_path: null,
            storage_bucket: 'media-files'
          }
        ],
        error: null
      })

      const mockStorage = {
        remove: vi.fn().mockResolvedValue({ error: null })
      }

      const mockDelete = {
        in: vi.fn().mockResolvedValue({ error: null })
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery),
        delete: vi.fn().mockReturnValue(mockDelete)
      })

      mockSupabase.storage.from.mockReturnValue(mockStorage)

      const request = new NextRequest('http://localhost/api/media/cleanup?olderThan=2023-01-01T00:00:00Z', {
        method: 'DELETE'
      })

      const response = await cleanupDelete(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.deletedCount).toBe(2)
      expect(mockStorage.remove).toHaveBeenCalledTimes(2) // Main files and thumbnails
      expect(mockDelete.in).toHaveBeenCalledWith('id', ['file-1', 'file-2'])
    })
  })
})