import { vi } from 'vitest'

// Test configuration constants
export const TEST_CONFIG = {
  // Performance thresholds
  PERFORMANCE_THRESHOLDS: {
    DATABASE_QUERY: 100, // ms
    API_RESPONSE: 200, // ms
    COMPONENT_RENDER: 50, // ms
    MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
  },

  // Test data limits
  DATA_LIMITS: {
    LARGE_DATASET_SIZE: 1000,
    BATCH_SIZE: 100,
    CONCURRENT_REQUESTS: 5,
  },

  // Mock API endpoints
  API_ENDPOINTS: {
    POSTS: '/api/posts',
    TIME_SLOTS: '/api/time-slots',
    SCHEDULE_NEXT: '/api/schedule/next-slot',
    SCHEDULE_CUSTOM: '/api/schedule/custom',
    MEDIA_UPLOAD: '/api/media/upload',
    AUTH_ME: '/api/auth/me',
    PLATFORMS: '/api/platforms',
  },

  // Test user data
  TEST_USERS: {
    DEFAULT: {
      id: 'test-user-123',
      email: 'test@example.com',
      timezone: 'UTC',
    },
    ADMIN: {
      id: 'admin-user-123',
      email: 'admin@example.com',
      timezone: 'UTC',
    },
  },

  // Platform configurations
  PLATFORMS: {
    THREADS: {
      name: 'threads',
      maxTextLength: 500,
      maxMediaFiles: 10,
      maxThreadLength: 20,
    },
    TWITTER: {
      name: 'twitter',
      maxTextLength: 280,
      maxMediaFiles: 4,
      maxThreadLength: 25,
    },
  },
}

// Global test setup
export const setupTestEnvironment = () => {
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  // Mock performance.now for consistent timing
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())

  // Mock crypto for UUID generation
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: vi.fn(() => 'mock-uuid-123'),
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256)
        }
        return arr
      }),
    },
  })
}

// Cleanup test environment
export const cleanupTestEnvironment = () => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
}

// Test database setup
export const setupTestDatabase = () => {
  // Mock Supabase client for consistent testing
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: TEST_CONFIG.TEST_USERS.DEFAULT },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: TEST_CONFIG.TEST_USERS.DEFAULT, session: {} },
        error: null,
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: TEST_CONFIG.TEST_USERS.DEFAULT, session: {} },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'test-path' },
          error: null,
        }),
        download: vi.fn().mockResolvedValue({
          data: new Blob(['test']),
          error: null,
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/test.jpg' },
        }),
      })),
    },
  }

  return mockSupabase
}

// Performance testing utilities
export const createPerformanceTest = (
  name: string,
  threshold: number,
  testFn: () => Promise<void>
) => {
  return async () => {
    const start = performance.now()
    await testFn()
    const end = performance.now()
    const duration = end - start

    if (duration > threshold) {
      throw new Error(
        `Performance test "${name}" exceeded threshold: ${duration}ms > ${threshold}ms`
      )
    }
  }
}

// Memory testing utilities
export const createMemoryTest = (
  name: string,
  maxMemoryIncrease: number,
  testFn: () => Promise<void>
) => {
  return async () => {
    const initialMemory = process.memoryUsage().heapUsed
    
    await testFn()
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory

    if (memoryIncrease > maxMemoryIncrease) {
      throw new Error(
        `Memory test "${name}" exceeded threshold: ${memoryIncrease} bytes > ${maxMemoryIncrease} bytes`
      )
    }
  }
}