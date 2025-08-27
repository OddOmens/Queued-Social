import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import InteractiveCalendarView from '@/components/calendar/InteractiveCalendarView'
import PostDetailModal from '@/components/calendar/PostDetailModal'
import PostGroupModal from '@/components/calendar/PostGroupModal'
import { ScheduledPost, Platform, PostStatus } from '@/types'

// Mock react-big-calendar
jest.mock('react-big-calendar', () => ({
  Calendar: ({ onSelectEvent, onSelectSlot, onEventDrop, events, ...props }: any) => (
    <div data-testid="interactive-calendar">
      <div data-testid="calendar-events">
        {events.map((event: any) => (
          <div
            key={event.id}
            data-testid={`calendar-event-${event.id}`}
            onClick={() => onSelectEvent(event)}
            onDrop={() => onEventDrop && onEventDrop({ 
              event, 
              start: new Date('2024-01-16T10:00:00Z') 
            })}
          >
            {event.title}
          </div>
        ))}
      </div>
      <div
        data-testid="calendar-slot"
        onClick={() => onSelectSlot({ start: new Date('2024-01-15T10:00:00Z') })}
      >
        Empty Slot
      </div>
    </div>
  ),
  momentLocalizer: () => ({}),
  Views: {
    MONTH: 'month',
    WEEK: 'week',
    DAY: 'day'
  }
}))

// Mock moment
jest.mock('moment', () => {
  const actualMoment = jest.requireActual('moment')
  return {
    ...actualMoment,
    default: actualMoment
  }
})

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    {children}
  </DndProvider>
)

describe('InteractiveCalendarView', () => {
  const mockPosts: ScheduledPost[] = [
    {
      id: '1',
      userId: 'user1',
      platform: 'threads' as Platform,
      content: {
        type: 'single',
        text: 'Single post',
        metadata: {}
      },
      scheduledTime: new Date('2024-01-15T10:00:00Z'),
      status: 'scheduled' as PostStatus,
      createdAt: new Date('2024-01-10T10:00:00Z'),
      updatedAt: new Date('2024-01-10T10:00:00Z')
    },
    // Posts in same time slot (will be grouped)
    {
      id: '2',
      userId: 'user1',
      platform: 'twitter' as Platform,
      content: {
        type: 'single',
        text: 'Grouped post 1',
        metadata: {}
      },
      scheduledTime: new Date('2024-01-16T14:00:00Z'),
      status: 'scheduled' as PostStatus,
      createdAt: new Date('2024-01-10T10:00:00Z'),
      updatedAt: new Date('2024-01-10T10:00:00Z')
    },
    {
      id: '3',
      userId: 'user1',
      platform: 'linkedin' as Platform,
      content: {
        type: 'single',
        text: 'Grouped post 2',
        metadata: {}
      },
      scheduledTime: new Date('2024-01-16T14:15:00Z'), // 15 minutes later (will be grouped)
      status: 'scheduled' as PostStatus,
      createdAt: new Date('2024-01-10T10:00:00Z'),
      updatedAt: new Date('2024-01-10T10:00:00Z')
    }
  ]

  const defaultProps = {
    posts: mockPosts,
    onPostSelect: jest.fn(),
    onPostUpdate: jest.fn(),
    onPostReschedule: jest.fn(),
    onDateSelect: jest.fn(),
    view: 'month' as const,
    onViewChange: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders interactive calendar with posts', () => {
    render(
      <TestWrapper>
        <InteractiveCalendarView {...defaultProps} />
      </TestWrapper>
    )
    
    expect(screen.getByTestId('interactive-calendar')).toBeInTheDocument()
  })

  it('groups posts scheduled within 30 minutes', () => {
    render(
      <TestWrapper>
        <InteractiveCalendarView {...defaultProps} />
      </TestWrapper>
    )
    
    // Should have 2 events: 1 single post + 1 group
    const events = screen.getAllByTestId(/calendar-event-/)
    expect(events).toHaveLength(2)
    
    // One should be a group event
    const groupEvent = events.find(event => 
      event.textContent?.includes('2 posts')
    )
    expect(groupEvent).toBeInTheDocument()
  })

  it('opens post detail modal for single posts', async () => {
    const user = userEvent.setup()
    render(
      <TestWrapper>
        <InteractiveCalendarView {...defaultProps} />
      </TestWrapper>
    )
    
    // Click on single post event
    const singlePostEvent = screen.getByTestId('calendar-event-1')
    await user.click(singlePostEvent)
    
    expect(defaultProps.onPostSelect).toHaveBeenCalledWith(mockPosts[0])
  })

  it('handles post rescheduling via drag and drop', async () => {
    const mockReschedule = jest.fn().mockResolvedValue(undefined)
    render(
      <TestWrapper>
        <InteractiveCalendarView 
          {...defaultProps} 
          onPostReschedule={mockReschedule}
        />
      </TestWrapper>
    )
    
    // Simulate drag and drop
    const event = screen.getByTestId('calendar-event-1')
    fireEvent.drop(event)
    
    await waitFor(() => {
      expect(mockReschedule).toHaveBeenCalledWith(
        '1',
        new Date('2024-01-16T10:00:00Z')
      )
    })
  })

  it('displays loading state', () => {
    render(
      <TestWrapper>
        <InteractiveCalendarView {...defaultProps} loading={true} />
      </TestWrapper>
    )
    
    expect(screen.getByText('Loading calendar...')).toBeInTheDocument()
    expect(screen.queryByTestId('interactive-calendar')).not.toBeInTheDocument()
  })
})

