'use client'

import React, { useState } from 'react'
import { ClientError, ErrorCodes, isNetworkError } from '@/utils/errorHandling'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useRetryableAction } from '@/hooks/useRetryableAction'

interface ErrorRecoveryProps {
  error: ClientError | Error | null
  onRetry?: () => Promise<void> | void
  onDismiss?: () => void
  className?: string
  showDetails?: boolean
}

export function ErrorRecovery({ 
  error, 
  onRetry, 
  onDismiss, 
  className = '',
  showDetails = false 
}: ErrorRecoveryProps) {
  const [showFullDetails, setShowFullDetails] = useState(false)
  const { isOnline } = useNetworkStatus()
  
  const retryAction = useRetryableAction(
    async () => {
      if (onRetry) {
        await onRetry()
      }
    },
    {
      showToastOnError: false,
      showToastOnSuccess: true,
      successMessage: 'Action completed successfully'
    }
  )

  if (!error) return null

  const isClientError = error instanceof ClientError
  const canRetry = onRetry && (isNetworkError(error) ? isOnline : true)

  const getErrorIcon = () => {
    if (isClientError) {
      switch (error.code) {
        case ErrorCodes.NETWORK_ERROR:
        case ErrorCodes.CONNECTION_ERROR:
        case ErrorCodes.TIMEOUT_ERROR:
          return (
            <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        case ErrorCodes.AUTH_REQUIRED:
        case ErrorCodes.AUTH_EXPIRED:
        case ErrorCodes.AUTH_INVALID:
          return (
            <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          )
        case ErrorCodes.VALIDATION_ERROR:
        case ErrorCodes.INVALID_INPUT:
          return (
            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        default:
          return (
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )
      }
    }

    return (
      <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    )
  }

  const getErrorTitle = () => {
    if (isClientError) {
      switch (error.code) {
        case ErrorCodes.NETWORK_ERROR:
        case ErrorCodes.CONNECTION_ERROR:
          return 'Connection Problem'
        case ErrorCodes.TIMEOUT_ERROR:
          return 'Request Timed Out'
        case ErrorCodes.AUTH_REQUIRED:
        case ErrorCodes.AUTH_EXPIRED:
        case ErrorCodes.AUTH_INVALID:
          return 'Authentication Required'
        case ErrorCodes.VALIDATION_ERROR:
        case ErrorCodes.INVALID_INPUT:
          return 'Invalid Input'
        case ErrorCodes.RATE_LIMIT_EXCEEDED:
          return 'Rate Limit Exceeded'
        case ErrorCodes.SERVER_ERROR:
          return 'Server Error'
        default:
          return 'Error'
      }
    }
    return 'Unexpected Error'
  }

  const getSuggestions = () => {
    if (isClientError) {
      switch (error.code) {
        case ErrorCodes.NETWORK_ERROR:
        case ErrorCodes.CONNECTION_ERROR:
          return [
            'Check your internet connection',
            'Try refreshing the page',
            'Contact support if the problem persists'
          ]
        case ErrorCodes.TIMEOUT_ERROR:
          return [
            'The request took too long to complete',
            'Try again in a moment',
            'Check your connection speed'
          ]
        case ErrorCodes.AUTH_REQUIRED:
        case ErrorCodes.AUTH_EXPIRED:
        case ErrorCodes.AUTH_INVALID:
          return [
            'Please sign in again',
            'Your session may have expired',
            'Check your credentials'
          ]
        case ErrorCodes.VALIDATION_ERROR:
        case ErrorCodes.INVALID_INPUT:
          return [
            'Please check your input',
            'Make sure all required fields are filled',
            'Verify the format of your data'
          ]
        case ErrorCodes.RATE_LIMIT_EXCEEDED:
          return [
            'You\'ve made too many requests',
            'Please wait a moment before trying again',
            'Consider reducing the frequency of your actions'
          ]
        case ErrorCodes.SERVER_ERROR:
          return [
            'There\'s a temporary server issue',
            'Please try again in a few minutes',
            'Contact support if this continues'
          ]
        default:
          return [
            'An unexpected error occurred',
            'Try refreshing the page',
            'Contact support if needed'
          ]
      }
    }
    return [
      'An unexpected error occurred',
      'Try refreshing the page',
      'Contact support if needed'
    ]
  }

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {getErrorIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {getErrorTitle()}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error.message}</p>
          </div>

          {/* Suggestions */}
          <div className="mt-3">
            <h4 className="text-sm font-medium text-red-800">What you can try:</h4>
            <ul className="mt-1 text-sm text-red-700 list-disc list-inside space-y-1">
              {getSuggestions().map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {canRetry && (
              <button
                onClick={() => retryAction.execute()}
                disabled={retryAction.isLoading || !isOnline}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {retryAction.isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Retrying...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </>
                )}
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Dismiss
              </button>
            )}

            {showDetails && (
              <button
                onClick={() => setShowFullDetails(!showFullDetails)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {showFullDetails ? 'Hide' : 'Show'} Details
              </button>
            )}
          </div>

          {/* Error Details */}
          {showDetails && showFullDetails && (
            <div className="mt-4 p-3 bg-red-100 rounded-md">
              <h4 className="text-sm font-medium text-red-800 mb-2">Technical Details:</h4>
              <div className="text-xs text-red-700 font-mono">
                {isClientError && (
                  <div className="space-y-1">
                    <div><strong>Code:</strong> {error.code}</div>
                    {error.statusCode && <div><strong>Status:</strong> {error.statusCode}</div>}
                    {error.details && (
                      <div>
                        <strong>Details:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(error.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
                {error.stack && process.env.NODE_ENV === 'development' && (
                  <div className="mt-2">
                    <strong>Stack Trace:</strong>
                    <pre className="mt-1 whitespace-pre-wrap text-xs">{error.stack}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Network Status Warning */}
          {isNetworkError(error) && !isOnline && (
            <div className="mt-3 p-2 bg-yellow-100 border border-yellow-200 rounded-md">
              <div className="flex items-center">
                <svg className="h-4 w-4 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm text-yellow-800">
                  You&apos;re currently offline. Retry will be available when your connection is restored.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}