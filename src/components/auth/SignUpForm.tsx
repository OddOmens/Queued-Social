'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { validatePassword, validateEmail, formatAuthError } from '@/utils/auth'
import type { SignUpData } from '@/types/auth'

interface SignUpFormProps {
  redirectTo?: string
  onSuccess?: () => void
}

export function SignUpForm({ redirectTo = '/dashboard', onSuccess }: SignUpFormProps) {
  const [formData, setFormData] = useState<SignUpData>({
    email: '',
    password: '',
    fullName: ''
  })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const [emailError, setEmailError] = useState<string | null>(null)
  
  const { signUp, loading } = useAuthStore()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setPasswordErrors([])
    setEmailError(null)

    // Validate email
    if (!validateEmail(formData.email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    // Validate password strength
    const passwordValidation = validatePassword(formData.password)
    if (!passwordValidation.isValid) {
      setPasswordErrors(passwordValidation.errors)
      return
    }

    // Validate passwords match
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const { data, error: authError } = await signUp(formData)

    if (authError) {
      setError(formatAuthError(authError))
      return
    }

    if (data) {
      setSuccess('Account created successfully! Please check your email to verify your account.')
      onSuccess?.()
      
      // Redirect after a short delay to show success message
      setTimeout(() => {
        router.push(redirectTo)
      }, 2000)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'confirmPassword') {
      setConfirmPassword(value)
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign Up</h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
            Full Name (Optional)
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={formData.fullName}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              emailError ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter your email"
          />
          {emailError && (
            <p className="text-xs text-red-600 mt-1">{emailError}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              passwordErrors.length > 0 ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter your password"
            minLength={8}
          />
          {passwordErrors.length > 0 ? (
            <div className="mt-1">
              {passwordErrors.map((error, index) => (
                <p key={index} className="text-xs text-red-600">{error}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Password must contain uppercase, lowercase, number, and special character
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Confirm your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        <div className="text-center">
          <span className="text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/auth/signin" className="text-blue-600 hover:text-blue-500">
              Sign in
            </a>
          </span>
        </div>
      </form>
    </div>
  )
}