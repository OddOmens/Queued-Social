'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { formatAuthError } from '@/utils/auth'
import type { SignInData } from '@/types/auth'

interface SignInFormProps {
  redirectTo?: string
  onSuccess?: () => void
}

export function SignInForm({ redirectTo = '/dashboard', onSuccess }: SignInFormProps) {
  const [formData, setFormData] = useState<SignInData>({
    email: '',
    password: ''
  })
  const [error, setError] = useState<string | null>(null)
  
  const { signIn, loading } = useAuthStore()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const { data, error: authError } = await signIn(formData)

    if (authError) {
      setError(formatAuthError(authError))
      return
    }

    if (data) {
      onSuccess?.()
      router.push(redirectTo)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

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
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email"
          />
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="text-center">
          <a
            href="/auth/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Forgot your password?
          </a>
        </div>

        <div className="text-center">
          <span className="text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/auth/signup" className="text-blue-600 hover:text-blue-500">
              Sign up
            </a>
          </span>
        </div>
      </form>
    </div>
  )
}