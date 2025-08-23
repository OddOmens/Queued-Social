'use client'

import React, { useState } from 'react'
import { ScheduledPost, Platform, PostStatus } from '@/types'

interface PostGroupModalProps {
  posts: ScheduledPost[]
  onClose: () => void
  onPostSelect: (post: ScheduledPost) => void
  onUpdate: (postId: string, updates: Partial<ScheduledPost>) => Promise<void>
  onReschedule: (postId: string, newTime: Date) => Promise<void>
}

const PostGroupModal: React.FC<PostGroupModalProps> = ({
  posts,
  onClose,
  onPostSelect,
  onUpdate,
  onReschedule
}) => {
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set())
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [newScheduleTime, setNewScheduleTime] = useState(
    new Date(posts[0]?.scheduledTime || Date.now()).toISOString().slice(0, 16)
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
      scheduled: { icon: '⏰', color: 'text-blue-600', bgColor: 'bg-blue-50' },
      published: { icon: '✅', color: 'text-green-600', bgColor: 'bg-green-50' },
      failed: { icon: '❌', color: 'text-red-600', bgColor: 'bg-red-50' },
      cancelled: { icon: '🚫', color: 'text-gray-600', bgColor: 'bg-gray-50' }
    }
    return statusConfig[status] || { icon: '⏰', color: 'text-gray-600', bgColor: 'bg-gray-50' }
  }

  const getContentPreview = (post: ScheduledPost) => {
    const maxLength = 80
    let preview = ''
    
    switch (post.content.type) {
      case 'thread':
        preview = `Thread: ${post.content.text}`
        break
      case 'media':
        const mediaCount = post.content.mediaUrls?.length || 0
        preview = `${post.content.text} (${mediaCount} media)`
        break
      default:
        preview = post.content.text
    }
    
    return preview.length > maxLength ? `${preview.substring(0, maxLength)}...` : preview
  }

  const handleSelectPost = (postId: string) => {
    const newSelected = new Set(selectedPostIds)
    if (newSelected.has(postId)) {
      newSelected.delete(postId)
    } else {
      newSelected.add(postId)
    }
    setSelectedPostIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedPostIds.size === posts.length) {
      setSelectedPostIds(new Set())
    } else {
      setSelectedPostIds(new Set(posts.map(p => p.id)))
    }
  }

  const handleBulkReschedule = async () => {
    if (!newScheduleTime || selectedPostIds.size === 0) return
    
    setLoading(true)
    try {
      const promises = Array.from(selectedPostIds).map((postId, index) => {
        // Stagger posts by 5 minutes each
        const scheduledTime = new Date(newScheduleTime)
        scheduledTime.setMinutes(scheduledTime.getMinutes() + (index * 5))
        return onReschedule(postId, scheduledTime)
      })
      
      await Promise.all(promises)
      setIsRescheduling(false)
      onClose()
    } catch (error) {
      console.error('Failed to reschedule posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkStatusChange = async (newStatus: PostStatus) => {
    if (selectedPostIds.size === 0) return
    
    setLoading(true)
    try {
      const promises = Array.from(selectedPostIds).map(postId =>
        onUpdate(postId, { status: newStatus })
      )
      
      await Promise.all(promises)
      onClose()
    } catch (error) {
      console.error('Failed to update post statuses:', error)
    } finally {
      setLoading(false)
    }
  }

  const scheduledTime = posts[0]?.scheduledTime ? new Date(posts[0].scheduledTime) : new Date()
  const platformCounts = posts.reduce((acc, post) => {
    acc[post.platform] = (acc[post.platform] || 0) + 1
    return acc
  }, {} as Record<Platform, number>)

  const statusCounts = posts.reduce((acc, post) => {
    acc[post.status] = (acc[post.status] || 0) + 1
    return acc
  }, {} as Record<PostStatus, number>)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {posts.length} Posts Scheduled
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {scheduledTime.toLocaleString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Platforms</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(platformCounts).map(([platform, count]) => {
                    const platformInfo = getPlatformInfo(platform as Platform)
                    return (
                      <span
                        key={platform}
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white ${platformInfo.color}`}
                      >
                        <span className="mr-1">{platformInfo.icon}</span>
                        {platformInfo.name} ({count})
                      </span>
                    )
                  })}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusCounts).map(([status, count]) => {
                    const statusInfo = getStatusInfo(status as PostStatus)
                    return (
                      <span
                        key={status}
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}
                      >
                        <span className="mr-1">{statusInfo.icon}</span>
                        {status} ({count})
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-blue-900">Bulk Actions</h3>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-blue-700">
                  {selectedPostIds.size} of {posts.length} selected
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedPostIds.size === posts.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
            
            {selectedPostIds.size > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsRescheduling(!isRescheduling)}
                  className="px-3 py-1 text-sm text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                >
                  Reschedule Selected
                </button>
                <button
                  onClick={() => handleBulkStatusChange('cancelled')}
                  disabled={loading}
                  className="px-3 py-1 text-sm text-red-600 bg-red-100 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                >
                  Cancel Selected
                </button>
              </div>
            )}

            {/* Reschedule Section */}
            {isRescheduling && selectedPostIds.size > 0 && (
              <div className="mt-4 p-3 bg-white rounded border">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Reschedule {selectedPostIds.size} posts
                </h4>
                <p className="text-xs text-gray-600 mb-3">
                  Posts will be staggered 5 minutes apart starting from the selected time.
                </p>
                <div className="flex items-center space-x-3">
                  <input
                    type="datetime-local"
                    value={newScheduleTime}
                    onChange={(e) => setNewScheduleTime(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={handleBulkReschedule}
                    disabled={loading || !newScheduleTime}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Reschedule'}
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
          </div>

          {/* Posts List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Posts in this time slot</h3>
            {posts.map((post) => {
              const platformInfo = getPlatformInfo(post.platform)
              const statusInfo = getStatusInfo(post.status)
              const isSelected = selectedPostIds.has(post.id)
              
              return (
                <div
                  key={post.id}
                  className={`border rounded-lg p-4 transition-all cursor-pointer ${
                    isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleSelectPost(post.id)}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectPost(post.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white ${platformInfo.color}`}>
                          <span className="mr-1">{platformInfo.icon}</span>
                          {platformInfo.name}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                          <span className="mr-1">{statusInfo.icon}</span>
                          {post.status}
                        </span>
                        {post.content.type === 'thread' && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            Thread
                          </span>
                        )}
                        {post.content.mediaUrls && post.content.mediaUrls.length > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            Media
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-900 mb-2">
                        {getContentPreview(post)}
                      </p>
                      
                      {post.errorMessage && (
                        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                          {post.errorMessage}
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onPostSelect(post)
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PostGroupModal