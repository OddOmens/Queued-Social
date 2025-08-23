import { useState, useCallback } from 'react'
import { useNetworkStatus } from './useNetworkStatus'
import { withRetry, isNetworkError, ClientError, ErrorCodes } from '@/utils/errorHandling'
import { useToast } from '@/components/Toast'

export interface RetryableActionOptions {
  maxAttempts?: number
  delay?: number
  backoff?: boolean
  showToastOnError?: boolean
  showToastOnSuccess?: boolean
  successMessage?: string
  retryMessage?: string
}

export function useRetryableAction<T = any>(
  action: () => Promise<T>,
  options: RetryableActionOptions = {}
) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = true,
    showToastOnError = true,
    showToastOnSuccess = false,
    successMessage,
    retryMessage
  } = options

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ClientError | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)
  const { isOnline } = useNetworkStatus()
  const { showError, showSuccess, showInfo } = useToast()

  const execute = useCallback(async (): Promise<T | null> => {
    if (!isOnline) {
      const offlineError = new ClientError(
        ErrorCodes.NETWORK_ERROR,
        'You are currently offline. Please check your connection and try again.'
      )
      setError(offlineError)
      if (showToastOnError) {
        showError(offlineError)
      }
      return null
    }

    setIsLoading(true)
    setError(null)
    setAttemptCount(0)

    try {
      const result = await withRetry(
        async () => {
          setAttemptCount(prev => prev + 1)
          return await action()
        },
        {
          maxAttempts,
          delay,
          backoff,
          shouldRetry: (error) => {
            const shouldRetry = isNetworkError(error) && isOnline
            
            if (shouldRetry && retryMessage) {
              showInfo(retryMessage, {
                title: `Retrying... (${attemptCount + 1}/${maxAttempts})`
              })
            }
            
            return shouldRetry
          }
        }
      )

      if (showToastOnSuccess && successMessage) {
        showSuccess(successMessage)
      }

      return result
    } catch (err) {
      const clientError = err instanceof ClientError 
        ? err 
        : new ClientError(ErrorCodes.UNKNOWN_ERROR, err instanceof Error ? err.message : 'Unknown error')
      
      setError(clientError)
      
      if (showToastOnError) {
        showError(clientError, {
          action: isNetworkError(clientError) ? {
            label: 'Retry',
            onClick: () => execute()
          } : undefined
        })
      }
      
      return null
    } finally {
      setIsLoading(false)
    }
  }, [
    action,
    maxAttempts,
    delay,
    backoff,
    isOnline,
    showToastOnError,
    showToastOnSuccess,
    successMessage,
    retryMessage,
    showError,
    showSuccess,
    showInfo,
    attemptCount
  ])

  const retry = useCallback(() => {
    return execute()
  }, [execute])

  const reset = useCallback(() => {
    setError(null)
    setAttemptCount(0)
    setIsLoading(false)
  }, [])

  return {
    execute,
    retry,
    reset,
    isLoading,
    error,
    attemptCount,
    canRetry: error && isNetworkError(error) && isOnline
  }
}