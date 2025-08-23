import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NetworkStatus, ConnectionIndicator } from '@/components/NetworkStatus'
import { ToastProvider } from '@/components/Toast'

// Mock the network status hooks
const mockNetworkStatus = {
  isOnline: true,
  isSlowConnection: false,
  connectionType: 'wifi',
  effectiveType: '4g'
}

const mockOfflineDetection = {
  isOnline: true,
  wasOffline: false,
  justCameOnline: false
}

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => mockNetworkStatus,
  useOfflineDetection: () => mockOfflineDetection
}))

function renderWithToastProvider(component: React.ReactElement) {
  return render(
    <ToastProvider>
      {component}
    </ToastProvider>
  )
}

describe('NetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNetworkStatus.isOnline = true
    mockNetworkStatus.isSlowConnection = false
    mockOfflineDetection.isOnline = true
    mockOfflineDetection.justCameOnline = false
  })

  it('should not render when online', () => {
    renderWithToastProvider(<NetworkStatus />)
    
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
  })

  it('should render offline banner when offline', () => {
    mockNetworkStatus.isOnline = false
    mockOfflineDetection.isOnline = false
    
    renderWithToastProvider(<NetworkStatus />)
    
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument()
  })

  it('should show reconnection toast when coming back online', () => {
    mockOfflineDetection.justCameOnline = true
    
    renderWithToastProvider(<NetworkStatus />)
    
    // Toast should appear
    expect(screen.getByText('Back Online')).toBeInTheDocument()
    expect(screen.getByText('Connection restored')).toBeInTheDocument()
  })

  it('should not show reconnection toast when disabled', () => {
    mockOfflineDetection.justCameOnline = true
    
    renderWithToastProvider(<NetworkStatus showToastOnReconnect={false} />)
    
    expect(screen.queryByText('Back Online')).not.toBeInTheDocument()
  })

  it('should show slow connection warning', () => {
    mockNetworkStatus.isSlowConnection = true
    
    renderWithToastProvider(<NetworkStatus />)
    
    expect(screen.getByText('Slow Connection')).toBeInTheDocument()
    expect(screen.getAllByText(/slow connection/i)).toHaveLength(2) // Title and message
  })
})

describe('ConnectionIndicator', () => {
  beforeEach(() => {
    mockNetworkStatus.isOnline = true
    mockNetworkStatus.isSlowConnection = false
    mockNetworkStatus.effectiveType = '4g'
  })

  it('should show green indicator when online', () => {
    render(<ConnectionIndicator />)
    
    const indicator = document.querySelector('.bg-green-500')
    expect(indicator).toBeInTheDocument()
  })

  it('should show red indicator when offline', () => {
    mockNetworkStatus.isOnline = false
    
    render(<ConnectionIndicator />)
    
    const indicator = document.querySelector('.bg-red-500')
    expect(indicator).toBeInTheDocument()
  })

  it('should show yellow indicator for slow connection', () => {
    mockNetworkStatus.isSlowConnection = true
    
    render(<ConnectionIndicator />)
    
    const indicator = document.querySelector('.bg-yellow-500')
    expect(indicator).toBeInTheDocument()
  })

  it('should show animation when offline', () => {
    mockNetworkStatus.isOnline = false
    
    render(<ConnectionIndicator />)
    
    const animation = document.querySelector('.animate-ping')
    expect(animation).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(<ConnectionIndicator className="custom-class" />)
    
    const container = document.querySelector('.custom-class')
    expect(container).toBeInTheDocument()
  })

  it('should show tooltip with connection info', () => {
    render(<ConnectionIndicator />)
    
    const indicator = document.querySelector('[title]')
    expect(indicator).toHaveAttribute('title', 'Online (4g)')
  })

  it('should show offline tooltip when offline', () => {
    mockNetworkStatus.isOnline = false
    
    render(<ConnectionIndicator />)
    
    const indicator = document.querySelector('[title]')
    expect(indicator).toHaveAttribute('title', 'Offline')
  })

  it('should show slow connection tooltip', () => {
    mockNetworkStatus.isSlowConnection = true
    mockNetworkStatus.effectiveType = '2g'
    
    render(<ConnectionIndicator />)
    
    const indicator = document.querySelector('[title]')
    expect(indicator).toHaveAttribute('title', 'Slow connection (2g)')
  })
})