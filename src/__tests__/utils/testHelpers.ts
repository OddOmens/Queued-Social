import { vi } from 'vitest'
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement, ReactNode } from 'react'

// Mock providers for testing
export const createMockAuthProvider = (user: any = null) => {
  return ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-auth-provider">
      {children}
    </div>
  )
}

export const createMockErrorProvider = () => {
  return ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-error-provider">
      {children}
    </div>
  )
}

// Custom render function with providers
export const renderWithProviders = (
  ui: ReactElement,
  options: RenderOptions & { user?: any } = {}
) => {
  const { user, ...renderOptions } = options

  const Wrapper = ({ children }: { children: ReactNode }) => {
    const AuthProvider = createMockAuthProvider(user)
    const ErrorProvider = createMockErrorProvider()

    return (
      <ErrorProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ErrorProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock API responses
export const mockApiResponse = (data: any, status: number = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

export const mockApiError = (message: string, status: number = 500) => {
  return Promise.reject({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(JSON.stringify({ error: message })),
  })
}

// Mock fetch globally
export const mockFetch = (responses: Array<{ data?: any; error?: string; status?: number }>) => {
  let callCount = 0

  global.fetch = vi.fn().mockImplementation(() => {
    const response = responses[callCount] || responses[responses.length - 1]
    callCount++

    if (response.error) {
      return mockApiError(response.error, response.status)
    }

    return mockApiResponse(response.data, response.status)
  })

  return global.fetch
}

// Mock Supabase client
export const mockSupabaseClient = () => {
  const mockClient = {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
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
        upload: vi.fn(),
        download: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  }

  return mockClient
}

// Mock Next.js router
export const mockNextRouter = () => {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }
}

// Mock window methods
export const mockWindowMethods = () => {
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
    writable: true,
  })

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  })

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  })
}

// Wait for async operations
export const waitForAsync = (ms: number = 0) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Create mock file for testing
export const createMockFile = (
  name: string = 'test.jpg',
  type: string = 'image/jpeg',
  size: number = 1024
) => {
  const file = new File(['test content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// Mock date for consistent testing
export const mockDate = (dateString: string) => {
  const mockDate = new Date(dateString)
  vi.spyOn(global, 'Date').mockImplementation(() => mockDate)
  return mockDate
}

// Cleanup function for tests
export const cleanup = () => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
}

// Performance testing helpers
export const measurePerformance = async (fn: () => Promise<any>) => {
  const start = performance.now()
  await fn()
  const end = performance.now()
  return end - start
}

// Memory usage testing
export const measureMemoryUsage = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage()
  }
  return null
}