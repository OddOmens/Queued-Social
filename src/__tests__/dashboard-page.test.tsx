import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react-dom/test-utils'
import DashboardPage from '@/app/dashboard/page'

// Mock the AppLayout component
vi.mock('@/components/layout/AppLayout', () => ({
  default: function MockAppLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="app-layout">{children}</div>
  }
}))

// Mock the CalendarContainer component
vi.mock('@/components/calendar', () => ({
  CalendarContainer: function MockCalendarContainer({ className }: { className?: string }) {
    return <div data-testid="calendar-container" className={className}>Calendar</div>
  }
}))

// Mock fetch
global.fetch = vi.fn()

const mockFetch = vi.mocked(fetch)

describe('DashboardPage', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('renders dashboard header', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPosts: 5,
          scheduledToday: 2,
          publishedThisWeek: 3,
          connectedPlatforms: 1,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ posts: [] }),
      } as Response)

    await act(async () => {
      render(<DashboardPage />)
    })

    expect(screen.getByText('Welcome to your Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Manage your social media content and schedule posts across platforms.')).toBeInTheDocument()
  })

  it('renders stats cards with loading state', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPosts: 5,
          scheduledToday: 2,
          publishedThisWeek: 3,
          connectedPlatforms: 1,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ posts: [] }),
      } as Response)

    await act(async () => {
      render(<DashboardPage />)
    })

    // Initially shows loading
    expect(screen.getAllByText('...')).toHaveLength(4)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('renders quick actions', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPosts: 0,
          scheduledToday: 0,
          publishedThisWeek: 0,
          connectedPlatforms: 0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ posts: [] }),
      } as Response)

    await act(async () => {
      render(<DashboardPage />)
    })

    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('Create Post')).toBeInTheDocument()
    expect(screen.getByText('View Calendar')).toBeInTheDocument()
    expect(screen.getByText('Time Slots')).toBeInTheDocument()
    expect(screen.getByText('Connect Platform')).toBeInTheDocument()
  })

  it('renders calendar preview', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPosts: 0,
          scheduledToday: 0,
          publishedThisWeek: 0,
          connectedPlatforms: 0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ posts: [] }),
      } as Response)

    await act(async () => {
      render(<DashboardPage />)
    })

    expect(screen.getByText('Upcoming Posts')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-container')).toBeInTheDocument()
  })

  it('renders recent posts when available', async () => {
    const mockPosts = [
      {
        id: '1',
        content: { text: 'Test post content' },
        scheduledTime: '2024-01-01T10:00:00Z',
        platform: 'threads',
      },
    ]

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPosts: 1,
          scheduledToday: 1,
          publishedThisWeek: 0,
          connectedPlatforms: 1,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ posts: mockPosts }),
      } as Response)

    await act(async () => {
      render(<DashboardPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('Recent Posts')).toBeInTheDocument()
      expect(screen.getByText('Test post content')).toBeInTheDocument()
      expect(screen.getByText('threads')).toBeInTheDocument()
    })
  })

  it('shows empty state when no posts exist', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPosts: 0,
          scheduledToday: 0,
          publishedThisWeek: 0,
          connectedPlatforms: 0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ posts: [] }),
      } as Response)

    await act(async () => {
      render(<DashboardPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('No posts scheduled yet.')).toBeInTheDocument()
      expect(screen.getByText('Create your first post →')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('API Error'))
      .mockRejectedValueOnce(new Error('API Error'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      render(<DashboardPage />)
    })

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch dashboard data:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })
})