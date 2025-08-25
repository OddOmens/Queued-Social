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
        className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1"
      >
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="hidden md:block text-sm font-medium">
          {displayName}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
                {user.email}
              </div>
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate('/profile')
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Profile Settings
              </button>
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate('/settings')
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                App Settings
              </button>
              
              <div className="border-t border-gray-100">
                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
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