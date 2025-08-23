'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearAll: () => void
  showError: (error: ClientError | Error | string, options?: { title?: string; action?: Toast['action'] }) => string
  showSuccess: (message: string, options?: { title?: string; action?: Toast['action'] }) => string
  showWarning: (message: string, options?: { title?: string; action?: Toast['action'] }) => string
  showInfo: (message: string, options?: { title?: string; action?: Toast['action'] }) => string
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
  maxToasts?: number
}

export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000
    }

    setToasts(prev => {
      const updated = [newToast, ...prev]
      return updated.slice(0, maxToasts)
    })

    // Auto-remove toast after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }

    return id
  }, [maxToasts])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  const showError = useCallback((error: ClientError | Error | string, options?: { title?: string; action?: Toast['action'] }) => {
    let message: string
    let title = options?.title || 'Error'

    if (error instanceof ClientError) {
      message = error.message
      
      // Customize title based on error type
      switch (error.code) {
        case ErrorCodes.AUTH_REQUIRED:
        case ErrorCodes.AUTH_EXPIRED:
        case ErrorCodes.AUTH_INVALID:
          title = 'Authentication Required'
          break
        case ErrorCodes.VALIDATION_ERROR:
        case ErrorCodes.INVALID_INPUT:
          title = 'Validation Error'
          break
        case ErrorCodes.NETWORK_ERROR:
        case ErrorCodes.CONNECTION_ERROR:
          title = 'Connection Error'
          break
        case ErrorCodes.RATE_LIMIT_EXCEEDED:
          title = 'Rate Limit Exceeded'
          break
        case ErrorCodes.SERVER_ERROR:
          title = 'Server Error'
          break
      }
    } else if (error instanceof Error) {
      message = error.message
    } else {
      message = error
    }

    return addToast({
      type: 'error',
      title,
      message,
      duration: 7000, // Longer duration for errors
      action: options?.action
    })
  }, [addToast])

  const showSuccess = useCallback((message: string, options?: { title?: string; action?: Toast['action'] }) => {
    return addToast({
      type: 'success',
      title: options?.title || 'Success',
      message,
      action: options?.action
    })
  }, [addToast])

  const showWarning = useCallback((message: string, options?: { title?: string; action?: Toast['action'] }) => {
    return addToast({
      type: 'warning',
      title: options?.title || 'Warning',
      message,
      action: options?.action
    })
  }, [addToast])

  const showInfo = useCallback((message: string, options?: { title?: string; action?: Toast['action'] }) => {
    return addToast({
      type: 'info',
      title: options?.title || 'Info',
      message,
      action: options?.action
    })
  }, [addToast])

  const value: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    clearAll,
    showError,
    showSuccess,
    showWarning,
    showInfo
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      case 'info':
        return (
          <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'info':
        return 'bg-blue-50 border-blue-200'
    }
  }

  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-800'
      case 'error':
        return 'text-red-800'
      case 'warning':
        return 'text-yellow-800'
      case 'info':
        return 'text-blue-800'
    }
  }

  return (
    <div className={`${getBgColor()} border rounded-lg shadow-lg p-4 animate-slide-in-right`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h4 className={`text-sm font-medium ${getTextColor()}`}>
            {toast.title}
          </h4>
          {toast.message && (
            <p className={`mt-1 text-sm ${getTextColor()} opacity-90`}>
              {toast.message}
            </p>
          )}
          {toast.action && (
            <div className="mt-2">
              <button
                onClick={toast.action.onClick}
                className={`text-sm font-medium ${getTextColor()} hover:underline`}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={() => onRemove(toast.id)}
            className={`inline-flex ${getTextColor()} hover:opacity-75`}
            aria-label="Close notification"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}