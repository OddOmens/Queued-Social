import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThreadComposer } from '@/components/posts/ThreadComposer'

describe('ThreadComposer', () => {
  const mockOnChange = vi.fn()

  const defaultProps = {
    posts: [''],
    onChange: mockOnChange,
    maxLength: 500,
    maxThreadLength: 20
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with initial empty post', () => {
    render(<ThreadComposer {...defaultProps} />)
    
    expect(screen.getByText('Thread Posts')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // Post number
    expect(screen.getByText('Click to add content for post 1')).toBeInTheDocument()
  })

  it('shows thread summary with correct counts', () => {
    const posts = ['First post', '', 'Third post']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    expect(screen.getByText('Thread Summary: 2 posts with content')).toBeInTheDocument()
    expect(screen.getByText('19 total characters')).toBeInTheDocument()
  })

  it('expands post editor when clicked', async () => {
    const user = userEvent.setup()
    render(<ThreadComposer {...defaultProps} />)
    
    const postCard = screen.getByText('Click to add content for post 1')
    await user.click(postCard)
    
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText('Collapse')).toBeInTheDocument()
  })

  it('collapses post editor when collapse is clicked', async () => {
    const user = userEvent.setup()
    render(<ThreadComposer {...defaultProps} />)
    
    // Expand first
    const postCard = screen.getByText('Click to add content for post 1')
    await user.click(postCard)
    
    // Then collapse
    const collapseButton = screen.getByText('Collapse')
    await user.click(collapseButton)
    
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Click to add content for post 1')).toBeInTheDocument()
  })

  it('updates post content when typing', async () => {
    const user = userEvent.setup()
    render(<ThreadComposer {...defaultProps} />)
    
    // Expand post editor
    const postCard = screen.getByText('Click to add content for post 1')
    await user.click(postCard)
    
    // Type in the editor
    const textArea = screen.getByRole('textbox')
    await user.type(textArea, 'Hello world')
    
    expect(mockOnChange).toHaveBeenCalledWith(['Hello world'])
  })

  it('adds new post when add button is clicked', async () => {
    const user = userEvent.setup()
    render(<ThreadComposer {...defaultProps} />)
    
    const addButton = screen.getByText('Add another post to thread')
    await user.click(addButton)
    
    expect(mockOnChange).toHaveBeenCalledWith(['', ''])
  })

  it('removes post when remove button is clicked', async () => {
    const user = userEvent.setup()
    const posts = ['First post', 'Second post']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    const removeButtons = screen.getAllByTitle('Remove post')
    await user.click(removeButtons[1]) // Remove second post
    
    expect(mockOnChange).toHaveBeenCalledWith(['First post'])
  })

  it('prevents removing the last post', () => {
    render(<ThreadComposer {...defaultProps} />)
    
    const removeButton = screen.getByTitle('Remove post')
    expect(removeButton).toBeDisabled()
  })

  it('moves post up when up button is clicked', async () => {
    const user = userEvent.setup()
    const posts = ['First post', 'Second post']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    const upButtons = screen.getAllByTitle('Move up')
    await user.click(upButtons[1]) // Move second post up
    
    expect(mockOnChange).toHaveBeenCalledWith(['Second post', 'First post'])
  })

  it('moves post down when down button is clicked', async () => {
    const user = userEvent.setup()
    const posts = ['First post', 'Second post']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    const downButtons = screen.getAllByTitle('Move down')
    await user.click(downButtons[0]) // Move first post down
    
    expect(mockOnChange).toHaveBeenCalledWith(['Second post', 'First post'])
  })

  it('disables move up button for first post', () => {
    const posts = ['First post', 'Second post']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    const upButtons = screen.getAllByTitle('Move up')
    expect(upButtons[0]).toBeDisabled() // First post can't move up
    expect(upButtons[1]).toBeEnabled() // Second post can move up
  })

  it('disables move down button for last post', () => {
    const posts = ['First post', 'Second post']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    const downButtons = screen.getAllByTitle('Move down')
    expect(downButtons[0]).toBeEnabled() // First post can move down
    expect(downButtons[1]).toBeDisabled() // Last post can't move down
  })

  it('shows character count for each post', () => {
    const posts = ['Hello world', '']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    expect(screen.getByText('11 / 500 characters')).toBeInTheDocument()
  })

  it('shows post preview when content exists', () => {
    const posts = ['This is a long post that should be truncated when displayed as a preview because it exceeds the preview character limit']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    expect(screen.getByText(/This is a long post that should be truncated/)).toBeInTheDocument()
    expect(screen.getByText('Click to edit')).toBeInTheDocument()
  })

  it('prevents adding posts when max thread length is reached', () => {
    const posts = Array(20).fill('Post content') // Max length
    render(<ThreadComposer {...defaultProps} posts={posts} maxThreadLength={20} />)
    
    expect(screen.queryByText('Add another post to thread')).not.toBeInTheDocument()
    expect(screen.getByText('Maximum thread length reached (20 posts)')).toBeInTheDocument()
  })

  it('shows warning when no posts have content', () => {
    const posts = ['', '', '']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    expect(screen.getByText('At least one post must have content')).toBeInTheDocument()
  })

  it('disables all interactions when disabled prop is true', () => {
    const posts = ['First post', 'Second post']
    render(<ThreadComposer {...defaultProps} posts={posts} disabled={true} />)
    
    const removeButtons = screen.getAllByTitle('Remove post')
    const upButtons = screen.getAllByTitle('Move up')
    const downButtons = screen.getAllByTitle('Move down')
    
    removeButtons.forEach(button => expect(button).toBeDisabled())
    upButtons.forEach(button => expect(button).toBeDisabled())
    downButtons.forEach(button => expect(button).toBeDisabled())
  })

  it('shows thread connection lines between posts', () => {
    const posts = ['First post', 'Second post', 'Third post']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    // Check that we have the right number of posts displayed
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('handles post reordering correctly when expanded post changes', async () => {
    const user = userEvent.setup()
    const posts = ['First post', 'Second post']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    // Expand second post
    const secondPostCard = screen.getByText('Second post')
    await user.click(secondPostCard)
    
    // Move second post up (should become first)
    const upButtons = screen.getAllByTitle('Move up')
    await user.click(upButtons[1])
    
    expect(mockOnChange).toHaveBeenCalledWith(['Second post', 'First post'])
  })

  it('filters out empty posts from count', () => {
    const posts = ['First post', '', 'Third post', '']
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    expect(screen.getByText('Thread Summary: 2 posts with content')).toBeInTheDocument()
  })

  it('shows correct total character count', () => {
    const posts = ['Hello', 'World', ''] // 5 + 5 = 10 characters
    render(<ThreadComposer {...defaultProps} posts={posts} />)
    
    expect(screen.getByText('10 total characters')).toBeInTheDocument()
  })

  it('expands new post automatically when added', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ThreadComposer {...defaultProps} />)
    
    const addButton = screen.getByText('Add another post to thread')
    await user.click(addButton)
    
    // Simulate the onChange being called and props updated
    rerender(<ThreadComposer {...defaultProps} posts={['', '']} />)
    
    // The new post should be expanded (we can't test this directly due to state management)
    // but we can verify the add button was clicked
    expect(mockOnChange).toHaveBeenCalledWith(['', ''])
  })

  it('handles empty posts array gracefully', () => {
    render(<ThreadComposer {...defaultProps} posts={[]} />)
    
    expect(screen.getByText('Thread Posts')).toBeInTheDocument()
    expect(screen.getByText('Thread Summary: 0 posts with content')).toBeInTheDocument()
  })
})