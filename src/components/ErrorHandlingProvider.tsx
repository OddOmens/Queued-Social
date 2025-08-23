'use client'

import React, { createContext, useContext, useCallback, useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { ErrorRecovery } from './ErrorRecovery'
import { NetworkStatus } from './NetworkStatus'
import { Toast, ToastProvider } from './Toast'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'
import { useErrorHandler } from '@/hooks/useErrorHandler'

interface ErrorHandlingContextType {
  reportError: (error: unknown, context?: string) => void
  clearError: () => void
  currentError: ClientError | null
  isLoading: boolean
}

const ErrorHandlingContext = createContext<ErrorHandlingContextType | null>(null)

export function useErrorHandling() {
  const context = useContext(ErrorHandlingContext)
  if (!context) {
    throw new Error('useErrorHandling must be used within ErrorHandlingProvider')
  }
  return context
}

interface ErrorHandlingProviderProps {
  children: React.ReactNode
  showNetworkStatus?: boolean
  enableGlobalErrorReporting?: boolean
}

export function ErrorHandlingProvider({ 
  children, 
  showNetworkStatus = true,
  enableGlobalErrorReporting = true 
}: ErrorHandlingProviderProps) {
  const { error, isLoading, setError, clearError } = useErrorHandler()
  const [globalError, setGlobalError] = useState<ClientError | null>(null)

  const reportError = useCallback((error: unknown, context?: string) => {
    const clientError = error instanceof ClientError 
      ? error 
      : new ClientError(
          ErrorCodes.UNKNOWN_ERROR, 
          error instanceof Error ? error.message : 'Unknown error',
          { context }
        )
    
    setError(clientError)
    setGlobalError(clientError)
    
    // Log error for debugging
    console.error('Error reported:', clientError, { context })
  }, [setError])

  const handleClearError = useCallback(() => {
    clearError()
    setGlobalError(null)
  }, [clearError])

  const handleGlobalError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    if (enableGlobalErrorReporting) {
      reportError(error, 'React Error Boundary')
    }
  }, [reportError, enableGlobalErrorReporting])

  const contextValue: ErrorHandlingContextType = {
    reportError,
    clearError: handleClearError,
    currentError: error || globalError,
    isLoading
  }

  return (
    <ToastProvider>
      <ErrorHandlingContext.Provider value={contextValue}>
        <ErrorBoundary onError={handleGlobalError}>
          {showNetworkStatus && <NetworkStatus />}
          
          {/* Global error display */}
          {globalError && (
            <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto">
              <ErrorRecovery
                error={globalError}
                onDismiss={handleClearError}
                showDetails={process.env.NODE_ENV === 'development'}
              />
            </div>
          )}
          
          {children}
        </ErrorBoundary>
      </ErrorHandlingContext.Provider>
    </ToastProvider>
  )
}

// Higher-order component for wrapping components with error handling
export function withErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>
    onError?: (error: Error) => void
  }
) {
  return function WrappedComponent(props: P) {
    const { reportError } = useErrorHandling()
    
    const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
      reportError(error, `Component: ${Component.displayName || Component.name}`)
      options?.onError?.(error)
    }, [reportError])

    const fallback = options?.fallback ? (
      <options.fallback 
        error={new Error('Component error')} 
        retry={() => window.location.reload()} 
      />
    ) : undefined

    return (
      <ErrorBoundary onError={handleError} fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

// Hook for handling async operations with error reporting
export function useAsyncErrorHandler() {
  const { reportError } = useErrorHandling()
  
  return useCallback(async (
    operation: () => Promise<any>,
    context?: string
  ) => {
    try {
      return await operation()
    } catch (error) {
      reportError(error, context)
      return null
    }
  }, [reportError])
}