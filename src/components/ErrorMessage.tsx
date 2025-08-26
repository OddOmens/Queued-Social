// React import not needed for JSX in modern React
import { ClientError, ErrorCodes } from '@/utils/errorHandling'

interface ErrorMessageProps {
  error: ClientError | Error | string | null
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}

export function ErrorMessage({ error, onRetry, onDismiss, className = '' }: ErrorMessageProps) {
  if (!error) return null

  const getErrorDetails = () => {
    if (error instanceof ClientError) {
      return {
        message: error.message,
        code: error.code,
        canRetry: [
          ErrorCodes.NETWORK_ERROR,
          ErrorCodes.TIMEOUT_ERROR,
          ErrorCodes.CONNECTION_ERROR,
          ErrorCodes.SERVER_ERROR
        ].includes(error.code as any)
      }
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'UNKNOWN_ERROR',
        canRetry: true
      }
    }

    return {
      message: typeof error === 'string' ? error : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      canRetry: true
    }
  }

  const { message, canRetry } = getErrorDetails()

  const getIcon = () => {
    if (error instanceof ClientError) {
      switch (error.code) {
        case ErrorCodes.AUTH_REQUIRED:
        case ErrorCodes.AUTH_EXPIRED:
        case ErrorCodes.AUTH_INVALID:
          return (
            <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          )
        case ErrorCodes.VALIDATION_ERROR:
        case ErrorCodes.INVALID_INPUT:
        case ErrorCodes.REQUIRED_FIELD:
          return (
            <svg className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        default:
          return (
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )
      }
    }

    return (
      <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    )
  }

  return (
    <div className={`rounded-lg bg-red-900/20 border border-red-800 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-200">
            Error
          </h3>
          <div className="mt-2 text-sm text-red-300">
            {message}
          </div>
          {(canRetry && onRetry) || onDismiss ? (
            <div className="mt-4 flex space-x-2">
              {canRetry && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="bg-red-800 px-3 py-2 rounded-lg text-sm font-medium text-red-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Try Again
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="bg-red-800 px-3 py-2 rounded-lg text-sm font-medium text-red-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Dismiss
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

interface InlineErrorProps {
  error: string | null
  className?: string
}

export function InlineError({ error, className = '' }: InlineErrorProps) {
  if (!error) return null

  return (
    <p className={`text-sm text-red-400 mt-2 flex items-center gap-1 ${className}`}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      {error}
    </p>
  )
}