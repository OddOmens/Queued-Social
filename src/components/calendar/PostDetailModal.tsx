'use client'

import React, { useState } from 'react'
import { ScheduledPost, Platform, PostStatus } from '@/types'

interface PostDetailModalProps {
  post: ScheduledPost
  onClose: () => void
  onUpdate: (postId: string, updates: Partial<ScheduledPost>) => Promise<void>
  onReschedule: (postId: string, newTime: Date) => Promise<void>
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  onClose,
  onUpdate,
  onReschedule
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [newScheduleTime, setNewScheduleTime] = useState(
    new Date(post.scheduledTime).toISOString().slice(0, 16)
  )
  const [loading, setLoading] = useState(false)

  const getPlatformInfo = (platform: Platform) => {
    const platformConfig = {
      threads: { icon: '🧵', name: 'Threads', color: 'bg-black' },
      twitter: { icon: '🐦', name: 'Twitter', color: 'bg-blue-500' },
      instagram: { icon: '📷', name: 'Instagram', color: 'bg-pink-500' },
      linkedin: { icon: '💼', name: 'LinkedIn', color: 'bg-blue-700' }
    }
    return platformConfig[platform] || { icon: '📱', name: 'Unknown', color: 'bg-gray-500' }
  }

  const getStatusInfo = (status: PostStatus) => {
    const statusConfig = {
      scheduled: { icon: '⏰', color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Scheduled' },
      published: { icon: '✅', color: 'text-green-600', bgColor: 'bg-green-50', label: 'Published' },
      failed: { icon: '❌', color: 'text-red-600', bgColor: 'bg-red-50', label: 'Failed' },
      cancelled: { icon: '🚫', color: 'text-gray-600', bgColor: 'bg-gray-50', label: 'Cancelled' }
    }
    return statusConfig[status] || { icon: '⏰', color: 'text-gray-600', bgColor: 'bg-gray-50', label: 'Unknown' }
  }

  const handleReschedule = async () => {
    if (!newScheduleTime) return
    
    setLoading(true)
    try {
      await onReschedule(post.id, new Date(newScheduleTime))
      setIsRescheduling(false)
      onClose()
    } catch (error) {
      console.error('Failed to reschedule post:', error)
      // You could show an error toast here
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: PostStatus) => {
    setLoading(true)
    try {
      await onUpdate(post.id, { status: newStatus })
      onClose()
    } catch (error) {
      console.error('Failed to update post status:', error)
    } finally {
      setLoading(false)
    }
  }

  const platformInfo = getPlatformInfo(post.platform)
  const statusInfo = getStatusInfo(post.status)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Post Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Platform and Status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${platformInfo.color}`}>
                <span className="mr-1">{platformInfo.icon}</span>
                {platformInfo.name}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                <span className="mr-1">{statusInfo.icon}</span>
                {statusInfo.label}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              {post.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={loading}
                    className="px-3 py-1 text-sm text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsRescheduling(!isRescheduling)}
                    className="px-3 py-1 text-sm text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    Reschedule
                  </button>
                </>
              )}
              
              {post.status === 'failed' && (
                <button
                  onClick={() => handleStatusChange('scheduled')}
                  disabled={loading}
                  className="px-3 py-1 text-sm text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  Retry
                </button>
              )}
            </div>
          </div>

          {/* Reschedule Section */}
          {isRescheduling && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-3">Reschedule Post</h3>
              <div className="flex items-center space-x-3">
                <input
                  type="datetime-local"
                  value={newScheduleTime}
                  onChange={(e) => setNewScheduleTime(e.target.value)}
                  className="flex-1 px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleReschedule}
                  disabled={loading || !newScheduleTime}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsRescheduling(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Content</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {post.content.type}
                  </span>
                  {post.content.type === 'thread' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      Thread
                    </span>
                  )}
                  {post.content.mediaUrls && post.content.mediaUrls.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                      {post.content.mediaUrls.length} Media
                    </span>
                  )}
                </div>
              </div>

              <p className="text-gray-900 whitespace-pre-wrap mb-3">{post.content.text}</p>
              
              {post.content.type === 'thread' && 'threadPosts' in post.content && post.content.threadPosts && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Thread Posts:</p>
                  <div className="space-y-2">
                    {post.content.threadPosts.map((threadPost, index) => (
                      <div key={index} className="bg-white rounded p-3 border-l-4 border-purple-200">
                        <div className="flex items-center mb-1">
                          <span className="text-xs font-medium text-purple-600">Post {index + 1}</span>
                        </div>
                        <p className="text-sm text-gray-700">{threadPost}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {post.content.mediaUrls && post.content.mediaUrls.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Media Files:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {post.content.mediaUrls.map((url, index) => (
                      <div key={index} className="bg-white rounded p-2 border border-gray-200">
                        <p className="text-xs text-gray-500 truncate">{url}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scheduling Information */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Scheduling Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Scheduled Time:</span>
                <span className="text-sm text-gray-900">
                  {new Date(post.scheduledTime).toLocaleString()}
                </span>
              </div>
              
              {post.publishedAt && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Published At:</span>
                  <span className="text-sm text-gray-900">
                    {new Date(post.publishedAt).toLocaleString()}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Created:</span>
                <span className="text-sm text-gray-900">
                  {new Date(post.createdAt).toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Last Updated:</span>
                <span className="text-sm text-gray-900">
                  {new Date(post.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Error Information */}
          {post.errorMessage && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-red-700 mb-3">Error Details</h3>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-800">{post.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Edit Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PostDetailModal