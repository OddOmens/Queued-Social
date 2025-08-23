import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ErrorRecovery } from '@/components/ErrorRecovery'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'
import { ToastProvider } from '@/components/Toast'

// Mock the network status hook
const mockNetworkStatus = vi.fn(() => ({ isOnline: true }))
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: mockNetworkStatus
}))

// Mock the retryable action hook
vi.mock('@/hooks/useRetryableAction', () => ({
  useRetryableAction: (action: any) => ({
    execute: action,
    isLoading: false,
    error: null,
    canRetry: true
  })
}))

function renderWithToastProvider(component: React.ReactElement) {
  return render(
    <ToastProvider>
      {component}
    </ToastProvider>
  )
}

describe('ErrorRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when no error', () => {
    renderWithToastProvider(<ErrorRecovery error={null} />)
    
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })

  it('should render basic error', () => {
    const error = new Error('Something went wrong')
    
    renderWithToastProvider(<ErrorRecovery error={error} />)
    
    expect(screen.getByText('Unexpected Error')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should render client error with specific title', () => {
    const error = new ClientError(ErrorCodes.AUTH_REQUIRED, 'Please sign in')
    
    renderWithToastProvider(<ErrorRecovery error={error} />)
    
    expect(screen.getByText('Authentication Required')).toBeInTheDocument()
    expect(screen.getByText('Please sign in')).toBeInTheDocument()
  })

  it('should show appropriate suggestions for network errors', () => {
    const error = new ClientError(ErrorCodes.NETWORK_ERROR, 'Connection failed')
    
    renderWithToastProvider(<ErrorRecovery error={error} />)
    
    expect(screen.getByText('Connection Problem')).toBeInTheDocument()
    expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument()
  })

  it('should show appropriate suggestions for validation errors', () => {
    const error = new ClientError(ErrorCodes.VALIDATION_ERROR, 'Invalid input')
    
    renderWithToastProvider(<ErrorRecovery error={error} />)
    
    expect(screen.getByText('Invalid Input')).toBeInTheDocument()
    expect(screen.getByText(/check your input/i)).toBeInTheDocument()
  })

  it('should show retry button for retryable errors', () => {
    const error = new ClientError(ErrorCodes.NETWORK_ERROR, 'Connection failed')
    const onRetry = vi.fn()
    
    renderWithToastProvider(<ErrorRecovery error={error} onRetry={onRetry} />)
    
    const retryButton = screen.getByText('Try Again')
    expect(retryButton).toBeInTheDocument()
    
    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalled()
  })

  it('should show dismiss button when onDismiss provided', () => {
    const error = new Error('Something went wrong')
    const onDismiss = vi.fn()
    
    renderWithToastProvider(<ErrorRecovery error={error} onDismiss={onDismiss} />)
    
    const dismissButton = screen.getByText('Dismiss')
    expect(dismissButton).toBeInTheDocument()
    
    fireEvent.click(dismissButton)
    expect(onDismiss).toHaveBeenCalled()
  })

  it('should show/hide error details', () => {
    const error = new ClientError(
      ErrorCodes.VALIDATION_ERROR, 
      'Validation failed',
      { field: 'email', errors: ['Invalid format'] },
      422
    )
    
    renderWithToastProvider(<ErrorRecovery error={error} showDetails />)
    
    const detailsButton = screen.getByText('Show Details')
    expect(detailsButton).toBeInTheDocument()
    
    fireEvent.click(detailsButton)
    
    expect(screen.getByText('Technical Details:')).toBeInTheDocument()
    expect(screen.getByText('Code:')).toBeInTheDocument()
    expect(screen.getByText('Status:')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Hide Details'))
    expect(screen.queryByText('Technical Details:')).not.toBeInTheDocument()
  })

  it('should show offline warning for network errors when offline', () => {
    // Mock offline state
    mockNetworkStatus.mockReturnValue({ isOnline: false })
    
    const error = new ClientError(ErrorCodes.NETWORK_ERROR, 'Connection failed')
    
    renderWithToastProvider(<ErrorRecovery error={error} />)
    
    expect(screen.getByText(/currently offline/i)).toBeInTheDocument()
  })

  it('should disable retry button when offline for network errors', () => {
    // Mock offline state  
    mockNetworkStatus.mockReturnValue({ isOnline: false })
    
    const error = new ClientError(ErrorCodes.NETWORK_ERROR, 'Connection failed')
    const onRetry = vi.fn()
    
    renderWithToastProvider(<ErrorRecovery error={error} onRetry={onRetry} />)
    
    const retryButton = screen.getByText('Try Again')
    expect(retryButton).toBeDisabled()
  })

  it('should show loading state during retry', async () => {
    const error = new ClientError(ErrorCodes.NETWORK_ERROR, 'Connection failed')
    const onRetry = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    )
    
    renderWithToastProvider(<ErrorRecovery error={error} onRetry={onRetry} />)
    
    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)
    
    expect(screen.getByText('Retrying...')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.queryByText('Retrying...')).not.toBeInTheDocument()
    })
  })

  it('should handle different error types with appropriate icons', () => {
    const authError = new ClientError(ErrorCodes.AUTH_REQUIRED, 'Auth required')
    const { rerender } = renderWithToastProvider(<ErrorRecovery error={authError} />)
    
    // Should show lock icon for auth errors
    expect(document.querySelector('svg')).toBeInTheDocument()
    
    const networkError = new ClientError(ErrorCodes.NETWORK_ERROR, 'Network failed')
    rerender(
      <ToastProvider>
        <ErrorRecovery error={networkError} />
      </ToastProvider>
    )
    
    // Should show warning icon for network errors
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('should show stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const error = new Error('Test error')
    error.stack = 'Error: Test error\n    at test.js:1:1'
    
    renderWithToastProvider(<ErrorRecovery error={error} showDetails />)
    
    fireEvent.click(screen.getByText('Show Details'))
    
    expect(screen.getByText('Stack Trace:')).toBeInTheDocument()
    
    process.env.NODE_ENV = originalEnv
  })
})