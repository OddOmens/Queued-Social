import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostEditor } from '@/components/posts/PostEditor'
import { Platform, PostContent } from '@/types'

// Mock the content validation utility
vi.mock('@/utils/contentValidation', () => ({
  validateContentForPlatform: vi.fn(() => ({
    isValid: true,
    errors: []
  }))
}))

// Mock the media processing utility
vi.mock('@/utils/mediaProcessing', () => ({
  validateMediaForPlatform: vi.fn(() => ({
    isValid: true,
    errors: []
  })),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
  getSupportedExtensions: vi.fn(() => ['.jpg', '.png', '.mp4']),
  processMediaFile: vi.fn(() => Promise.resolve({
    originalFile: new File([''], 'test.jpg'),
    processedUrl: 'blob:test-url',
    metadata: { size: 1000, type: 'image/jpeg', format: 'jpeg' }
  })),
  cleanupMediaUrls: vi.fn()
}))

describe('PostEditor', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    platform: 'threads' as Platform,
    onSave: mockOnSave,
    onCancel: mockOnCancel
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the post editor with basic elements', () => {
    render(<PostEditor {...defaultProps} />)
    
    expect(screen.getByText('Create Post for Threads')).toBeInTheDocument()
    expect(screen.getByLabelText(/post content/i)).toBeInTheDocument()
    expect(screen.getByText('Schedule Post')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('shows content type selection for platforms that support multiple types', () => {
    render(<PostEditor {...defaultProps} />)
    
    expect(screen.getByText('Post Type')).toBeInTheDocument()
    expect(screen.getByLabelText('single')).toBeInTheDocument()
    expect(screen.getByLabelText('thread')).toBeInTheDocument()
    expect(screen.getByLabelText('media')).toBeInTheDocument()
  })

  it('updates text content when typing', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Hello world!')
    
    expect(textArea).toHaveValue('Hello world!')
  })

  it('shows character count', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Hello')
    
    expect(screen.getByText('5 / 500 characters')).toBeInTheDocument()
  })

  it('switches to thread mode and shows thread composer', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const threadRadio = screen.getByLabelText('thread')
    await user.click(threadRadio)
    
    expect(screen.getByText('Thread Posts')).toBeInTheDocument()
    expect(screen.getByText(/1/)).toBeInTheDocument() // Thread post number
  })

  it('switches to media mode and shows media upload', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const mediaRadio = screen.getByLabelText('media')
    await user.click(mediaRadio)
    
    expect(screen.getByText('Caption')).toBeInTheDocument()
    expect(screen.getByText('Media Files')).toBeInTheDocument()
  })

  it('shows scheduling options', () => {
    render(<PostEditor {...defaultProps} />)
    
    expect(screen.getByText('Scheduling')).toBeInTheDocument()
    expect(screen.getByLabelText(/next available time slot/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/custom time/i)).toBeInTheDocument()
  })

  it('shows custom time input when custom scheduling is selected', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const customRadio = screen.getByLabelText(/custom time/i)
    await user.click(customRadio)
    
    expect(screen.getByDisplayValue('')).toBeInTheDocument() // datetime-local input
  })

  it('disables submit button when form is invalid', () => {
    render(<PostEditor {...defaultProps} />)
    
    const submitButton = screen.getByText('Schedule Post')
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when form is valid', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Valid post content')
    
    const submitButton = screen.getByText('Schedule Post')
    expect(submitButton).toBeEnabled()
  })

  it('calls onSave with correct data when form is submitted', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Test post content')
    
    const submitButton = screen.getByText('Schedule Post')
    await user.click(submitButton)
    
    expect(mockOnSave).toHaveBeenCalledWith({
      content: {
        type: 'single',
        text: 'Test post content',
        metadata: {
          replySettings: 'everyone',
          allowReplies: true
        }
      },
      platform: 'threads',
      schedulingType: 'next-slot',
      customTime: undefined
    })
  })

  it('calls onSave with custom time when custom scheduling is used', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Test post content')
    
    const customRadio = screen.getByLabelText(/custom time/i)
    await user.click(customRadio)
    
    const timeInput = screen.getByDisplayValue('')
    await user.type(timeInput, '2024-12-25T10:00')
    
    const submitButton = screen.getByText('Schedule Post')
    await user.click(submitButton)
    
    expect(mockOnSave).toHaveBeenCalledWith({
      content: {
        type: 'single',
        text: 'Test post content',
        metadata: {
          replySettings: 'everyone',
          allowReplies: true
        }
      },
      platform: 'threads',
      schedulingType: 'custom',
      customTime: new Date('2024-12-25T10:00')
    })
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)
    
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('shows loading state when loading prop is true', () => {
    render(<PostEditor {...defaultProps} loading={true} />)
    
    expect(screen.getByText('Scheduling...')).toBeInTheDocument()
    expect(screen.getByText('Schedule Post')).toBeDisabled()
  })

  it('populates form with initial content', () => {
    const initialContent: PostContent = {
      type: 'single',
      text: 'Initial content',
      metadata: {}
    }
    
    render(<PostEditor {...defaultProps} initialContent={initialContent} />)
    
    expect(screen.getByDisplayValue('Initial content')).toBeInTheDocument()
  })

  it('shows validation errors', async () => {
    const { validateContentForPlatform } = await import('@/utils/contentValidation')
    vi.mocked(validateContentForPlatform).mockReturnValue({
      isValid: false,
      errors: [{ field: 'text', message: 'Content is too long', code: 'CONTENT_TOO_LONG' as any, value: '' }]
    })
    
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Test content')
    
    const submitButton = screen.getByText('Schedule Post')
    await user.click(submitButton)
    
    expect(screen.getByText('Content is too long')).toBeInTheDocument()
  })

  it('handles thread content type correctly', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const threadRadio = screen.getByLabelText('thread')
    await user.click(threadRadio)
    
    // Add content to main post
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Main thread post')
    
    const submitButton = screen.getByText('Schedule Post')
    await user.click(submitButton)
    
    expect(mockOnSave).toHaveBeenCalledWith({
      content: {
        type: 'thread',
        text: 'Main thread post',
        threadPosts: [],
        metadata: {
          replySettings: 'everyone',
          allowReplies: true
        }
      },
      platform: 'threads',
      schedulingType: 'next-slot',
      customTime: undefined
    })
  })

  it('requires media files for media content type', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const mediaRadio = screen.getByLabelText('media')
    await user.click(mediaRadio)
    
    const submitButton = screen.getByText('Schedule Post')
    expect(submitButton).toBeDisabled()
  })

  it('closes editor when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<PostEditor {...defaultProps} />)
    
    const closeButton = screen.getByRole('button', { name: '' }) // SVG close button
    await user.click(closeButton)
    
    expect(mockOnCancel).toHaveBeenCalled()
  })
})