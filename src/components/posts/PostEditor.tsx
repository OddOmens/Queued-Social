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
          className="text-gray-500 hover:text-gray-700"
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
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Post Type
            </label>
            <div className="flex space-x-4">
              {supportedTypes.map((type) => (
                <label key={type} className="flex items-center">
                  <input
                    type="radio"
                    name="contentType"
                    value={type}
                    checked={contentType === type}
                    onChange={(e) => handleContentTypeChange(e.target.value as PostContentType)}
                    className="mr-2"
                    disabled={loading}
                  />
                  <span className="text-sm capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Main Text Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {contentType === 'media' ? 'Caption' : 'Post Content'}
            {contentType !== 'media' && <span className="text-red-500 ml-1">*</span>}
          </label>
          <RichTextEditor
            value={text}
            onChange={setText}
            placeholder={`Write your ${contentType === 'media' ? 'caption' : 'post'} here...`}
            maxLength={platformConfig?.contentLimits.maxTextLength || 500}
            disabled={loading}
          />
          <div className="text-xs text-gray-500 mt-1">
            {text.length} / {platformConfig?.contentLimits.maxTextLength || 500} characters
          </div>
        </div>

        {/* Thread Composer */}
        {contentType === 'thread' && (
          <ThreadComposer
            posts={threadPosts}
            onChange={handleThreadPostsChange}
            maxLength={platformConfig?.contentLimits.maxTextLength || 500}
            maxThreadLength={platformConfig?.contentLimits.maxThreadLength || 10}
            disabled={loading}
          />
        )}

        {/* Media Upload */}
        {(contentType === 'media' || (contentType !== 'thread' && platformConfig?.features.media)) && (
          <MediaUpload
            files={mediaFiles}
            onChange={handleMediaFilesChange}
            platform={platform}
            maxFiles={platformConfig?.contentLimits.maxMediaFiles || 10}
            required={contentType === 'media'}
            disabled={loading}
          />
        )}

        {/* Scheduling Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
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
              <span className="text-sm font-medium">Post Now</span>
              <span className="text-xs text-gray-500 ml-2">Publish immediately</span>
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
              <span className="text-sm font-medium">Post in Next Timeslot</span>
              <span className="text-xs text-gray-500 ml-2">Use your configured schedule</span>
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
              <span className="text-sm font-medium">Schedule Post</span>
              <span className="text-xs text-gray-500 ml-2">Choose specific date and time</span>
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
        <div className="flex justify-end space-x-3 pt-4 border-t">
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