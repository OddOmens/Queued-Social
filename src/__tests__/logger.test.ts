import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger, withPerformanceLogging } from '@/utils/logger'

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  global.console = mockConsole as any
})

describe('Logger', () => {
  it('should log debug messages in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    logger.debug('Test debug message', { key: 'value' })

    expect(mockConsole.debug).toHaveBeenCalled()

    process.env.NODE_ENV = originalEnv
  })

  it('should not log debug messages in production', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    logger.debug('Test debug message')

    expect(mockConsole.debug).not.toHaveBeenCalled()

    process.env.NODE_ENV = originalEnv
  })

  it('should log info messages', () => {
    logger.info('Test info message', { key: 'value' })

    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Test info message')
    )
  })

  it('should log warning messages', () => {
    logger.warn('Test warning message', { key: 'value' })

    expect(mockConsole.warn).toHaveBeenCalledWith(
      expect.stringContaining('Test warning message')
    )
  })

  it('should log error messages', () => {
    logger.error('Test error message', { key: 'value' })

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('Test error message')
    )
  })

  it('should format messages differently in development vs production', () => {
    const originalEnv = process.env.NODE_ENV

    // Test development format
    process.env.NODE_ENV = 'development'
    logger.info('Dev message', { key: 'value' })
    
    expect(mockConsole.info).toHaveBeenCalled()
    const devCall = mockConsole.info.mock.calls[0][0]
    expect(typeof devCall).toBe('string')

    mockConsole.info.mockClear()

    // Test production format
    process.env.NODE_ENV = 'production'
    logger.info('Prod message', { key: 'value' })
    
    expect(mockConsole.info).toHaveBeenCalled()
    const prodCall = mockConsole.info.mock.calls[0][0]
    expect(() => JSON.parse(prodCall)).not.toThrow()
    
    const parsed = JSON.parse(prodCall)
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('Prod message')
    expect(parsed.data.key).toBe('value')

    process.env.NODE_ENV = originalEnv
  })

  it('should log API requests', () => {
    logger.logApiRequest('GET', '/api/posts', 'req-123', 'user-456')

    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('API Request')
    )
  })

  it('should log API responses', () => {
    logger.logApiResponse(200, 'req-123', 150)

    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('API Response')
    )
  })

  it('should log database operations', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    logger.logDatabaseOperation('SELECT', 'posts', 50)

    expect(mockConsole.debug).toHaveBeenCalled()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should log database errors', () => {
    const error = new Error('Connection failed')
    logger.logDatabaseOperation('SELECT', 'posts', 50, error)

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('Database Operation Failed')
    )
  })

  it('should log external API calls', () => {
    logger.logExternalApiCall('threads', '/api/posts', 200, 300)

    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('External API Call')
    )
  })

  it('should log external API errors', () => {
    const error = new Error('API timeout')
    logger.logExternalApiCall('threads', '/api/posts', 500, 5000, error)

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('External API Call Failed')
    )
  })

  it('should log authentication events', () => {
    logger.logAuthEvent('login', 'user-123', { method: 'oauth' })

    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Authentication Event')
    )
  })

  it('should log business events', () => {
    logger.logBusinessEvent('post_scheduled', { postId: 'post-123' })

    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Business Event')
    )
  })
})

describe('withPerformanceLogging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log successful operations', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const mockFn = vi.fn().mockResolvedValue('success')

    const result = await withPerformanceLogging('test-operation', mockFn)

    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalled()
    expect(mockConsole.debug).toHaveBeenCalled()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should log failed operations', async () => {
    const error = new Error('Operation failed')
    const mockFn = vi.fn().mockRejectedValue(error)

    await expect(
      withPerformanceLogging('test-operation', mockFn)
    ).rejects.toThrow('Operation failed')

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('Performance')
    )
  })

  it('should work with synchronous functions', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const mockFn = vi.fn().mockReturnValue('sync-result')

    const result = await withPerformanceLogging('sync-operation', mockFn)

    expect(result).toBe('sync-result')
    expect(mockConsole.debug).toHaveBeenCalled()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should measure execution time', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const mockFn = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('delayed'), 10))
    )

    await withPerformanceLogging('delayed-operation', mockFn)

    expect(mockConsole.debug).toHaveBeenCalled()
    
    process.env.NODE_ENV = originalEnv
  })
})