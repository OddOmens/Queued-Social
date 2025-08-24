'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { PostEditor } from '@/components/posts'
import { Platform, CreatePostRequest } from '@/types'

export default function NewPostPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('threads')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const handleSave = async (post: CreatePostRequest) => {
    setSaving(true)
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(post),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Post saved successfully:', result)
        
        setMessage({ type: 'success', text: 'Post scheduled successfully!' })
        
        // Redirect to posts page after a short delay
        setTimeout(() => {
          router.push('/posts')
        }, 1500)
      } else {
        const error = await response.json()
        console.error('Failed to save post:', error)
        setMessage({ 
          type: 'error', 
          text: `Failed to save post: ${error.error?.message || 'Unknown error'}` 
        })
      }
    } catch (error) {
      console.error('Error saving post:', error)
      setMessage({ type: 'error', text: 'Failed to save post. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push('/posts')
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Create New Post</h1>
          <p className="text-gray-600 mt-1">
            Create and schedule a new social media post
          </p>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`rounded-lg p-4 ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${
                message.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {message.type === 'success' ? (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{message.text}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setMessage(null)}
                  className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    message.type === 'success'
                      ? 'text-green-500 hover:bg-green-100 focus:ring-green-600'
                      : 'text-red-500 hover:bg-red-100 focus:ring-red-600'
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Platform Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Platform</h2>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="platform"
                value="threads"
                checked={selectedPlatform === 'threads'}
                onChange={(e) => setSelectedPlatform(e.target.value as Platform)}
                className="mr-2"
              />
              Threads
            </label>
            {/* Add other platforms when they're implemented */}
          </div>
        </div>

        {/* Post Editor */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <PostEditor
            platform={selectedPlatform}
            onSave={handleSave}
            onCancel={handleCancel}
            loading={saving}
          />
        </div>
      </div>
    </AppLayout>
  )
}