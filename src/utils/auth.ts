import { createClient } from '@/services/supabase'
import type { AuthUser } from '@/types/auth'

/**
 * Utility functions for authentication
 */

/**
 * Check if a user has a specific role or permission
 */
export function hasRole(user: AuthUser | null, role: string): boolean {
  if (!user) return false
  const roles = (user.user_metadata as any)?.roles
  return Array.isArray(roles) && roles.includes(role)
}

/**
 * Check if a user is an admin
 */
export function isAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'admin')
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: AuthUser | null): string {
  if (!user) return 'Guest'
  return user.user_metadata?.full_name || user.email || 'User'
}

/**
 * Get user initials for avatar
 */
export function getUserInitials(user: AuthUser | null): string {
  if (!user) return 'G'
  
  const name = user.user_metadata?.full_name || user.email || 'User'
  const parts = name.split(' ')
  
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  
  return name.charAt(0).toUpperCase()
}

/**
 * Check if user email is verified
 */
export function isEmailVerified(user: AuthUser | null): boolean {
  if (!user) return false
  return !!user.email_confirmed_at
}

/**
 * Get time until session expires (in minutes)
 */
export function getSessionTimeRemaining(): Promise<number | null> {
  return new Promise(async (resolve) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session || !session.expires_at) {
        resolve(null)
        return
      }
      
      const expiresAt = session.expires_at * 1000 // Convert to milliseconds
      const now = Date.now()
      const timeRemaining = Math.max(0, expiresAt - now)
      
      resolve(Math.floor(timeRemaining / (1000 * 60))) // Convert to minutes
    } catch (error) {
      console.error('Error getting session time remaining:', error)
      resolve(null)
    }
  })
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  const allChars = uppercase + lowercase + numbers + symbols
  let password = ''
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * Format auth error messages for user display
 */
export function formatAuthError(error: any): string {
  if (!error) return 'An unknown error occurred'
  
  const message = error.message || error.error_description || 'An authentication error occurred'
  
  // Map common Supabase auth errors to user-friendly messages
  const errorMappings: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
    'Email not confirmed': 'Please check your email and click the confirmation link before signing in.',
    'User already registered': 'An account with this email already exists. Please sign in instead.',
    'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
    'Signup requires a valid password': 'Please enter a valid password.',
    'Invalid email': 'Please enter a valid email address.',
    'Email rate limit exceeded': 'Too many emails sent. Please wait before requesting another.',
    'Token has expired or is invalid': 'This link has expired. Please request a new password reset.',
  }
  
  return errorMappings[message] || message
}