'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'

interface UserProfile {
  email: string
  timezone: string
  createdAt: string
}

export default function ProfileSettingsPage() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [timezone, setTimezone] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/auth/profile')
        if (response.ok) {
          const data = await response.json()
          setProfile(data.profile)
          setTimezone(data.profile.timezone || 'UTC')
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timezone,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        alert('Profile updated successfully!')
      } else {
        alert('Failed to update profile')
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ]

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
          <p className="text-gray-600 mt-1">
            Manage your account information and preferences.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              value={profile?.email || user?.email || ''}
              disabled
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
            />
            <p className="mt-1 text-sm text-gray-500">
              Email address cannot be changed. Contact support if you need to update this.
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
              Timezone
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              This timezone will be used for scheduling posts and displaying times.
            </p>
          </div>

          {/* Account Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Account Created
            </label>
            <input
              type="text"
              value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ''}
              disabled
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
          <p className="text-red-700 mt-1">
            These actions are irreversible. Please be careful.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
            <div>
              <h4 className="text-sm font-medium text-red-900">Delete Account</h4>
              <p className="text-sm text-red-700">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <button
              type="button"
              onClick={() => alert('Account deletion is not yet implemented. Contact support if needed.')}
              className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}