'use client'

import React, { useState } from 'react'
import { CalendarContainer } from '@/components/calendar'
import { ScheduledPost, Platform, PostStatus } from '@/types'

// Mock data for demonstration
const mockPosts: ScheduledPost[] = [
  {
    id: '1',
    userId: 'user1',
    platform: 'threads' as Platform,
    content: {
      type: 'single',
      text: 'Just finished implementing the calendar view! 🎉 This is a test post to see how it looks in the calendar interface.',
      metadata: {}
    },
    scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    status: 'scheduled' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    userId: 'user1',
    platform: 'twitter' as Platform,
    content: {
      type: 'thread',
      text: 'Building a social media scheduler with React and Next.js',
      threadPosts: [
        'Building a social media scheduler with React and Next.js',
        'The calendar view uses React Big Calendar for a great user experience',
        'Supporting multiple platforms with a plugin architecture'
      ],
      metadata: {}
    },
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    status: 'scheduled' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    userId: 'user1',
    platform: 'instagram' as Platform,
    content: {
      type: 'media',
      text: 'Check out this amazing sunset! 🌅',
      mediaUrls: ['https://example.com/sunset.jpg'],
      metadata: {
        altText: ['Beautiful sunset over the ocean'],
        mediaTypes: ['image']
      }
    },
    scheduledTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    status: 'scheduled' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    userId: 'user1',
    platform: 'linkedin' as Platform,
    content: {
      type: 'single',
      text: 'Excited to share my latest project - a comprehensive social media scheduling tool built with modern web technologies.',
      metadata: {}
    },
    scheduledTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (published)
    status: 'published' as PostStatus,
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '5',
    userId: 'user1',
    platform: 'threads' as Platform,
    content: {
      type: 'single',
      text: 'This post failed to publish due to API rate limiting.',
      metadata: {}
    },
    scheduledTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (failed)
    status: 'failed' as PostStatus,
    errorMessage: 'Rate limit exceeded. Please try again later.',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

export default function CalendarDemoPage() {
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePostSelect = (post: ScheduledPost) => {
    setSelectedPost(post)
  }

  const handleDateSelect = (date: Date) => {
    console.log('Selected date:', date)
    alert(`Selected date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`)
  }

  const handleCloseModal = () => {
    setSelectedPost(null)
  }

  const getPlatformColor = (platform: Platform) => {
    const colors = {
      threads: 'bg-black',
      twitter: 'bg-blue-500',
      instagram: 'bg-pink-500',
      linkedin: 'bg-blue-700'
    }
    return colors[platform] || 'bg-gray-500'
  }

  const getStatusColor = (status: PostStatus) => {
    const colors = {
      scheduled: 'text-blue-600 bg-blue-50',
      published: 'text-green-600 bg-green-50',
      failed: 'text-red-600 bg-red-50',
      cancelled: 'text-gray-600 bg-gray-50'
    }
    return colors[status] || 'text-gray-600 bg-gray-50'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Calendar View Demo
          </h1>
          <p className="text-gray-600">
            Interactive calendar showing scheduled social media posts across different platforms.
            Click on posts to view details or click on empty slots to schedule new posts.
          </p>
        </div>

        {/* Calendar Component */}
        <CalendarContainer
          posts={mockPosts}
          onPostSelect={handlePostSelect}
          onDateSelect={handleDateSelect}
          loading={loading}
          className="mb-8"
        />

        {/* Demo Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Demo Controls</h2>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setLoading(true)
                setTimeout(() => setLoading(false), 2000)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Simulate Loading
            </button>
            <button
              onClick={() => {
                const randomPost = mockPosts[Math.floor(Math.random() * mockPosts.length)]
                setSelectedPost(randomPost)
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Show Random Post
            </button>
          </div>
        </div>

        {/* Post Details Modal */}
        {selectedPost && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Post Details</h2>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Platform and Status */}
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${getPlatformColor(selectedPost.platform)}`}>
                      {selectedPost.platform.charAt(0).toUpperCase() + selectedPost.platform.slice(1)}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedPost.status)}`}>
                      {selectedPost.status.charAt(0).toUpperCase() + selectedPost.status.slice(1)}
                    </span>
                  </div>

                  {/* Content */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Content</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-900">{selectedPost.content.text}</p>
                      
                      {selectedPost.content.type === 'thread' && 'threadPosts' in selectedPost.content && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Thread Posts:</p>
                          <ol className="list-decimal list-inside space-y-1">
                            {selectedPost.content.threadPosts.map((post, index) => (
                              <li key={index} className="text-sm text-gray-600">{post}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      {selectedPost.content.mediaUrls && selectedPost.content.mediaUrls.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Media:</p>
                          <p className="text-sm text-gray-600">{selectedPost.content.mediaUrls.length} file(s)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scheduling Info */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Scheduling</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Scheduled:</span> {selectedPost.scheduledTime.toLocaleString()}
                      </p>
                      {selectedPost.publishedAt && (
                        <p className="text-sm">
                          <span className="font-medium">Published:</span> {selectedPost.publishedAt.toLocaleString()}
                        </p>
                      )}
                      {selectedPost.errorMessage && (
                        <p className="text-sm text-red-600">
                          <span className="font-medium">Error:</span> {selectedPost.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      console.log('Edit post:', selectedPost.id)
                      alert('Edit functionality would be implemented here')
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Edit Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}