import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ErrorHandlingProvider, useErrorHandling, withErrorHandling, useAsyncErrorHandler } from '@/components/ErrorHandlingProvider'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'

// Mock dependencies
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
  useOfflineDetection: () => ({ isOnline: true, wasOffline: false, justCameOnline: false })
}))

vi.mock('@/hooks/useRetryableAction', () => ({
  useRetryableAction: (action: any) => ({
    execute: action,
    isLoading: false,
    error: null,
    canRetry: true
  })
}))

// Test component that uses error handling
function TestComponent() {
  const { reportError, clearError, currentError } = useErrorHandling()
  
  return (
    <div>
      <button onClick={() => reportError(new Error('Test error'))}>
        Trigger Error
      </button>
      <button onClick={() => reportError(new ClientError(ErrorCodes.AUTH_REQUIRED, 'Auth error'))}>
        Trigger Auth Error
      </button>
      <button onClick={clearError}>
        Clear Error
      </button>
      {currentError && <div data-testid="error-display">{currentError.message}</div>}
    </div>
  )
}

// Test component that throws an error
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Component error')
  }
  return <div>No error</div>
}

// Test component for async error handler
function AsyncTestComponent() {
  const handleAsync = useAsyncErrorHandler()
  const [result, setResult] = React.useState<string | null>(null)
  
  const handleSuccess = async () => {
    const result = await handleAsync(async () => {
      return 'Success!'
    }, 'success operation')
    setResult(result)
  }
  
  const handleFailure = async () => {
    const result = await handleAsync(async () => {
      throw new Error('Async error')
    }, 'failure operation')
    setResult(result)
  }
  
  return (
    <div>
      <button onClick={handleSuccess}>Success Operation</button>
      <button onClick={handleFailure}>Failure Operation</button>
      {result && <div data-testid="async-result">{result}</div>}
    </div>
  )
}

describe('ErrorHandlingProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error to avoid noise in tests
    console.error = vi.fn()
  })

  it('should provide error handling context', () => {
    render(
      <ErrorHandlingProvider>
        <TestComponent />
      </ErrorHandlingProvider>
    )
    
    expect(screen.getByText('Trigger Error')).toBeInTheDocument()
    expect(screen.getByText('Clear Error')).toBeInTheDocument()
  })

  it('should report and display errors', async () => {
    render(
      <ErrorHandlingProvider>
        <TestComponent />
      </ErrorHandlingProvider>
    )
    
    fireEvent.click(screen.getByText('Trigger Error'))
    
    expect(screen.getByTestId('error-display')).toHaveTextContent('Test error')
  })

  it('should handle client errors', async () => {
    render(
      <ErrorHandlingProvider>
        <TestComponent />
      </ErrorHandlingProvider>
    )
    
    fireEvent.click(screen.getByText('Trigger Auth Error'))
    
    expect(screen.getByTestId('error-display')).toHaveTextContent('Auth error')
  })

  it('should clear errors', async () => {
    render(
      <ErrorHandlingProvider>
        <TestComponent />
      </ErrorHandlingProvider>
    )
    
    fireEvent.click(screen.getByText('Trigger Error'))
    expect(screen.getByTestId('error-display')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Clear Error'))
    expect(screen.queryByTestId('error-display')).not.toBeInTheDocument()
  })

  it('should catch component errors with error boundary', () => {
    render(
      <ErrorHandlingProvider enableGlobalErrorReporting={true}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorHandlingProvider>
    )
    
    // Should show error boundary UI
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should not show network status when disabled', () => {
    render(
      <ErrorHandlingProvider showNetworkStatus={false}>
        <TestComponent />
      </ErrorHandlingProvider>
    )
    
    // NetworkStatus should not be rendered
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
  })
})

describe('withErrorHandling HOC', () => {
  beforeEach(() => {
    console.error = vi.fn()
  })

  it('should wrap component with error boundary', () => {
    const WrappedComponent = withErrorHandling(ThrowingComponent)
    
    render(
      <ErrorHandlingProvider>
        <WrappedComponent shouldThrow={false} />
      </ErrorHandlingProvider>
    )
    
    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should catch errors in wrapped component', () => {
    const WrappedComponent = withErrorHandling(ThrowingComponent)
    
    render(
      <ErrorHandlingProvider>
        <WrappedComponent shouldThrow={true} />
      </ErrorHandlingProvider>
    )
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should use custom fallback component', () => {
    const CustomFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
      <div>
        <div>Custom error: {error.message}</div>
        <button onClick={retry}>Custom Retry</button>
      </div>
    )
    
    const WrappedComponent = withErrorHandling(ThrowingComponent, {
      fallback: CustomFallback
    })
    
    render(
      <ErrorHandlingProvider>
        <WrappedComponent shouldThrow={true} />
      </ErrorHandlingProvider>
    )
    
    expect(screen.getByText(/Custom error/)).toBeInTheDocument()
    expect(screen.getByText('Custom Retry')).toBeInTheDocument()
  })
})

describe('useAsyncErrorHandler', () => {
  beforeEach(() => {
    console.error = vi.fn()
  })

  it('should handle successful async operations', async () => {
    render(
      <ErrorHandlingProvider>
        <AsyncTestComponent />
      </ErrorHandlingProvider>
    )
    
    await act(async () => {
      fireEvent.click(screen.getByText('Success Operation'))
    })
    
    expect(screen.getByTestId('async-result')).toHaveTextContent('Success!')
  })

  it('should handle failed async operations', async () => {
    render(
      <ErrorHandlingProvider>
        <AsyncTestComponent />
      </ErrorHandlingProvider>
    )
    
    await act(async () => {
      fireEvent.click(screen.getByText('Failure Operation'))
    })
    
    // Should return null for failed operations
    expect(screen.queryByTestId('async-result')).not.toBeInTheDocument()
  })
})

describe('useErrorHandling hook', () => {
  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = vi.fn()
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useErrorHandling must be used within ErrorHandlingProvider')
    
    console.error = originalError
  })
})