'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { AuthGuard } from '@/components/auth/ProtectedRoute'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const { resetPassword, loading } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const { error: authError } = await resetPassword({ email })

    if (authError) {
      setError(authError.message)
      return
    }

    setSuccess('Password reset email sent! Please check your inbox.')
  }

  return (
    <AuthGuard requireAuth={false}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
              <p className="text-sm text-gray-600 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Email'}
            </button>

            <div className="text-center">
              <a
                href="/auth/signin"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to Sign In
              </a>
            </div>
          </form>
        </div>
      </div>
    </AuthGuard>
  )
}