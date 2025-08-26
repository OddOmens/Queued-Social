'use client'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, signOut, loading } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (!error) {
      navigate('/login')
    }
  }

  if (!user) {
    return null
  }

  const displayName = user.user_metadata?.full_name || user.email || 'User'

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2 transition-colors"
      >
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="hidden md:block text-sm font-medium">
          {displayName}
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-gray-900 rounded-xl shadow-xl border border-gray-800 z-20 overflow-hidden">
            <div className="py-2">
              <div className="px-4 py-3 text-sm text-gray-400 border-b border-gray-800 bg-gray-800/50">
                {user.email}
              </div>
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate('/profile')
                }}
                className="block w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Profile Settings
              </button>
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate('/settings')
                }}
                className="block w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                App Settings
              </button>
              
              <div className="border-t border-gray-800 mt-2">
                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="block w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}