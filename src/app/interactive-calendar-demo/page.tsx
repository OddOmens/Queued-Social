'use client'

import React, { useState } from 'react'
import { InteractiveCalendarView } from '@/components/calendar'
import { ScheduledPost, Platform, PostStatus } from '@/types'

// Mock data with posts in same time slots for grouping demo
const mockPosts: ScheduledPost[] = [
  // Group 1: Multiple posts at same time
  {
    id: '1',
    userId: 'user1',
    platform: 'threads' as Platform,
    content: {
      type: 'single',
      text: 'First post in the group - sharing some thoughts about React development',
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
      type: 'single',
      text: 'Second post in the same time slot - cross-posting to Twitter',
      metadata: {}
    },
    scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000 + 5 * 60 * 1000), // 2h 5m from now (will be grouped)
    status: 'scheduled' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    userId: 'user1',
    platform: 'linkedin' as Platform,
    content: {
      type: 'single',
      text: 'Third post in the group - professional version for LinkedIn',
      metadata: {}
    },
    scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000 + 10 * 60 * 1000), // 2h 10m from now (will be grouped)
    status: 'scheduled' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Single posts
  {
    id: '4',
    userId: 'user1',
    platform: 'instagram' as Platform,
    content: {
      type: 'media',
      text: 'Beautiful sunset photo 🌅',
      mediaUrls: ['https://example.com/sunset.jpg'],
      metadata: {
        altText: ['Sunset over the ocean'],
        mediaTypes: ['image']
      }
    },
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    status: 'scheduled' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '5',
    userId: 'user1',
    platform: 'threads' as Platform,
    content: {
      type: 'thread',
      text: 'Building a social media scheduler',
      threadPosts: [
        'Building a social media scheduler with React and Next.js',
        'The calendar view uses React Big Calendar for great UX',
        'Drag and drop makes rescheduling super easy',
        'Post grouping helps manage multiple posts at once'
      ],
      metadata: {}
    },
    scheduledTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    status: 'scheduled' as PostStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Published post
  {
    id: '6',
    userId: 'user1',
    platform: 'linkedin' as Platform,
    content: {
      type: 'single',
      text: 'Excited to share my latest project - a comprehensive social media scheduling tool!',
      metadata: {}
    },
    scheduledTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    status: 'published' as PostStatus,
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Failed post
  {
    id: '7',
    userId: 'user1',
    platform: 'twitter' as Platform,
    content: {
      type: 'single',
      text: 'This post failed to publish due to API issues',
      metadata: {}
    },
    scheduledTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    status: 'failed' as PostStatus,
    errorMessage: 'API rate limit exceeded. Please try again later.',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

export default function InteractiveCalendarDemoPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>(mockPosts)
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState<string[]>([])

  const addNotification = (message: string) => {
    setNotifications(prev => [...prev, message])
    setTimeout(() => {
      setNotifications(prev => prev.slice(1))
    }, 3000)
  }

  const handlePostSelect = (post: ScheduledPost) => {
    console.log('Selected post:', post)
    addNotification(`Selected post: ${post.content.text.substring(0, 30)}...`)
  }

  const handlePostUpdate = async (postId: string, updates: Partial<ScheduledPost>) => {
    setLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, ...updates, updatedAt: new Date() }
        : post
    ))
    
    setLoading(false)
    addNotification(`Post updated successfully`)
  }

  const handlePostReschedule = async (postId: string, newTime: Date) => {
    setLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, scheduledTime: newTime, updatedAt: new Date() }
        : post
    ))
    
    setLoading(false)
    addNotification(`Post rescheduled to ${newTime.toLocaleString()}`)
  }

  const handleDateSelect = (date: Date) => {
    console.log('Selected date:', date)
    addNotification(`Selected date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`)
  }

  const addSamplePost = () => {
    const newPost: ScheduledPost = {
      id: `sample-${Date.now()}`,
      userId: 'user1',
      platform: 'threads' as Platform,
      content: {
        type: 'single',
        text: `Sample post created at ${new Date().toLocaleTimeString()}`,
        metadata: {}
      },
      scheduledTime: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in next week
      status: 'scheduled' as PostStatus,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    setPosts(prev => [...prev, newPost])
    addNotification('Sample post added to calendar')
  }

  const clearAllPosts = () => {
    setPosts([])
    addNotification('All posts cleared')
  }

  const resetPosts = () => {
    setPosts(mockPosts)
    addNotification('Posts reset to demo data')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Interactive Calendar Demo
          </h1>
          <p className="text-gray-600 mb-4">
            Full-featured calendar with drag-and-drop rescheduling, post grouping, and interactive modals.
            Try dragging posts to reschedule them, or click on grouped posts to manage them together.
          </p>
          
          {/* Demo Features */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Interactive Features</h2>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Drag & Drop:</strong> Drag posts to reschedule them to different time slots</li>
              <li>• <strong>Post Grouping:</strong> Posts scheduled within 30 minutes are automatically grouped</li>
              <li>• <strong>Bulk Actions:</strong> Select multiple posts in a group for bulk operations</li>
              <li>• <strong>Real-time Updates:</strong> Changes are reflected immediately in the calendar</li>
              <li>• <strong>Status Management:</strong> Update post status, retry failed posts, cancel scheduled ones</li>
            </ul>
          </div>
        </div>

        {/* Demo Controls */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Demo Controls</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={addSamplePost}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Add Sample Post
            </button>
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
              onClick={resetPosts}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              Reset Demo Data
            </button>
            <button
              onClick={clearAllPosts}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Clear All Posts
            </button>
          </div>
        </div>

        {/* Calendar */}
        <InteractiveCalendarView
          posts={posts}
          onPostSelect={handlePostSelect}
          onPostUpdate={handlePostUpdate}
          onPostReschedule={handlePostReschedule}
          onDateSelect={handleDateSelect}
          view="month"
          onViewChange={() => {}} // View change handled internally
          loading={loading}
          className="mb-8"
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{posts.length}</div>
            <div className="text-sm text-gray-600">Total Posts</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">
              {posts.filter(p => p.status === 'scheduled').length}
            </div>
            <div className="text-sm text-gray-600">Scheduled</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">
              {posts.filter(p => p.status === 'published').length}
            </div>
            <div className="text-sm text-gray-600">Published</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-red-600">
              {posts.filter(p => p.status === 'failed').length}
            </div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="fixed bottom-4 right-4 space-y-2 z-50">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in-right"
              >
                {notification}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}