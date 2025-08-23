/**
 * Comprehensive authentication tests
 * Note: These are unit tests for the auth store logic and utilities
 * Integration tests would require a test Supabase instance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { 
  hasRole, 
  isAdmin, 
  getUserDisplayName, 
  getUserInitials, 
  isEmailVerified,
  validatePassword,
  validateEmail,
  formatAuthError
} from '@/utils/auth'
import type { AuthUser } from '@/types/auth'

// Mock Supabase client
vi.mock('@/services/supabase', () => ({
  createClient: () => ({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  })
}))

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      loading: false,
      initialized: false
    })
  })

  it('should initialize with default state', () => {
    const state = useAuthStore.getState()
    
    expect(state.user).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.initialized).toBe(false)
  })

  it('should have all required actions', () => {
    const state = useAuthStore.getState()
    
    expect(typeof state.signUp).toBe('function')
    expect(typeof state.signIn).toBe('function')
    expect(typeof state.signOut).toBe('function')
    expect(typeof state.resetPassword).toBe('function')
    expect(typeof state.updatePassword).toBe('function')
    expect(typeof state.updateProfile).toBe('function')
    expect(typeof state.refreshSession).toBe('function')
    expect(typeof state.setUser).toBe('function')
    expect(typeof state.setLoading).toBe('function')
    expect(typeof state.setInitialized).toBe('function')
    expect(typeof state.initialize).toBe('function')
  })

  it('should update user state', () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      user_metadata: {
        full_name: 'Test User'
      }
    }

    useAuthStore.getState().setUser(mockUser as any)
    
    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
  })

  it('should update loading state', () => {
    useAuthStore.getState().setLoading(true)
    
    let state = useAuthStore.getState()
    expect(state.loading).toBe(true)

    useAuthStore.getState().setLoading(false)
    
    state = useAuthStore.getState()
    expect(state.loading).toBe(false)
  })

  it('should update initialized state', () => {
    useAuthStore.getState().setInitialized(true)
    
    const state = useAuthStore.getState()
    expect(state.initialized).toBe(true)
  })
})

describe('Auth Utilities', () => {
  const mockUser: AuthUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    email_confirmed_at: '2023-01-01T00:00:00Z',
    user_metadata: {
      full_name: 'Test User',
      roles: ['user', 'admin']
    }
  } as any

  const mockUserWithoutRoles: AuthUser = {
    id: 'test-user-id-2',
    email: 'test2@example.com',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    user_metadata: {
      full_name: 'Test User 2'
    }
  } as any

  describe('hasRole', () => {
    it('should return true if user has the role', () => {
      expect(hasRole(mockUser, 'admin')).toBe(true)
      expect(hasRole(mockUser, 'user')).toBe(true)
    })

    it('should return false if user does not have the role', () => {
      expect(hasRole(mockUser, 'superadmin')).toBe(false)
      expect(hasRole(mockUserWithoutRoles, 'admin')).toBe(false)
    })

    it('should return false for null user', () => {
      expect(hasRole(null, 'admin')).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should return true if user is admin', () => {
      expect(isAdmin(mockUser)).toBe(true)
    })

    it('should return false if user is not admin', () => {
      expect(isAdmin(mockUserWithoutRoles)).toBe(false)
      expect(isAdmin(null)).toBe(false)
    })
  })

  describe('getUserDisplayName', () => {
    it('should return full name if available', () => {
      expect(getUserDisplayName(mockUser)).toBe('Test User')
    })

    it('should return email if no full name', () => {
      const userWithoutName = { ...mockUser, user_metadata: {} }
      expect(getUserDisplayName(userWithoutName as any)).toBe('test@example.com')
    })

    it('should return "Guest" for null user', () => {
      expect(getUserDisplayName(null)).toBe('Guest')
    })
  })

  describe('getUserInitials', () => {
    it('should return initials from full name', () => {
      expect(getUserInitials(mockUser)).toBe('TU')
    })

    it('should return first letter of email if no full name', () => {
      const userWithoutName = { ...mockUser, user_metadata: {} }
      expect(getUserInitials(userWithoutName as any)).toBe('T')
    })

    it('should return "G" for null user', () => {
      expect(getUserInitials(null)).toBe('G')
    })
  })

  describe('isEmailVerified', () => {
    it('should return true if email is verified', () => {
      expect(isEmailVerified(mockUser)).toBe(true)
    })

    it('should return false if email is not verified', () => {
      const unverifiedUser = { ...mockUser, email_confirmed_at: null }
      expect(isEmailVerified(unverifiedUser as any)).toBe(false)
    })

    it('should return false for null user', () => {
      expect(isEmailVerified(null)).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = validatePassword('StrongPass123!')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject weak passwords', () => {
      const result = validatePassword('weak')
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should require minimum length', () => {
      const result = validatePassword('Short1!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters long')
    })

    it('should require uppercase letter', () => {
      const result = validatePassword('lowercase123!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should require lowercase letter', () => {
      const result = validatePassword('UPPERCASE123!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should require number', () => {
      const result = validatePassword('NoNumbers!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should require special character', () => {
      const result = validatePassword('NoSpecial123')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character')
    })
  })

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('test@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('test.example.com')).toBe(false)
    })
  })

  describe('formatAuthError', () => {
    it('should format known error messages', () => {
      const error = { message: 'Invalid login credentials' }
      const formatted = formatAuthError(error)
      expect(formatted).toBe('Invalid email or password. Please check your credentials and try again.')
    })

    it('should return original message for unknown errors', () => {
      const error = { message: 'Unknown error' }
      const formatted = formatAuthError(error)
      expect(formatted).toBe('Unknown error')
    })

    it('should handle null/undefined errors', () => {
      expect(formatAuthError(null)).toBe('An unknown error occurred')
      expect(formatAuthError(undefined)).toBe('An unknown error occurred')
    })
  })
})

export {}