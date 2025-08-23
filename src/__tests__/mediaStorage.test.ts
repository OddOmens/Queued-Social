import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  validateMediaFile, 
  uploadMediaToStorage, 
  createMediaRecord, 
  deleteMediaFile,
  cleanupOrphanedFiles,
  formatFileSize,
  initializeStorageBuckets
} from '@/services/mediaStorage'
import { Platform } from '@/types'

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  storage: {
    from: vi.fn(),
    createBucket: vi.fn()
  },
  from: vi.fn()
}

vi.mock('@/services/supabase', () => ({
  createClient: () => mockSupabase
}))

vi.mock('@/services/supabase-server', () => ({
  createServerSupabaseClient: () => mockSupabase
}))

// Mock UUID
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
global.URL.revokeObjectURL = vi.fn()

// Mock Image and Video elements
global.Image = class {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  
  set src(value: string) {
    setTimeout(() => {
      if (this.onload) {
        // @ts-ignore
        this.width = 800
        // @ts-ignore
        this.height = 600
        this.onload()
      }
    }, 0)
  }
} as any

global.HTMLVideoElement = class {
  onloadedmetadata: (() => void) | null = null
  onerror: (() => void) | null = null
  
  set src(value: string) {
    setTimeout(() => {
      if (this.onloadedmetadata) {
        // @ts-ignore
        this.videoWidth = 1920
        // @ts-ignore
        this.videoHeight = 1080
        // @ts-ignore
        this.duration = 120
        this.onloadedmetadata()
      }
    }, 0)
  }
} as any

// Mock Canvas
global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn()
}))

global.HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  const blob = new Blob(['test'], { type: 'image/jpeg' })
  callback(blob)
})

describe('Media Storage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validateMediaFile', () => {
    it('should validate a valid image file', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await validateMediaFile(file, 'threads' as Platform)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty file', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      const result = await validateMediaFile(file, 'threads' as Platform)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('File is empty')
    })

    it('should reject oversized file', async () => {
      const largeContent = 'x'.repeat(51 * 1024 * 1024) // 51MB
      const file = new File([largeContent], 'test.jpg', { type: 'image/jpeg' })
      const result = await validateMediaFile(file, 'threads' as Platform)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('exceeds'))).toBe(true)
    })

    it('should reject unsupported file type', async () => {
      const file = new File(['test'], 'test.exe', { type: 'application/exe' })
      const result = await validateMediaFile(file, 'threads' as Platform)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('not allowed'))).toBe(true)
    })
  })

  describe('uploadMediaToStorage', () => {
    it('should upload file successfully', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const userId = 'user-123'

      // Mock storage upload
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: `${userId}/test-uuid-123.jpg` },
        error: null
      })
      
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/file.jpg' }
      })

      mockSupabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl
      })

      const result = await uploadMediaToStorage(file, userId)

      expect(result.filename).toBe('test-uuid-123.jpg')
      expect(result.path).toBe(`${userId}/test-uuid-123.jpg`)
      expect(result.publicUrl).toBe('https://example.com/file.jpg')
      expect(result.bucket).toBe('media-files')
      expect(mockUpload).toHaveBeenCalledWith(
        `${userId}/test-uuid-123.jpg`,
        file,
        expect.any(Object)
      )
    })

    it('should handle upload error', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const userId = 'user-123'

      const mockUpload = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' }
      })

      mockSupabase.storage.from.mockReturnValue({
        upload: mockUpload
      })

      await expect(uploadMediaToStorage(file, userId)).rejects.toThrow('Failed to upload file: Upload failed')
    })
  })

  describe('createMediaRecord', () => {
    it('should create media record successfully', async () => {
      const record = {
        userId: 'user-123',
        filename: 'test.jpg',
        originalFilename: 'original.jpg',
        filePath: 'user-123/test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        storageBucket: 'media-files',
        metadata: {}
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'record-123', ...record },
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      const result = await createMediaRecord(record)

      expect(result.id).toBe('record-123')
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: record.userId,
        filename: record.filename,
        original_filename: record.originalFilename
      }))
    })

    it('should handle database error', async () => {
      const record = {
        userId: 'user-123',
        filename: 'test.jpg',
        originalFilename: 'original.jpg',
        filePath: 'user-123/test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        storageBucket: 'media-files',
        metadata: {}
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      await expect(createMediaRecord(record)).rejects.toThrow('Failed to create media record: Database error')
    })
  })

  describe('deleteMediaFile', () => {
    it('should delete media file successfully', async () => {
      const mediaId = 'media-123'
      const userId = 'user-123'

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: mediaId,
                file_path: 'user-123/test.jpg',
                thumbnail_path: 'user-123/thumb_test.jpg',
                storage_bucket: 'media-files'
              },
              error: null
            })
          })
        })
      })

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        })
      })

      const mockRemove = vi.fn().mockResolvedValue({ error: null })

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        delete: mockDelete
      })

      mockSupabase.storage.from.mockReturnValue({
        remove: mockRemove
      })

      await deleteMediaFile(mediaId, userId)

      expect(mockRemove).toHaveBeenCalledTimes(2) // Main file and thumbnail
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('cleanupOrphanedFiles', () => {
    it('should cleanup orphaned files', async () => {
      const userId = 'user-123'

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { file_path: 'user-123/file1.jpg', thumbnail_path: null, storage_bucket: 'media-files' }
          ],
          error: null
        })
      })

      const mockList = vi.fn().mockResolvedValue({
        data: [
          { name: 'file1.jpg' },
          { name: 'orphaned.jpg' }
        ],
        error: null
      })

      const mockRemove = vi.fn().mockResolvedValue({ error: null })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      mockSupabase.storage.from.mockReturnValue({
        list: mockList,
        remove: mockRemove
      })

      await cleanupOrphanedFiles(userId)

      expect(mockRemove).toHaveBeenCalledWith(['user-123/orphaned.jpg'])
    })
  })

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })
  })

  describe('initializeStorageBuckets', () => {
    it('should create storage buckets', async () => {
      const mockCreateBucket = vi.fn().mockResolvedValue({ error: null })
      
      mockSupabase.storage.createBucket = mockCreateBucket

      await initializeStorageBuckets()

      expect(mockCreateBucket).toHaveBeenCalledTimes(2)
      expect(mockCreateBucket).toHaveBeenCalledWith('media-files', expect.any(Object))
      expect(mockCreateBucket).toHaveBeenCalledWith('thumbnails', expect.any(Object))
    })

    it('should handle existing buckets gracefully', async () => {
      const mockCreateBucket = vi.fn().mockResolvedValue({ 
        error: { message: 'Bucket already exists' } 
      })
      
      mockSupabase.storage.createBucket = mockCreateBucket

      // Should not throw
      await expect(initializeStorageBuckets()).resolves.toBeUndefined()
    })
  })
})