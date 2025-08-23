import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/Toast'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'

// Test component that uses the toast hook
function TestComponent() {
  const { showError, showSuccess, showWarning, showInfo, clearAll } = useToast()

  return (
    <div>
      <button onClick={() => showSuccess('Success message')}>Show Success</button>
      <button onClick={() => showError('Error message')}>Show Error</button>
      <button onClick={() => showWarning('Warning message')}>Show Warning</button>
      <button onClick={() => showInfo('Info message')}>Show Info</button>
      <button onClick={() => showError(new ClientError(ErrorCodes.AUTH_REQUIRED, 'Auth error'))}>
        Show Auth Error
      </button>
      <button onClick={clearAll}>Clear All</button>
    </div>
  )
}

function renderWithToastProvider(component: React.ReactElement) {
  return render(
    <ToastProvider>
      {component}
    </ToastProvider>
  )
}

describe('Toast System', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should show success toast', () => {
    renderWithToastProvider(<TestComponent />)
    
    fireEvent.click(screen.getByText('Show Success'))
    
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  it('should show error toast', () => {
    renderWithToastProvider(<TestComponent />)
    
    fireEvent.click(screen.getByText('Show Error'))
    
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('should show warning toast', () => {
    renderWithToastProvider(<TestComponent />)
    
    fireEvent.click(screen.getByText('Show Warning'))
    
    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.getByText('Warning message')).toBeInTheDocument()
  })

  it('should show info toast', () => {
    renderWithToastProvider(<TestComponent />)
    
    fireEvent.click(screen.getByText('Show Info'))
    
    expect(screen.getByText('Info')).toBeInTheDocument()
    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('should customize error title based on error type', () => {
    renderWithToastProvider(<TestComponent />)
    
    fireEvent.click(screen.getByText('Show Auth Error'))
    
    expect(screen.getByText('Authentication Required')).toBeInTheDocument()
    expect(screen.getByText('Auth error')).toBeInTheDocument()
  })

  it('should remove toast when close button is clicked', () => {
    renderWithToastProvider(<TestComponent />)
    
    fireEvent.click(screen.getByText('Show Success'))
    expect(screen.getByText('Success message')).toBeInTheDocument()
    
    const closeButton = screen.getByRole('button', { name: /close notification/i })
    fireEvent.click(closeButton)
    
    expect(screen.queryByText('Success message')).not.toBeInTheDocument()
  })

  it('should auto-remove toast after duration', async () => {
    renderWithToastProvider(<TestComponent />)
    
    fireEvent.click(screen.getByText('Show Success'))
    expect(screen.getByText('Success message')).toBeInTheDocument()
    
    // Fast-forward time
    vi.advanceTimersByTime(5000)
    
    await waitFor(() => {
      expect(screen.queryByText('Success message')).not.toBeInTheDocument()
    })
  })

  it('should clear all toasts', () => {
    renderWithToastProvider(<TestComponent />)
    
    fireEvent.click(screen.getByText('Show Success'))
    fireEvent.click(screen.getByText('Show Error'))
    
    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Clear All'))
    
    expect(screen.queryByText('Success message')).not.toBeInTheDocument()
    expect(screen.queryByText('Error message')).not.toBeInTheDocument()
  })

  it('should limit number of toasts', () => {
    render(
      <ToastProvider maxToasts={2}>
        <TestComponent />
      </ToastProvider>
    )
    
    fireEvent.click(screen.getByText('Show Success'))
    fireEvent.click(screen.getByText('Show Error'))
    fireEvent.click(screen.getByText('Show Warning'))
    
    // Should only show 2 toasts (most recent)
    expect(screen.queryByText('Success message')).not.toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
    expect(screen.getByText('Warning message')).toBeInTheDocument()
  })

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useToast must be used within a ToastProvider')
    
    consoleSpy.mockRestore()
  })
})