describe('PostDetailModal', () => {
  const mockPost: ScheduledPost = {
    id: '1',
    userId: 'user1',
    platform: 'threads' as Platform,
    content: {
      type: 'single',
      text: 'Test post content',
      metadata: {}
    },
    scheduledTime: new Date('2024-01-15T10:00:00Z'),
    status: 'scheduled' as PostStatus,
    createdAt: new Date('2024-01-10T10:00:00Z'),
    updatedAt: new Date('2024-01-10T10:00:00Z')
  }

  const defaultProps = {
    post: mockPost,
    onClose: jest.fn(),
    onUpdate: jest.fn(),
    onReschedule: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders post details', () => {
    render(<PostDetailModal {...defaultProps} />)
    
    expect(screen.getByText('Post Details')).toBeInTheDocument()
    expect(screen.getByText('Test post content')).toBeInTheDocument()
    expect(screen.getByText('Threads')).toBeInTheDocument()
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
  })

  it('shows reschedule controls for scheduled posts', () => {
    render(<PostDetailModal {...defaultProps} />)
    
    expect(screen.getByText('Reschedule')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('shows retry button for failed posts', () => {
    const failedPost = {
      ...mockPost,
      status: 'failed' as PostStatus,
      errorMessage: 'API error'
    }
    
    render(<PostDetailModal {...defaultProps} post={failedPost} />)
    
    expect(screen.getByText('Retry')).toBeInTheDocument()
    expect(screen.getByText('API error')).toBeInTheDocument()
  })

  it('handles rescheduling', async () => {
    const user = userEvent.setup()
    const mockReschedule = jest.fn().mockResolvedValue(undefined)
    
    render(
      <PostDetailModal 
        {...defaultProps} 
        onReschedule={mockReschedule}
      />
    )
    
    // Click reschedule button
    await user.click(screen.getByText('Reschedule'))
    
    // Should show reschedule form
    expect(screen.getByDisplayValue(/2024-01-15T10:00/)).toBeInTheDocument()
    
    // Change time and save
    const timeInput = screen.getByDisplayValue(/2024-01-15T10:00/)
    await user.clear(timeInput)
    await user.type(timeInput, '2024-01-16T14:00')
    
    await user.click(screen.getByText('Save'))
    
    await waitFor(() => {
      expect(mockReschedule).toHaveBeenCalledWith(
        '1',
        new Date('2024-01-16T14:00:00.000Z')
      )
    })
  })

  it('handles status changes', async () => {
    const user = userEvent.setup()
    const mockUpdate = jest.fn().mockResolvedValue(undefined)
    
    render(
      <PostDetailModal 
        {...defaultProps} 
        onUpdate={mockUpdate}
      />
    )
    
    await user.click(screen.getByText('Cancel'))
    
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('1', { status: 'cancelled' })
    })
  })

  it('displays thread posts correctly', () => {
    const threadPost = {
      ...mockPost,
      content: {
        type: 'thread' as const,
        text: 'Thread starter',
        threadPosts: ['Post 1', 'Post 2', 'Post 3'],
        metadata: {}
      }
    }
    
    render(<PostDetailModal {...defaultProps} post={threadPost} />)
    
    expect(screen.getByText('Thread Posts:')).toBeInTheDocument()
    expect(screen.getByText('Post 1')).toBeInTheDocument()
    expect(screen.getByText('Post 2')).toBeInTheDocument()
    expect(screen.getByText('Post 3')).toBeInTheDocument()
  })
})

