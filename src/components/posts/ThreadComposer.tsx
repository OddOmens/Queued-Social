'use client'

import { useState } from 'react'
import { RichTextEditor } from './RichTextEditor'

interface ThreadComposerProps {
  posts: string[]
  onChange: (posts: string[]) => void
  maxLength?: number
  maxThreadLength?: number
  disabled?: boolean
  className?: string
}

export function ThreadComposer({
  posts,
  onChange,
  maxLength = 500,
  maxThreadLength = 20,
  disabled = false,
  className = ''
}: ThreadComposerProps) {
  const [expandedPost, setExpandedPost] = useState<number | null>(null)

  const updatePost = (index: number, content: string) => {
    const newPosts = [...posts]
    newPosts[index] = content
    onChange(newPosts)
  }

  const addPost = () => {
    if (posts.length < maxThreadLength) {
      onChange([...posts, ''])
      setExpandedPost(posts.length) // Expand the new post
    }
  }

  const removePost = (index: number) => {
    if (posts.length > 1) {
      const newPosts = posts.filter((_, i) => i !== index)
      onChange(newPosts)
      
      // Adjust expanded post index if needed
      if (expandedPost !== null) {
        if (expandedPost === index) {
          setExpandedPost(null)
        } else if (expandedPost > index) {
          setExpandedPost(expandedPost - 1)
        }
      }
    }
  }

  const movePost = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= posts.length) return
    
    const newPosts = [...posts]
    const [movedPost] = newPosts.splice(fromIndex, 1)
    newPosts.splice(toIndex, 0, movedPost)
    onChange(newPosts)

    // Update expanded post index
    if (expandedPost === fromIndex) {
      setExpandedPost(toIndex)
    } else if (expandedPost !== null) {
      if (fromIndex < toIndex && expandedPost > fromIndex && expandedPost <= toIndex) {
        setExpandedPost(expandedPost - 1)
      } else if (fromIndex > toIndex && expandedPost >= toIndex && expandedPost < fromIndex) {
        setExpandedPost(expandedPost + 1)
      }
    }
  }

  const toggleExpanded = (index: number) => {
    setExpandedPost(expandedPost === index ? null : index)
  }

  const getPostPreview = (content: string, maxChars: number = 100) => {
    if (content.length <= maxChars) return content
    return content.slice(0, maxChars) + '...'
  }

  const nonEmptyPosts = posts.filter(post => post.trim().length > 0)
  const totalCharacters = posts.reduce((sum, post) => sum + post.length, 0)

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Thread Posts
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="text-xs text-gray-500">
          {nonEmptyPosts.length} / {maxThreadLength} posts • {totalCharacters} total characters
        </div>
      </div>

      <div className="space-y-4">
        {posts.map((post, index) => (
          <div key={index} className="relative">
            {/* Thread Connection Line */}
            {index > 0 && (
              <div className="absolute -top-4 left-6 w-0.5 h-4 bg-gray-300"></div>
            )}

            <div className="flex items-start space-x-3">
              {/* Thread Number */}
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>

              {/* Post Content */}
              <div className="flex-1 min-w-0">
                {expandedPost === index ? (
                  <div className="space-y-2">
                    <RichTextEditor
                      value={post}
                      onChange={(content) => updatePost(index, content)}
                      placeholder={`Write thread post ${index + 1}...`}
                      maxLength={maxLength}
                      disabled={disabled}
                    />
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(index)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                        disabled={disabled}
                      >
                        Collapse
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !disabled && toggleExpanded(index)}
                    className={`p-3 border border-gray-200 rounded-lg ${
                      disabled ? 'bg-gray-50' : 'bg-white hover:bg-gray-50 cursor-pointer'
                    } transition-colors`}
                  >
                    {post.trim() ? (
                      <div>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">
                          {getPostPreview(post)}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {post.length} / {maxLength} characters
                          </span>
                          <span className="text-xs text-blue-600">
                            Click to edit
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 italic">
                        Click to add content for post {index + 1}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Post Actions */}
              <div className="flex-shrink-0 flex flex-col space-y-1">
                {/* Move Up */}
                <button
                  type="button"
                  onClick={() => movePost(index, index - 1)}
                  disabled={disabled || index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>

                {/* Move Down */}
                <button
                  type="button"
                  onClick={() => movePost(index, index + 1)}
                  disabled={disabled || index === posts.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Remove Post */}
                <button
                  type="button"
                  onClick={() => removePost(index)}
                  disabled={disabled || posts.length <= 1}
                  className="p-1 text-red-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove post"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Thread Connection Line (continued) */}
            {index < posts.length - 1 && (
              <div className="absolute -bottom-4 left-6 w-0.5 h-4 bg-gray-300"></div>
            )}
          </div>
        ))}

        {/* Add Post Button */}
        {posts.length < maxThreadLength && (
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <button
              type="button"
              onClick={addPost}
              disabled={disabled}
              className="flex-1 p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add another post to thread
            </button>
          </div>
        )}
      </div>

      {/* Thread Summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Thread Summary: {nonEmptyPosts.length} posts with content
          </span>
          <span className="text-gray-500">
            {totalCharacters} total characters
          </span>
        </div>
        
        {nonEmptyPosts.length === 0 && (
          <p className="text-xs text-red-600 mt-1">
            At least one post must have content
          </p>
        )}
        
        {posts.length >= maxThreadLength && (
          <p className="text-xs text-yellow-600 mt-1">
            Maximum thread length reached ({maxThreadLength} posts)
          </p>
        )}
      </div>
    </div>
  )
}