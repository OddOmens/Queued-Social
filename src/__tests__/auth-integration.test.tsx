/**
 * Authentication integration tests
 * Tests the complete authentication flow with components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignInForm } from '@/components/auth/SignInForm'
import { SignUpForm } from '@/components/auth/SignUpForm'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuthStore } from '@/stores/auth'

// Mock Next.js router
// Mock React Router navigation if needed
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Mock Supabase client
const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/services/supabase', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignIn,
      signOut: mockSignOut,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
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

describe('Authentication Integration', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Reset auth store
    useAuthStore.setState({
      user: null,
      loading: false,
      initialized: true
    })
  })

  describe('SignInForm', () => {
    it('should render sign in form', () => {
      render(<SignInForm />)
      
      expect(screen.getByText('Sign In')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should handle successful sign in', async () => {
      const mockUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z'
      }

      mockSignIn.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      render(<SignInForm />)
      
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        })
      })
    })

    it('should display error on failed sign in', async () => {
      mockSignIn.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      })

      render(<SignInForm />)
      
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Invalid email or password/)).toBeInTheDocument()
      })
    })
  })

  describe('SignUpForm', () => {
    it('should render sign up form', () => {
      render(<SignUpForm />)
      
      expect(screen.getByText('Sign Up')).toBeInTheDocument()
      expect(screen.getByLabelText('Full Name (Optional)')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
    })

    it('should validate password confirmation', async () => {
      render(<SignUpForm />)
      
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: /sign up/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      })
    })

    it('should validate password strength', async () => {
      render(<SignUpForm />)
      
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: /sign up/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'weak' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'weak' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 8 characters long/)).toBeInTheDocument()
      })
    })

    it('should handle successful sign up', async () => {
      const mockUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z'
      }

      mockSignUp.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      render(<SignUpForm />)
      
      const fullNameInput = screen.getByLabelText('Full Name (Optional)')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: /sign up/i })

      fireEvent.change(fullNameInput, { target: { value: 'Test User' } })
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPass123!' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'StrongPass123!',
          options: {
            data: {
              full_name: 'Test User'
            }
          }
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/Account created successfully/)).toBeInTheDocument()
      })
    })
  })

  describe('ProtectedRoute', () => {
    it('should render children when user is authenticated', () => {
      useAuthStore.setState({
        user: {
          id: 'test-user',
          email: 'test@example.com'
        } as any,
        loading: false,
        initialized: true
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('should show loading when not initialized', () => {
      useAuthStore.setState({
        user: null,
        loading: false,
        initialized: false
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should redirect when user is not authenticated', () => {
      useAuthStore.setState({
        user: null,
        loading: false,
        initialized: true
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(mockPush).toHaveBeenCalledWith('/auth/signin')
    })
  })
})

export {}