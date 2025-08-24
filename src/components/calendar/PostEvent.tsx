'use client'

import React from 'react'
import { ScheduledPost, Platform, PostStatus } from '@/types'

interface PostEventProps {
  post: ScheduledPost
  onClick?: (post: ScheduledPost) => void
  className?: string
}

const PostEvent: React.FC<PostEventProps> = ({
  post,
  onClick,
  className = ''
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.(post)
  }

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
      publishing: { icon: '🔄', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
      published: { icon: '✅', color: 'text-green-600', bgColor: 'bg-green-50' },
      failed: { icon: '❌', color: 'text-red-600', bgColor: 'bg-red-50' },
      cancelled: { icon: '🚫', color: 'text-gray-600', bgColor: 'bg-gray-50' }
    }
    return statusConfig[status] || { icon: '⏰', color: 'text-gray-600', bgColor: 'bg-gray-50' }
  }

  const getContentPreview = () => {
    const maxLength = 50
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

  const platformInfo = getPlatformInfo(post.platform)
  const statusInfo = getStatusInfo(post.status)
  const contentPreview = getContentPreview()

  return (
    <div
      onClick={handleClick}
      className={`
        group cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm 
        hover:shadow-md hover:border-gray-300 transition-all duration-200
        ${className}
      `}
    >
      {/* Header with platform and status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm">{platformInfo.icon}</span>
          <span className="text-xs font-medium text-gray-600 capitalize">
            {platformInfo.name}
          </span>
        </div>
        
        <div className={`
          flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium
          ${statusInfo.bgColor} ${statusInfo.color}
        `}>
          <span>{statusInfo.icon}</span>
          <span className="capitalize">{post.status}</span>
        </div>
      </div>

      {/* Content preview */}
      <div className="text-sm text-gray-900 line-clamp-2 mb-2">
        {contentPreview}
      </div>

      {/* Scheduled time */}
      <div className="text-xs text-gray-500">
        {new Date(post.scheduledTime).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}
      </div>

      {/* Additional indicators */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          {post.content.type === 'thread' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
              Thread
            </span>
          )}
          
          {post.content.mediaUrls && post.content.mediaUrls.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
              Media
            </span>
          )}
        </div>

        {post.status === 'failed' && post.errorMessage && (
          <div className="text-xs text-red-600 truncate max-w-24" title={post.errorMessage}>
            Error
          </div>
        )}
      </div>
    </div>
  )
}

export default PostEvent