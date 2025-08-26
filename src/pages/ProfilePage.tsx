import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export function ProfilePage() {
  const { user, updateProfile, loading } = useAuthStore()
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const result = await updateProfile({ fullName })
    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          to="/settings"
          className="text-blue-600 hover:text-blue-500"
        >
          ← Back to Settings
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
        <p className="mt-2 text-gray-400">
          Update your personal information and preferences.
        </p>
      </div>

      <div className="card">
        <div className="px-6 py-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                Profile updated successfully!
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={user?.email || ''}
                disabled
                className="input-dark w-full px-4 py-3 bg-gray-800 text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-sm text-gray-500">
                Email cannot be changed. Contact support if you need to update your email.
              </p>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-dark w-full px-4 py-3"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}