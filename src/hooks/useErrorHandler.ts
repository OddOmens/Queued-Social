import { useCallback, useState } from 'react'
import { ClientError, ErrorCodes, getErrorMessage, isNetworkError, withRetry } from '@/utils/errorHandling'

export interface ErrorState {
  error: ClientError | null
  isLoading: boolean
}

export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isLoading: false
  })

  const clearError = useCallback(() => {
    setErrorState(prev => ({ ...prev, error: null }))
  }, [])

  const setError = useCallback((error: unknown) => {
    const clientError = error instanceof ClientError 
      ? error 
      : new ClientError(ErrorCodes.UNKNOWN_ERROR, getErrorMessage(error))
    
    setErrorState(prev => ({ ...prev, error: clientError, isLoading: false }))
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setErrorState(prev => ({ ...prev, isLoading: loading }))
  }, [])

  const executeWithErrorHandling = useCallback(async <T>(
    fn: () => Promise<T>,
    options?: {
      showLoading?: boolean
      retryOptions?: {
        maxAttempts: number
        delay: number
      }
    }
  ): Promise<T | null> => {
    try {
      if (options?.showLoading) {
        setLoading(true)
      }
      
      clearError()

      if (options?.retryOptions) {
        return await withRetry(fn, {
          ...options.retryOptions,
          shouldRetry: isNetworkError
        })
      }

      return await fn()
    } catch (error) {
      setError(error)
      return null
    } finally {
      if (options?.showLoading) {
        setLoading(false)
      }
    }
  }, [clearError, setError, setLoading])

  return {
    error: errorState.error,
    isLoading: errorState.isLoading,
    setError,
    clearError,
    setLoading,
    executeWithErrorHandling
  }
}

export function useApiCall() {
  const { executeWithErrorHandling, ...errorHandler } = useErrorHandler()

  const apiCall = useCallback(async <T>(
    url: string,
    options?: RequestInit
  ): Promise<T | null> => {
    return executeWithErrorHandling(async () => {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        },
        ...options
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          // Response might not be JSON
        }
        
        throw new ClientError(
          response.status === 401 ? ErrorCodes.AUTH_REQUIRED :
          response.status === 403 ? ErrorCodes.AUTH_INVALID :
          response.status === 422 ? ErrorCodes.VALIDATION_ERROR :
          response.status === 429 ? ErrorCodes.RATE_LIMIT_EXCEEDED :
          response.status >= 500 ? ErrorCodes.SERVER_ERROR :
          ErrorCodes.UNKNOWN_ERROR,
          errorData?.message || `HTTP ${response.status}`,
          { statusCode: response.status, errors: errorData?.errors },
          response.status
        )
      }

      return response.json()
    }, {
      showLoading: true,
      retryOptions: {
        maxAttempts: 3,
        delay: 1000
      }
    })
  }, [executeWithErrorHandling])

  return {
    apiCall,
    ...errorHandler
  }
}