import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Add Jest compatibility for existing tests
Object.assign(global, {
  jest: {
    fn: vi.fn,
    mock: vi.mock,
    clearAllMocks: vi.clearAllMocks,
    resetAllMocks: vi.resetAllMocks,
    restoreAllMocks: vi.restoreAllMocks,
    requireActual: vi.importActual,
  }
})

// Mock environment variables for tests
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-key',
    VITE_APP_URL: 'http://localhost:3000',
  },
  writable: true,
})