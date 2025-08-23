import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePathname } from 'next/navigation'
import SettingsLayout from '@/app/settings/layout'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

// Mock AppLayout component
vi.mock('@/components/layout/AppLayout', () => ({
  default: function MockAppLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="app-layout">{children}</div>
  }
}))

const mockUsePathname = vi.mocked(usePathname)

describe('SettingsLayout', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/settings/time-slots')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders settings header', () => {
    render(
      <SettingsLayout>
        <div>Settings Content</div>
      </SettingsLayout>
    )
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Manage your account preferences and configuration')).toBeInTheDocument()
  })

  it('renders all navigation items', () => {
    render(
      <SettingsLayout>
        <div>Settings Content</div>
      </SettingsLayout>
    )
    
    expect(screen.getByText('Time Slots')).toBeInTheDocument()
    expect(screen.getByText('Platforms')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  it('highlights the active navigation item', () => {
    mockUsePathname.mockReturnValue('/settings/platforms')
    render(
      <SettingsLayout>
        <div>Settings Content</div>
      </SettingsLayout>
    )
    
    const platformsLink = screen.getByText('Platforms').closest('a')
    expect(platformsLink).toHaveClass('bg-blue-50', 'text-blue-700')
  })

  it('renders children content', () => {
    render(
      <SettingsLayout>
        <div>Settings Content</div>
      </SettingsLayout>
    )
    
    expect(screen.getByText('Settings Content')).toBeInTheDocument()
  })

  it('applies correct href attributes to navigation links', () => {
    render(
      <SettingsLayout>
        <div>Settings Content</div>
      </SettingsLayout>
    )
    
    const timeSlotsLink = screen.getByText('Time Slots').closest('a')
    const platformsLink = screen.getByText('Platforms').closest('a')
    const profileLink = screen.getByText('Profile').closest('a')
    
    expect(timeSlotsLink).toHaveAttribute('href', '/settings/time-slots')
    expect(platformsLink).toHaveAttribute('href', '/settings/platforms')
    expect(profileLink).toHaveAttribute('href', '/settings/profile')
  })

  it('applies inactive styles to non-active navigation items', () => {
    mockUsePathname.mockReturnValue('/settings/time-slots')
    render(
      <SettingsLayout>
        <div>Settings Content</div>
      </SettingsLayout>
    )
    
    const platformsLink = screen.getByText('Platforms').closest('a')
    expect(platformsLink).toHaveClass('text-gray-600')
    expect(platformsLink).not.toHaveClass('bg-blue-50', 'text-blue-700')
  })

  it('uses grid layout for navigation and content', () => {
    render(
      <SettingsLayout>
        <div>Settings Content</div>
      </SettingsLayout>
    )
    
    const gridContainer = screen.getByText('Settings Content').closest('.grid')
    expect(gridContainer).toHaveClass('grid-cols-1', 'lg:grid-cols-4')
  })
})