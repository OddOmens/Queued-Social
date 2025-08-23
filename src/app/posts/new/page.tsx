'use client'

import React from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { PostEditor } from '@/components/posts'

export default function NewPostPage() {
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

        {/* Post Editor */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <PostEditor
            onSave={(post) => {
              console.log('Post saved:', post)
              // Handle post save
            }}
          />
        </div>
      </div>
    </AppLayout>
  )
}