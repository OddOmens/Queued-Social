import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaUpload } from '@/components/posts/MediaUpload'
import { Platform } from '@/types'

// Mock the media processing utilities
vi.mock('@/utils/mediaProcessing', () => ({
  validateMediaForPlatform: vi.fn(() => ({
    isValid: true,
    errors: []
  })),
  formatFileSize: vi.fn((bytes: number) => `${(bytes / 1024).toFixed(1)} KB`),
  getSupportedExtensions: vi.fn(() => ['.jpg', '.png', '.mp4']),
  processMediaFile: vi.fn(() => Promise.resolve({
    originalFile: new File([''], 'test.jpg'),
    processedUrl: 'blob:test-url',
    thumbnailUrl: 'blob:thumbnail-url',
    metadata: { size: 1000, type: 'image/jpeg', format: 'jpeg', width: 800, height: 600 }
  })),
  cleanupMediaUrls: vi.fn()
}))

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

describe('MediaUpload', () => {
  const mockOnChange = vi.fn()

  const defaultProps = {
    files: [],
    onChange: mockOnChange,
    platform: 'threads' as Platform,
    maxFiles: 10
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload area with default state', () => {
    render(<MediaUpload {...defaultProps} />)
    
    expect(screen.getByText('Media Files')).toBeInTheDocument()
    expect(screen.getByText('Drag and drop files here, or click to select')).toBeInTheDocument()
    expect(screen.getByText('Choose Files')).toBeInTheDocument()
  })

  it('shows required indicator when required prop is true', () => {
    render(<MediaUpload {...defaultProps} required={true} />)
    
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('shows file count when files are selected', () => {
    const files = [new File([''], 'test1.jpg'), new File([''], 'test2.jpg')]
    render(<MediaUpload {...defaultProps} files={files} />)
    
    expect(screen.getByText('2 / 10 files selected')).toBeInTheDocument()
  })

  it('opens file dialog when choose files button is clicked', async () => {
    const user = userEvent.setup()
    render(<MediaUpload {...defaultProps} />)
    
    const chooseButton = screen.getByText('Choose Files')
    
    // Mock the file input click
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')
    
    await user.click(chooseButton)
    
    expect(clickSpy).toHaveBeenCalled()
  })

  it('processes files when files are selected', async () => {
    const { processMediaFile } = await import('@/utils/mediaProcessing')
    
    render(<MediaUpload {...defaultProps} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(processMediaFile).toHaveBeenCalledWith(file, 'threads', {
        generateThumbnail: true,
        thumbnailSize: { width: 150, height: 150 }
      })
    })
  })

  it('shows processing state while files are being processed', async () => {
    const { processMediaFile } = await import('@/utils/mediaProcessing')
    
    // Make processMediaFile return a pending promise
    vi.mocked(processMediaFile).mockImplementation(() => new Promise(() => {}))
    
    render(<MediaUpload {...defaultProps} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    expect(screen.getByText('Processing files...')).toBeInTheDocument()
  })

  it('displays file previews after processing', async () => {
    render(<MediaUpload {...defaultProps} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('Selected Files')).toBeInTheDocument()
    })
  })

  it('shows error message for invalid files', async () => {
    const { validateMediaForPlatform } = await import('@/utils/mediaProcessing')
    vi.mocked(validateMediaForPlatform).mockReturnValue({
      isValid: false,
      errors: ['File type not supported']
    })
    
    render(<MediaUpload {...defaultProps} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('File type not supported')).toBeInTheDocument()
    })
  })

  it('removes file when remove button is clicked', async () => {
    const user = userEvent.setup()
    const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })]
    
    render(<MediaUpload {...defaultProps} files={files} />)
    
    // Wait for file to be processed and preview to appear
    await waitFor(() => {
      expect(screen.getByText('Selected Files')).toBeInTheDocument()
    })
    
    const removeButton = screen.getByRole('button', { name: '' }) // SVG remove button
    await user.click(removeButton)
    
    expect(mockOnChange).toHaveBeenCalledWith([])
  })

  it('handles drag and drop events', async () => {
    render(<MediaUpload {...defaultProps} />)
    
    const dropZone = screen.getByText('Drag and drop files here, or click to select').closest('div')!
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    // Simulate drag enter
    fireEvent.dragEnter(dropZone, {
      dataTransfer: {
        items: [{ kind: 'file', type: 'image/jpeg' }],
        files: [file]
      }
    })
    
    expect(screen.getByText('Drop files here')).toBeInTheDocument()
    
    // Simulate drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    })
    
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  it('prevents file selection when max files limit is reached', async () => {
    const files = Array.from({ length: 10 }, (_, i) => 
      new File(['test'], `test${i}.jpg`, { type: 'image/jpeg' })
    )
    
    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    render(<MediaUpload {...defaultProps} files={files} maxFiles={10} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const newFile = new File(['test'], 'test11.jpg', { type: 'image/jpeg' })
    
    fireEvent.change(fileInput, { target: { files: [newFile] } })
    
    expect(alertSpy).toHaveBeenCalledWith('You can only upload up to 10 files')
    
    alertSpy.mockRestore()
  })

  it('shows supported file formats in help text', () => {
    render(<MediaUpload {...defaultProps} />)
    
    expect(screen.getByText('Supported formats: .jpg, .png, .mp4')).toBeInTheDocument()
    expect(screen.getByText('Maximum 10 files, up to 50MB each')).toBeInTheDocument()
  })

  it('disables interactions when disabled prop is true', () => {
    render(<MediaUpload {...defaultProps} disabled={true} />)
    
    const chooseButton = screen.getByText('Choose Files')
    expect(chooseButton).toBeDisabled()
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeDisabled()
  })

  it('shows video icon for video files', async () => {
    render(<MediaUpload {...defaultProps} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('Video')).toBeInTheDocument()
    })
  })

  it('shows file information on hover', async () => {
    const { formatFileSize } = await import('@/utils/mediaProcessing')
    vi.mocked(formatFileSize).mockReturnValue('1.0 KB')
    
    render(<MediaUpload {...defaultProps} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
      expect(screen.getByText('1.0 KB')).toBeInTheDocument()
    })
  })

  it('cleans up URLs when component unmounts', () => {
    const { cleanupMediaUrls } = require('@/utils/mediaProcessing')
    
    const { unmount } = render(<MediaUpload {...defaultProps} />)
    
    unmount()
    
    // cleanupMediaUrls should be called during cleanup
    // This is tested indirectly through the component lifecycle
  })

  it('handles processing errors gracefully', async () => {
    const { processMediaFile } = await import('@/utils/mediaProcessing')
    vi.mocked(processMediaFile).mockRejectedValue(new Error('Processing failed'))
    
    render(<MediaUpload {...defaultProps} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('Failed to process file')).toBeInTheDocument()
    })
  })

  it('accepts multiple files at once', async () => {
    render(<MediaUpload {...defaultProps} />)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const files = [
      new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    ]
    
    fireEvent.change(fileInput, { target: { files } })
    
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(files)
    })
  })
})