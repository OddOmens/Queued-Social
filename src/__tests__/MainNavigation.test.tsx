import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePathname } from 'next/navigation'
import MainNavigation from '@/components/layout/MainNavigation'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

// Mock UserMenu component
vi.mock('@/components/auth/UserMenu', () => ({
  UserMenu: function MockUserMenu() {
    return <div data-testid="user-menu">User Menu</div>
  }
}))

const mockUsePathname = vi.mocked(usePathname)

describe('MainNavigation', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/dashboard')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the brand logo and name', () => {
    render(<MainNavigation />)
    
    expect(screen.getByText('Social Scheduler')).toBeInTheDocument()
  })

  it('renders all navigation items', () => {
    render(<MainNavigation />)
    
    expect(screen.getAllByText('Dashboard')).toHaveLength(2) // Desktop and mobile
    expect(screen.getAllByText('Calendar')).toHaveLength(2)
    expect(screen.getAllByText('Posts')).toHaveLength(2)
    expect(screen.getAllByText('Settings')).toHaveLength(2)
  })

  it('highlights the active navigation item', () => {
    mockUsePathname.mockReturnValue('/calendar')
    render(<MainNavigation />)
    
    const calendarLink = screen.getAllByText('Calendar')[0].closest('a')
    expect(calendarLink).toHaveClass('text-blue-600', 'bg-blue-50')
  })

  it('renders user menu', () => {
    render(<MainNavigation />)
    
    expect(screen.getByTestId('user-menu')).toBeInTheDocument()
  })

  it('renders mobile navigation', () => {
    render(<MainNavigation />)
    
    // Mobile navigation should contain the same items
    const dashboardLinks = screen.getAllByText('Dashboard')
    expect(dashboardLinks).toHaveLength(2) // Desktop and mobile
    
    // Check that mobile navigation exists
    const mobileNav = document.querySelector('.md\\:hidden')
    expect(mobileNav).toBeInTheDocument()
  })

  it('applies correct href attributes to navigation links', () => {
    render(<MainNavigation />)
    
    const dashboardLink = screen.getAllByText('Dashboard')[0].closest('a')
    const calendarLink = screen.getAllByText('Calendar')[0].closest('a')
    const postsLink = screen.getAllByText('Posts')[0].closest('a')
    const settingsLink = screen.getAllByText('Settings')[0].closest('a')
    
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
    expect(calendarLink).toHaveAttribute('href', '/calendar')
    expect(postsLink).toHaveAttribute('href', '/posts')
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })

  it('applies inactive styles to non-active navigation items', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<MainNavigation />)
    
    const calendarLink = screen.getAllByText('Calendar')[0].closest('a')
    expect(calendarLink).toHaveClass('text-gray-600')
    expect(calendarLink).not.toHaveClass('text-blue-600', 'bg-blue-50')
  })
})