describe('PostGroupModal', () => {
  const mockPosts: ScheduledPost[] = [
    {
      id: '1',
      userId: 'user1',
      platform: 'threads' as Platform,
      content: {
        type: 'single',
        text: 'First grouped post',
        metadata: {}
      },
      scheduledTime: new Date('2024-01-15T10:00:00Z'),
      status: 'scheduled' as PostStatus,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      userId: 'user1',
      platform: 'twitter' as Platform,
      content: {
        type: 'single',
        text: 'Second grouped post',
        metadata: {}
      },
      scheduledTime: new Date('2024-01-15T10:15:00Z'),
      status: 'scheduled' as PostStatus,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  const defaultProps = {
    posts: mockPosts,
    onClose: jest.fn(),
    onPostSelect: jest.fn(),
    onUpdate: jest.fn(),
    onReschedule: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders group modal with post list', () => {
    render(<PostGroupModal {...defaultProps} />)
    
    expect(screen.getByText('2 Posts Scheduled')).toBeInTheDocument()
    expect(screen.getByText('First grouped post')).toBeInTheDocument()
    expect(screen.getByText('Second grouped post')).toBeInTheDocument()
  })

  it('shows platform and status summary', () => {
    render(<PostGroupModal {...defaultProps} />)
    
    expect(screen.getByText('Platforms')).toBeInTheDocument()
    expect(screen.getByText('Threads (1)')).toBeInTheDocument()
    expect(screen.getByText('Twitter (1)')).toBeInTheDocument()
    expect(screen.getByText('scheduled (2)')).toBeInTheDocument()
  })

  it('handles post selection', async () => {
    const user = userEvent.setup()
    render(<PostGroupModal {...defaultProps} />)
    
    // Click on first post checkbox
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    
    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument()
  })

  it('handles select all functionality', async () => {
    const user = userEvent.setup()
    render(<PostGroupModal {...defaultProps} />)
    
    await user.click(screen.getByText('Select All'))
    
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument()
    expect(screen.getByText('Deselect All')).toBeInTheDocument()
  })

  it('shows bulk actions when posts are selected', async () => {
    const user = userEvent.setup()
    render(<PostGroupModal {...defaultProps} />)
    
    // Select first post
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    
    expect(screen.getByText('Reschedule Selected')).toBeInTheDocument()
    expect(screen.getByText('Cancel Selected')).toBeInTheDocument()
  })

  it('handles bulk rescheduling', async () => {
    const user = userEvent.setup()
    const mockReschedule = jest.fn().mockResolvedValue(undefined)
    
    render(
      <PostGroupModal 
        {...defaultProps} 
        onReschedule={mockReschedule}
      />
    )
    
    // Select all posts
    await user.click(screen.getByText('Select All'))
    
    // Click reschedule
    await user.click(screen.getByText('Reschedule Selected'))
    
    // Should show reschedule form
    expect(screen.getByText('Reschedule 2 posts')).toBeInTheDocument()
    expect(screen.getByText('Posts will be staggered 5 minutes apart')).toBeInTheDocument()
    
    // Set new time and reschedule
    const timeInput = screen.getByDisplayValue(/2024-01-15T10:00/)
    await user.clear(timeInput)
    await user.type(timeInput, '2024-01-16T14:00')
    
    await user.click(screen.getByText('Reschedule'))
    
    await waitFor(() => {
      expect(mockReschedule).toHaveBeenCalledTimes(2)
      // First post at exact time
      expect(mockReschedule).toHaveBeenNthCalledWith(
        1, '1', new Date('2024-01-16T14:00:00.000Z')
      )
      // Second post 5 minutes later
      expect(mockReschedule).toHaveBeenNthCalledWith(
        2, '2', new Date('2024-01-16T14:05:00.000Z')
      )
    })
  })

  it('navigates to individual post details', async () => {
    const user = userEvent.setup()
    render(<PostGroupModal {...defaultProps} />)
    
    await user.click(screen.getAllByText('View Details')[0])
    
    expect(defaultProps.onPostSelect).toHaveBeenCalledWith(mockPosts[0])
  })
})

describe('Calendar Integration Features', () => {
  it('handles real-time updates correctly', async () => {
    const { rerender } = render(
      <TestWrapper>
        <InteractiveCalendarView {...defaultProps} />
      </TestWrapper>
    )
    
    // Initial render with 3 posts
    expect(screen.getAllByTestId(/calendar-event-/)).toHaveLength(2) // 1 single + 1 group
    
    // Add new post
    const updatedPosts = [
      ...mockPosts,
      {
        id: '4',
        userId: 'user1',
        platform: 'instagram' as Platform,
        content: { type: 'single' as const, text: 'New post', metadata: {} },
        scheduledTime: new Date('2024-01-17T10:00:00Z'),
        status: 'scheduled' as PostStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
    
    rerender(
      <TestWrapper>
        <InteractiveCalendarView {...defaultProps} posts={updatedPosts} />
      </TestWrapper>
    )
    
    // Should now have 3 events
    expect(screen.getAllByTestId(/calendar-event-/)).toHaveLength(3)
  })

  it('handles empty posts array gracefully', () => {
    render(
      <TestWrapper>
        <InteractiveCalendarView {...defaultProps} posts={[]} />
      </TestWrapper>
    )
    
    expect(screen.getByTestId('interactive-calendar')).toBeInTheDocument()
    expect(screen.queryByTestId(/calendar-event-/)).not.toBeInTheDocument()
  })
})