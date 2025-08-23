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

  const formatText = (format: 'bold' | 'italic' | 'link') => {
    const textarea = textareaRef.current
    if (!textarea || disabled) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.slice(start, end)

    let formattedText = ''
    let cursorOffset = 0

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'italic':
        formattedText = `*${selectedText}*`
        cursorOffset = selectedText ? 0 : 1
        break
      case 'link':
        formattedText = selectedText 
          ? `[${selectedText}](url)` 
          : '[link text](url)'
        cursorOffset = selectedText ? formattedText.length - 4 : 1
        break
    }

    const newValue = value.slice(0, start) + formattedText + value.slice(end)
    
    if (newValue.length <= maxLength) {
      onChange(newValue)
      
      // Set cursor position
      setTimeout(() => {
        textarea.focus()
        const newPosition = start + formattedText.length - cursorOffset
        textarea.setSelectionRange(newPosition, newPosition)
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
      <div className="flex items-center justify-between p-2 border border-gray-300 border-b-0 rounded-t-md bg-gray-50">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => formatText('bold')}
            disabled={disabled}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Bold (Ctrl+B)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 4a1 1 0 011-1h3a3 3 0 013 3v1a3 3 0 01-1.5 2.6A3 3 0 0113 12v1a3 3 0 01-3 3H6a1 1 0 01-1-1V4zm2 1v4h2a1 1 0 100-2H7zm0 6v4h3a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button
            type="button"
            onClick={() => formatText('italic')}
            disabled={disabled}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Italic (Ctrl+I)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 2a1 1 0 011 1v1h1a1 1 0 110 2H9.5l-.5 8H10a1 1 0 110 2H7a1 1 0 01-1-1v-1H5a1 1 0 110-2h1.5l.5-8H6a1 1 0 110-2h1V3a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => formatText('link')}
            disabled={disabled}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add Link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <button
            type="button"
            onClick={addHashtag}
            disabled={disabled}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add Hashtag"
          >
            #
          </button>

          <button
            type="button"
            onClick={addMention}
            disabled={disabled}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add Mention"
          >
            @
          </button>
        </div>

        {/* Character Count */}
        <div className={`text-xs ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
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
        className={`w-full px-3 py-3 border border-gray-300 rounded-b-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
          isOverLimit ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
        } ${isFocused ? 'border-t-0' : 'border-t-gray-300'}`}
        style={{ minHeight: '120px' }}
        rows={4}
      />

      {/* Helper Text */}
      <div className="mt-2 text-xs text-gray-500">
        <div className="flex flex-wrap gap-4">
          <span>**bold** for bold text</span>
          <span>*italic* for italic text</span>
          <span>[text](url) for links</span>
          <span># for hashtags</span>
          <span>@ for mentions</span>
        </div>
      </div>
    </div>
  )
}