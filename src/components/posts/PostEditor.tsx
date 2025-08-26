'use client'

import { useState, useEffect } from 'react'
import { Platform, PostContent, CreatePostRequest, PostContentType } from '@/types'
import { PLATFORM_CONFIGS } from '@/types/platform'
import { validateContentForPlatform } from '@/utils/contentValidation'
import { RichTextEditor } from './RichTextEditor'
import { MediaUpload } from './MediaUpload'
import { ThreadComposer } from './ThreadComposer'

interface PostEditorProps {
  platform: Platform
  onSave: (post: CreatePostRequest) => void
  onCancel: () => void
  initialContent?: PostContent
  initialScheduledTime?: Date
  loading?: boolean
  isEditing?: boolean
}

export function PostEditor({ 
  platform, 
  onSave, 
  onCancel, 
  initialContent, 
  initialScheduledTime,
  loading = false,
  isEditing = false
}: PostEditorProps) {
  const [contentType, setContentType] = useState<PostContentType>(
    initialContent?.type || 'single'
  )
  const [text, setText] = useState(initialContent?.text || '')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [threadPosts, setThreadPosts] = useState<string[]>(
    initialContent?.type === 'thread' ? initialContent.threadPosts : ['']
  )
  const [schedulingType, setSchedulingType] = useState<'now' | 'next-slot' | 'custom'>(
    initialScheduledTime ? 'custom' : 'next-slot'
  )
  const [customTime, setCustomTime] = useState<string>(
    initialScheduledTime 
      ? new Date(initialScheduledTime.getTime() - initialScheduledTime.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16)
      : ''
  )
  const [errors, setErrors] = useState<string[]>([])

  const platformConfig = PLATFORM_CONFIGS[platform]
  const supportedTypes = platformConfig?.supportedContentTypes || ['single']

  // Reset form when platform changes
  useEffect(() => {
    if (!supportedTypes.includes(contentType)) {
      setContentType(supportedTypes[0])
    }
  }, [platform, contentType, supportedTypes])

  const handleContentTypeChange = (type: PostContentType) => {
    setContentType(type)
    setErrors([])
    
    // Reset type-specific fields
    if (type !== 'thread') {
      setThreadPosts([''])
    }
    if (type !== 'media') {
      setMediaFiles([])
    }
  }

  const handleMediaFilesChange = (files: File[]) => {
    setMediaFiles(files)
    setErrors([])
  }

  const handleThreadPostsChange = (posts: string[]) => {
    setThreadPosts(posts)
    setErrors([])
  }

  const validateContent = (): boolean => {
    const content = buildPostContent()
    const validation = validateContentForPlatform(content, platform)
    
    if (!validation.isValid) {
      setErrors(validation.errors.map(e => e.message))
      return false
    }
    
    setErrors([])
    return true
  }

  const buildPostContent = (): PostContent => {
    const baseContent = {
      text,
      metadata: {
        replySettings: 'everyone' as const,
        allowReplies: true
      }
    }

    switch (contentType) {
      case 'single':
        return {
          type: 'single',
          ...baseContent,
          mediaUrls: mediaFiles.length > 0 ? mediaFiles.map(f => URL.createObjectURL(f)) : undefined
        }
      
      case 'thread':
        return {
          type: 'thread',
          ...baseContent,
          threadPosts: threadPosts.filter(post => post.trim().length > 0),
          mediaUrls: mediaFiles.length > 0 ? mediaFiles.map(f => URL.createObjectURL(f)) : undefined
        }
      
      case 'media':
        return {
          type: 'media',
          ...baseContent,
          mediaUrls: mediaFiles.map(f => URL.createObjectURL(f)),
          metadata: {
            ...baseContent.metadata,
            altText: mediaFiles.map(() => ''), // TODO: Add alt text input
            mediaTypes: mediaFiles.map(f => f.type.startsWith('image/') ? 'image' as const : 'video' as const)
          }
        }
      
      default:
        throw new Error(`Unsupported content type: ${contentType}`)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateContent()) {
      return
    }

    const content = buildPostContent()
    const request: CreatePostRequest = {
      content,
      platform,
      schedulingType,
      customTime: schedulingType === 'custom' && customTime ? new Date(customTime) : undefined
    }

    onSave(request)
  }

  const isFormValid = () => {
    if (!text.trim() && contentType !== 'media') return false
    if (contentType === 'media' && mediaFiles.length === 0) return false
    if (contentType === 'thread' && threadPosts.filter(p => p.trim()).length === 0) return false
    if (schedulingType === 'custom' && !customTime) return false
    return true
  }

  const getButtonText = () => {
    if (loading) return 'Processing...'
    
    switch (schedulingType) {
      case 'now':
        return 'Post Now'
      case 'next-slot':
        return 'Post in Next Timeslot'
      case 'custom':
        return 'Schedule Post'
      default:
        return 'Post'
    }
  }

  return (
    <div className="max-w-2xl mx-auto card p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          Create Post for {platformConfig?.displayName || platform}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white"
          disabled={loading}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content Type Selection */}
        {supportedTypes.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Content Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {supportedTypes.map((type) => {
                const isSelected = contentType === type
                const icons = {
                  single: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  ),
                  thread: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  ),
                  media: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )
                }
                
                const labels = {
                  single: 'Single Post',
                  thread: 'Thread',
                  media: 'Media Post'
                }
                
                const descriptions = {
                  single: 'Simple text post with optional media',
                  thread: 'Multiple connected posts',
                  media: 'Media-focused post with caption'
                }

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleContentTypeChange(type)}
                    disabled={loading}
                    className={`
                      relative p-4 border-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                      ${isSelected 
                        ? 'border-blue-400 bg-blue-900/30 text-blue-300' 
                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:bg-gray-800/70 hover:text-gray-300'
                      }
                      ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className={`${isSelected ? 'text-blue-400' : 'text-gray-500'}`}>
                        {icons[type as keyof typeof icons]}
                      </div>
                      <div className="text-sm font-medium">
                        {labels[type as keyof typeof labels]}
                      </div>
                      <div className="text-xs text-center opacity-75">
                        {descriptions[type as keyof typeof descriptions]}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Error Display */}
        {errors.length > 0 && (
          <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded">
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Unified Content Area */}
        <div className="space-y-4">
          {/* Main Text Content - Always show */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {contentType === 'media' ? 'Caption' : contentType === 'thread' ? 'Thread Starter' : 'Post Content'}
              {contentType !== 'media' && <span className="text-red-500 ml-1">*</span>}
            </label>
            <RichTextEditor
              value={text}
              onChange={setText}
              placeholder={
                contentType === 'media' 
                  ? 'Write a caption for your media...' 
                  : contentType === 'thread' 
                  ? 'Write the first post in your thread...' 
                  : 'What\'s on your mind?'
              }
              maxLength={platformConfig?.contentLimits.maxTextLength || 500}
              disabled={loading}
            />
            <div className="text-xs text-gray-400 mt-1">
              {text.length} / {platformConfig?.contentLimits.maxTextLength || 500} characters
            </div>
          </div>

          {/* Media Upload - Show for all types except when thread has no media support */}
          {(contentType === 'media' || platformConfig?.features.media) && (
            <MediaUpload
              files={mediaFiles}
              onChange={handleMediaFilesChange}
              platform={platform}
              maxFiles={platformConfig?.contentLimits.maxMediaFiles || 10}
              required={contentType === 'media'}
              disabled={loading}
            />
          )}

          {/* Thread Composer - Only for thread type */}
          {contentType === 'thread' && (
            <div>
              <div className="border-t border-gray-700 pt-4">
                <ThreadComposer
                  posts={threadPosts}
                  onChange={handleThreadPostsChange}
                  maxLength={platformConfig?.contentLimits.maxTextLength || 500}
                  maxThreadLength={platformConfig?.contentLimits.maxThreadLength || 10}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Content Preview */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Preview</h4>
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">Your Account</div>
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">
                    {text || `Preview of your ${contentType} post will appear here...`}
                  </div>
                  {mediaFiles.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {mediaFiles.slice(0, 4).map((file, index) => (
                        <div key={index} className="aspect-square bg-gray-700 rounded overflow-hidden">
                          {file.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      ))}
                      {mediaFiles.length > 4 && (
                        <div className="aspect-square bg-gray-700 rounded flex items-center justify-center">
                          <span className="text-sm text-gray-400">+{mediaFiles.length - 4}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {contentType === 'thread' && threadPosts.some(post => post.trim()) && (
                    <div className="mt-2 text-xs text-blue-400">
                      Thread continues with {threadPosts.filter(post => post.trim()).length} more posts...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scheduling Options */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            When to Post
          </label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="schedulingType"
                value="now"
                checked={schedulingType === 'now'}
                onChange={(e) => setSchedulingType(e.target.value as 'now' | 'next-slot' | 'custom')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-300">Post Now</span>
              <span className="text-xs text-gray-400 ml-2">Publish immediately</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="schedulingType"
                value="next-slot"
                checked={schedulingType === 'next-slot'}
                onChange={(e) => setSchedulingType(e.target.value as 'now' | 'next-slot' | 'custom')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-300">Post in Next Timeslot</span>
              <span className="text-xs text-gray-400 ml-2">Use your configured schedule</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="schedulingType"
                value="custom"
                checked={schedulingType === 'custom'}
                onChange={(e) => setSchedulingType(e.target.value as 'now' | 'next-slot' | 'custom')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-300">Schedule Post</span>
              <span className="text-xs text-gray-400 ml-2">Choose specific date and time</span>
            </label>
            {schedulingType === 'custom' && (
              <div className="ml-6">
                <input
                  type="datetime-local"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="input-dark px-3 py-2"
                  disabled={loading}
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isFormValid() || loading}
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              schedulingType === 'now' 
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            {getButtonText()}
          </button>
        </div>
      </form>
    </div>
  )
}