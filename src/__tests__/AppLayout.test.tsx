import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import AppLayout from '@/components/layout/AppLayout'

// Mock child components
vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: function MockProtectedRoute({ children }: { children: React.ReactNode }) {
    return <div data-testid="protected-route">{children}</div>
  }
}))

vi.mock('@/components/layout/MainNavigation', () => ({
  default: function MockMainNavigation() {
    return <nav data-testid="main-navigation">Main Navigation</nav>
  }
}))

vi.mock('@/components/ErrorHandlingProvider', () => ({
  ErrorHandlingProvider: function MockErrorHandlingProvider({ children }: { children: React.ReactNode }) {
    return <div data-testid="error-handling-provider">{children}</div>
  }
}))

vi.mock('@/components/Toast', () => ({
  Toast: function MockToast() {
    return <div data-testid="toast">Toast</div>
  }
}))

describe('AppLayout', () => {
  it('renders all layout components', () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    )
    
    expect(screen.getByTestId('protected-route')).toBeInTheDocument()
    expect(screen.getByTestId('main-navigation')).toBeInTheDocument()
    expect(screen.getByTestId('error-handling-provider')).toBeInTheDocument()
    expect(screen.getByTestId('toast')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    )
    
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies correct layout structure', () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    )
    
    const mainElement = screen.getByRole('main')
    expect(mainElement).toHaveClass('max-w-7xl', 'mx-auto', 'py-6')
  })

  it('wraps content in protected route', () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    )
    
    const protectedRoute = screen.getByTestId('protected-route')
    expect(protectedRoute).toContainElement(screen.getByTestId('main-navigation'))
    expect(protectedRoute).toContainElement(screen.getByText('Test Content'))
  })

  it('includes error handling provider', () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    )
    
    const errorProvider = screen.getByTestId('error-handling-provider')
    expect(errorProvider).toContainElement(screen.getByTestId('main-navigation'))
    expect(errorProvider).toContainElement(screen.getByText('Test Content'))
  })
})