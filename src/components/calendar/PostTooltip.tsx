import React from 'react'
import { ScheduledPost } from '@/types'

interface PostTooltipProps {
  post: ScheduledPost
  position: { x: number; y: number }
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

export function PostTooltip({ post, position, onEdit, onDelete, onClose }: PostTooltipProps) {
  const getPlatformIcon = (platform: string) => {
    const icons = {
      threads: '🧵',
      twitter: '🐦',
      instagram: '📷',
      linkedin: '💼'
    }
    return icons[platform as keyof typeof icons] || '📱'
  }

  const getStatusColor = (status: string) => {
    const colors = {
      scheduled: 'text-blue-400 bg-blue-900/20 border-blue-600',
      publishing: 'text-amber-400 bg-amber-900/20 border-amber-600',
      published: 'text-green-400 bg-green-900/20 border-green-600',
      failed: 'text-red-400 bg-red-900/20 border-red-600',
      cancelled: 'text-gray-400 bg-gray-900/20 border-gray-600'
    }
    return colors[status as keyof typeof colors] || 'text-gray-400 bg-gray-900/20 border-gray-600'
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Tooltip */}
      <div
        className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-sm w-80"
        style={{
          left: Math.min(position.x, window.innerWidth - 320 - 20),
          top: Math.min(position.y, window.innerHeight - 400 - 20)
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getPlatformIcon(post.platform)}</span>
            <div>
              <div className="font-semibold text-white capitalize">
                {post.platform}
              </div>
              <div className="text-sm text-gray-400">
                {formatDate(post.scheduledTime)} at {formatTime(post.scheduledTime)}
              </div>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(post.status)}`}>
            {post.status}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {post.content.type === 'thread' ? (
            <div>
              <div className="text-xs text-gray-400 mb-1">
                Thread ({post.content.threadPosts?.length || 1} posts)
              </div>
              <div className="text-sm text-gray-200 line-clamp-3">
                {post.content.text}
              </div>
            </div>
          ) : post.content.type === 'media' ? (
            <div>
              <div className="text-xs text-gray-400 mb-1">
                Media Post
              </div>
              <div className="text-sm text-gray-200 line-clamp-3">
                {post.content.text || 'Media content'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-200 line-clamp-3">
              {post.content.text}
            </div>
          )}

          {post.publishedAt && (
            <div className="text-xs text-green-400">
              Published: {new Date(post.publishedAt).toLocaleString()}
            </div>
          )}

          {post.errorMessage && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-600 rounded-lg p-2">
              Error: {post.errorMessage}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 p-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </>
  )
}