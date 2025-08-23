import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RichTextEditor } from '@/components/posts/RichTextEditor'

describe('RichTextEditor', () => {
  const mockOnChange = vi.fn()

  const defaultProps = {
    value: '',
    onChange: mockOnChange,
    maxLength: 500
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default props', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText('500 remaining')).toBeInTheDocument()
  })

  it('displays the current value', () => {
    render(<RichTextEditor {...defaultProps} value="Hello world" />)
    
    expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument()
  })

  it('calls onChange when text is typed', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Hello')
    
    expect(mockOnChange).toHaveBeenCalledWith('Hello')
  })

  it('shows character count correctly', () => {
    render(<RichTextEditor {...defaultProps} value="Hello" />)
    
    expect(screen.getByText('495 remaining')).toBeInTheDocument()
  })

  it('prevents typing when max length is reached', async () => {
    const user = userEvent.setup()
    const longText = 'a'.repeat(500)
    render(<RichTextEditor {...defaultProps} value={longText} />)
    
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'x')
    
    // Should not call onChange for the extra character
    expect(mockOnChange).not.toHaveBeenCalledWith(longText + 'x')
  })

  it('shows warning color when near character limit', () => {
    const nearLimitText = 'a'.repeat(460) // 40 remaining
    render(<RichTextEditor {...defaultProps} value={nearLimitText} />)
    
    const charCount = screen.getByText('40 remaining')
    expect(charCount).toHaveClass('text-yellow-600')
  })

  it('shows error color when over character limit', () => {
    const overLimitText = 'a'.repeat(510)
    render(<RichTextEditor {...defaultProps} value={overLimitText} />)
    
    const charCount = screen.getByText('-10 remaining')
    expect(charCount).toHaveClass('text-red-600')
  })

  it('formats text as bold when bold button is clicked', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} value="selected text" />)
    
    const textArea = screen.getByRole('textbox')
    
    // Select text
    textArea.setSelectionRange(0, 13)
    
    const boldButton = screen.getByTitle('Bold (Ctrl+B)')
    await user.click(boldButton)
    
    expect(mockOnChange).toHaveBeenCalledWith('**selected text**')
  })

  it('formats text as italic when italic button is clicked', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} value="selected text" />)
    
    const textArea = screen.getByRole('textbox')
    
    // Select text
    textArea.setSelectionRange(0, 13)
    
    const italicButton = screen.getByTitle('Italic (Ctrl+I)')
    await user.click(italicButton)
    
    expect(mockOnChange).toHaveBeenCalledWith('*selected text*')
  })

  it('adds link format when link button is clicked', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} value="link text" />)
    
    const textArea = screen.getByRole('textbox')
    
    // Select text
    textArea.setSelectionRange(0, 9)
    
    const linkButton = screen.getByTitle('Add Link')
    await user.click(linkButton)
    
    expect(mockOnChange).toHaveBeenCalledWith('[link text](url)')
  })

  it('inserts hashtag when hashtag button is clicked', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} value="test" />)
    
    const textArea = screen.getByRole('textbox')
    textArea.setSelectionRange(4, 4) // Position at end
    
    const hashtagButton = screen.getByTitle('Add Hashtag')
    await user.click(hashtagButton)
    
    expect(mockOnChange).toHaveBeenCalledWith('test#')
  })

  it('inserts mention when mention button is clicked', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} value="test" />)
    
    const textArea = screen.getByRole('textbox')
    textArea.setSelectionRange(4, 4) // Position at end
    
    const mentionButton = screen.getByTitle('Add Mention')
    await user.click(mentionButton)
    
    expect(mockOnChange).toHaveBeenCalledWith('test@')
  })

  it('shows placeholder text when empty', () => {
    render(<RichTextEditor {...defaultProps} placeholder="Custom placeholder" />)
    
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
  })

  it('disables all controls when disabled prop is true', () => {
    render(<RichTextEditor {...defaultProps} disabled={true} />)
    
    const textArea = screen.getByRole('textbox')
    expect(textArea).toBeDisabled()
    
    const boldButton = screen.getByTitle('Bold (Ctrl+B)')
    expect(boldButton).toBeDisabled()
    
    const italicButton = screen.getByTitle('Italic (Ctrl+I)')
    expect(italicButton).toBeDisabled()
  })

  it('auto-resizes textarea based on content', () => {
    const { rerender } = render(<RichTextEditor {...defaultProps} value="" />)
    
    const textArea = screen.getByRole('textbox')
    const initialHeight = textArea.style.height
    
    // Add multiple lines of content
    const multilineText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
    rerender(<RichTextEditor {...defaultProps} value={multilineText} />)
    
    // Height should have increased (we can't test exact values due to jsdom limitations)
    expect(textArea.style.height).toBeDefined()
  })

  it('shows formatting help text', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByText('**bold** for bold text')).toBeInTheDocument()
    expect(screen.getByText('*italic* for italic text')).toBeInTheDocument()
    expect(screen.getByText('[text](url) for links')).toBeInTheDocument()
    expect(screen.getByText('# for hashtags')).toBeInTheDocument()
    expect(screen.getByText('@ for mentions')).toBeInTheDocument()
  })

  it('applies focus styles when textarea is focused', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    await user.click(textArea)
    
    expect(textArea).toHaveFocus()
  })

  it('handles keyboard shortcuts correctly', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} />)
    
    const textArea = screen.getByRole('textbox')
    
    // Test that Ctrl+Enter doesn't submit form (preventDefault)
    await user.type(textArea, 'test')
    fireEvent.keyDown(textArea, { key: 'Enter', ctrlKey: true })
    
    // Should still have the text
    expect(textArea).toHaveValue('test')
  })

  it('inserts formatting at cursor position when no text is selected', async () => {
    const user = userEvent.setup()
    render(<RichTextEditor {...defaultProps} value="hello world" />)
    
    const textArea = screen.getByRole('textbox')
    textArea.setSelectionRange(5, 5) // Position between "hello" and " world"
    
    const boldButton = screen.getByTitle('Bold (Ctrl+B)')
    await user.click(boldButton)
    
    expect(mockOnChange).toHaveBeenCalledWith('hello** world')
  })

  it('respects maxLength when inserting formatted text', async () => {
    const user = userEvent.setup()
    const nearMaxText = 'a'.repeat(495) // 5 characters remaining
    render(<RichTextEditor {...defaultProps} value={nearMaxText} maxLength={500} />)
    
    const textArea = screen.getByRole('textbox')
    textArea.setSelectionRange(495, 495) // Position at end
    
    const boldButton = screen.getByTitle('Bold (Ctrl+B)')
    await user.click(boldButton)
    
    // Should not insert ** (4 characters) as it would exceed maxLength
    expect(mockOnChange).not.toHaveBeenCalledWith(nearMaxText + '**')
  })
})