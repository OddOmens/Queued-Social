'use client'

import { useState, useRef, useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
  className?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your post here...',
  maxLength = 500,
  disabled = false,
  className = ''
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    if (newValue.length <= maxLength) {
      onChange(newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle common keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'Enter':
          // Prevent default form submission on Cmd/Ctrl+Enter
          e.preventDefault()
          break
        case 'a':
          // Allow select all
          break
        default:
          // Allow other shortcuts like copy, paste, etc.
          break
      }
    }
  }

  const insertText = (textToInsert: string) => {
    const textarea = textareaRef.current
    if (!textarea || disabled) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = value
    const newValue = currentValue.slice(0, start) + textToInsert + currentValue.slice(end)

    if (newValue.length <= maxLength) {
      onChange(newValue)
      
      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length)
      }, 0)
    }
  }


  const addHashtag = () => {
    insertText('#')
  }

  const addMention = () => {
    insertText('@')
  }

  const remainingChars = maxLength - value.length
  const isNearLimit = remainingChars <= 50
  const isOverLimit = remainingChars < 0

  return (
    <div className={`relative ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border border-gray-600 dark:border-gray-600 border-b-0 rounded-t-md bg-gray-700 dark:bg-gray-700">
        <div className="flex items-center space-x-2">

          <button
            type="button"
            onClick={addHashtag}
            disabled={disabled}
            className="px-2 py-1 text-xs text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 hover:bg-gray-600 dark:hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add Hashtag"
          >
            #
          </button>

          <button
            type="button"
            onClick={addMention}
            disabled={disabled}
            className="px-2 py-1 text-xs text-gray-300 dark:text-gray-300 hover:text-gray-100 dark:hover:text-gray-100 hover:bg-gray-600 dark:hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add Mention"
          >
            @
          </button>
        </div>

        {/* Character Count */}
        <div className={`text-xs ${isOverLimit ? 'text-red-400 dark:text-red-400' : isNearLimit ? 'text-yellow-400 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-400'}`}>
          {remainingChars} remaining
        </div>
      </div>

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-3 border border-gray-600 dark:border-gray-600 bg-gray-800 dark:bg-gray-800 text-white dark:text-white rounded-b-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-700 dark:disabled:bg-gray-700 disabled:cursor-not-allowed ${
          isOverLimit ? 'border-red-400 dark:border-red-400 focus:border-red-500 focus:ring-red-500' : ''
        } ${isFocused ? 'border-t-0' : 'border-t-gray-600 dark:border-t-gray-600'}`}
        style={{ minHeight: '120px' }}
        rows={4}
      />

      {/* Helper Text */}
      <div className="mt-2 text-xs text-gray-400 dark:text-gray-400">
        <div className="flex flex-wrap gap-4">
          <span># for hashtags</span>
          <span>@ for mentions</span>
        </div>
      </div>
    </div>
  )
}