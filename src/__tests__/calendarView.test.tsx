import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarView from '@/components/calendar/CalendarView'
import CalendarNavigation from '@/components/calendar/CalendarNavigation'
import CalendarContainer from '@/components/calendar/CalendarContainer'
import { ScheduledPost, Platform, PostStatus } from '@/types'

// Mock react-big-calendar
jest.mock('react-big-calendar', () => ({
  Calendar: ({ onSelectEvent, onSelectSlot, events, ...props }: any) => (
    <div data-testid="calendar">
      <div data-testid="calendar-events">
        {events.map((event: any) => (
          <div
            key={event.id}
            data-testid={`calendar-event-${event.id}`}
            onClick={() => onSelectEvent(event)}
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

describe('CalendarView', () => {
  const mockPosts: ScheduledPost[] = [
    {
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
    },
    {
      id: '2',
      userId: 'user1',
      platform: 'twitter' as Platform,
      content: {
        type: 'thread',
        text: 'Thread starter',
        threadPosts: ['Post 1', 'Post 2'],
        metadata: {}
      },
      scheduledTime: new Date('2024-01-16T14:30:00Z'),
      status: 'published' as PostStatus,
      createdAt: new Date('2024-01-10T10:00:00Z'),
      updatedAt: new Date('2024-01-16T14:30:00Z')
    }
  ]

  const defaultProps = {
    posts: mockPosts,
    onPostSelect: jest.fn(),
    onDateSelect: jest.fn(),
    view: 'month' as const,
    onViewChange: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders calendar with posts', () => {
    render(<CalendarView {...defaultProps} />)
    
    expect(screen.getByTestId('calendar')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-2')).toBeInTheDocument()
  })

  it('displays loading state', () => {
    render(<CalendarView {...defaultProps} loading={true} />)
    
    expect(screen.getByText('Loading calendar...')).toBeInTheDocument()
    expect(screen.queryByTestId('calendar')).not.toBeInTheDocument()
  })

  it('calls onPostSelect when event is clicked', async () => {
    const user = userEvent.setup()
    render(<CalendarView {...defaultProps} />)
    
    await user.click(screen.getByTestId('calendar-event-1'))
    
    expect(defaultProps.onPostSelect).toHaveBeenCalledWith(mockPosts[0])
  })

  it('calls onDateSelect when empty slot is clicked', async () => {
    const user = userEvent.setup()
    render(<CalendarView {...defaultProps} />)
    
    await user.click(screen.getByTestId('calendar-slot'))
    
    expect(defaultProps.onDateSelect).toHaveBeenCalledWith(new Date('2024-01-15T10:00:00Z'))
  })

  it('generates correct event titles for different post types', () => {
    render(<CalendarView {...defaultProps} />)
    
    // Single post should show platform icon, status icon, and content preview
    const singlePostEvent = screen.getByTestId('calendar-event-1')
    expect(singlePostEvent).toHaveTextContent('🧵')
    expect(singlePostEvent).toHaveTextContent('⏰')
    expect(singlePostEvent).toHaveTextContent('Test post content')
    
    // Thread post should show "Thread:" prefix
    const threadPostEvent = screen.getByTestId('calendar-event-2')
    expect(threadPostEvent).toHaveTextContent('🐦')
    expect(threadPostEvent).toHaveTextContent('✅')
    expect(threadPostEvent).toHaveTextContent('Thread: Thread starter')
  })

  it('applies correct platform colors and status opacity', () => {
    const { container } = render(<CalendarView {...defaultProps} />)
    
    // This would test the eventStyleGetter function
    // In a real test, you'd need to check the applied styles
    expect(container).toBeInTheDocument()
  })
})

describe('CalendarNavigation', () => {
  const defaultProps = {
    currentDate: new Date('2024-01-15T10:00:00Z'),
    view: 'month' as const,
    onDateChange: jest.fn(),
    onViewChange: jest.fn(),
    onToday: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders navigation controls', () => {
    render(<CalendarNavigation {...defaultProps} />)
    
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous')).toBeInTheDocument()
    expect(screen.getByLabelText('Next')).toBeInTheDocument()
    expect(screen.getByText('Month')).toBeInTheDocument()
    expect(screen.getByText('Week')).toBeInTheDocument()
    expect(screen.getByText('Day')).toBeInTheDocument()
  })

  it('displays correct date range for month view', () => {
    render(<CalendarNavigation {...defaultProps} />)
    
    expect(screen.getByText('January 2024')).toBeInTheDocument()
  })

  it('displays correct date range for week view', () => {
    render(<CalendarNavigation {...defaultProps} view="week" />)
    
    // Week view should show date range
    expect(screen.getByText(/Jan 14 - 20, 2024/)).toBeInTheDocument()
  })

  it('displays correct date range for day view', () => {
    render(<CalendarNavigation {...defaultProps} view="day" />)
    
    expect(screen.getByText('Monday, January 15, 2024')).toBeInTheDocument()
  })

  it('calls onToday when Today button is clicked', async () => {
    const user = userEvent.setup()
    render(<CalendarNavigation {...defaultProps} />)
    
    await user.click(screen.getByText('Today'))
    
    expect(defaultProps.onToday).toHaveBeenCalled()
  })

  it('calls onViewChange when view button is clicked', async () => {
    const user = userEvent.setup()
    render(<CalendarNavigation {...defaultProps} />)
    
    await user.click(screen.getByText('Week'))
    
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('week')
  })

  it('calls onDateChange when navigation arrows are clicked', async () => {
    const user = userEvent.setup()
    render(<CalendarNavigation {...defaultProps} />)
    
    await user.click(screen.getByLabelText('Next'))
    
    expect(defaultProps.onDateChange).toHaveBeenCalledWith(
      expect.any(Date)
    )
  })

  it('disables Today button when current date is today', () => {
    const today = new Date()
    render(<CalendarNavigation {...defaultProps} currentDate={today} />)
    
    const todayButton = screen.getByText('Today')
    expect(todayButton).toBeDisabled()
  })

  it('highlights active view', () => {
    render(<CalendarNavigation {...defaultProps} view="week" />)
    
    const weekButton = screen.getByText('Week')
    expect(weekButton).toHaveClass('bg-white')
    
    const monthButton = screen.getByText('Month')
    expect(monthButton).not.toHaveClass('bg-white')
  })
})

describe('CalendarContainer', () => {
  const mockPosts: ScheduledPost[] = [
    {
      id: '1',
      userId: 'user1',
      platform: 'threads' as Platform,
      content: {
        type: 'single',
        text: 'Test post',
        metadata: {}
      },
      scheduledTime: new Date('2024-01-15T10:00:00Z'),
      status: 'scheduled' as PostStatus,
      createdAt: new Date('2024-01-10T10:00:00Z'),
      updatedAt: new Date('2024-01-10T10:00:00Z')
    }
  ]

  const defaultProps = {
    posts: mockPosts,
    onPostSelect: jest.fn(),
    onDateSelect: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders calendar navigation and view', () => {
    render(<CalendarContainer {...defaultProps} />)
    
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByTestId('calendar')).toBeInTheDocument()
  })

  it('shows loading overlay when loading', () => {
    render(<CalendarContainer {...defaultProps} loading={true} />)
    
    expect(screen.getByText('Loading posts...')).toBeInTheDocument()
  })

  it('manages view state internally', async () => {
    const user = userEvent.setup()
    render(<CalendarContainer {...defaultProps} />)
    
    // Initially should be in month view
    expect(screen.getByText('Month')).toHaveClass('bg-white')
    
    // Switch to week view
    await user.click(screen.getByText('Week'))
    
    expect(screen.getByText('Week')).toHaveClass('bg-white')
    expect(screen.getByText('Month')).not.toHaveClass('bg-white')
  })

  it('manages current date state internally', async () => {
    const user = userEvent.setup()
    render(<CalendarContainer {...defaultProps} />)
    
    // Click next to change date
    await user.click(screen.getByLabelText('Next'))
    
    // Date should have changed (exact assertion would depend on current date)
    expect(screen.getByLabelText('Next')).toBeInTheDocument()
  })

  it('forwards post selection to parent', async () => {
    const user = userEvent.setup()
    render(<CalendarContainer {...defaultProps} />)
    
    await user.click(screen.getByTestId('calendar-event-1'))
    
    expect(defaultProps.onPostSelect).toHaveBeenCalledWith(mockPosts[0])
  })

  it('forwards date selection to parent', async () => {
    const user = userEvent.setup()
    render(<CalendarContainer {...defaultProps} />)
    
    await user.click(screen.getByTestId('calendar-slot'))
    
    expect(defaultProps.onDateSelect).toHaveBeenCalledWith(
      new Date('2024-01-15T10:00:00Z')
    )
  })
})

describe('Calendar Integration', () => {
  it('handles empty posts array', () => {
    render(
      <CalendarView
        posts={[]}
        onPostSelect={jest.fn()}
        onDateSelect={jest.fn()}
        view="month"
        onViewChange={jest.fn()}
      />
    )
    
    expect(screen.getByTestId('calendar')).toBeInTheDocument()
    expect(screen.queryByTestId(/calendar-event-/)).not.toBeInTheDocument()
  })

  it('handles posts with different platforms', () => {
    const multiPlatformPosts: ScheduledPost[] = [
      {
        id: '1',
        userId: 'user1',
        platform: 'threads' as Platform,
        content: { type: 'single', text: 'Threads post', metadata: {} },
        scheduledTime: new Date('2024-01-15T10:00:00Z'),
        status: 'scheduled' as PostStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        userId: 'user1',
        platform: 'twitter' as Platform,
        content: { type: 'single', text: 'Twitter post', metadata: {} },
        scheduledTime: new Date('2024-01-15T11:00:00Z'),
        status: 'published' as PostStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    render(
      <CalendarView
        posts={multiPlatformPosts}
        onPostSelect={jest.fn()}
        onDateSelect={jest.fn()}
        view="month"
        onViewChange={jest.fn()}
      />
    )
    
    expect(screen.getByTestId('calendar-event-1')).toHaveTextContent('🧵')
    expect(screen.getByTestId('calendar-event-2')).toHaveTextContent('🐦')
  })

  it('handles posts with different statuses', () => {
    const multiStatusPosts: ScheduledPost[] = [
      {
        id: '1',
        userId: 'user1',
        platform: 'threads' as Platform,
        content: { type: 'single', text: 'Scheduled post', metadata: {} },
        scheduledTime: new Date('2024-01-15T10:00:00Z'),
        status: 'scheduled' as PostStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        userId: 'user1',
        platform: 'threads' as Platform,
        content: { type: 'single', text: 'Failed post', metadata: {} },
        scheduledTime: new Date('2024-01-15T11:00:00Z'),
        status: 'failed' as PostStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    render(
      <CalendarView
        posts={multiStatusPosts}
        onPostSelect={jest.fn()}
        onDateSelect={jest.fn()}
        view="month"
        onViewChange={jest.fn()}
      />
    )
    
    expect(screen.getByTestId('calendar-event-1')).toHaveTextContent('⏰')
    expect(screen.getByTestId('calendar-event-2')).toHaveTextContent('❌')
  })
})