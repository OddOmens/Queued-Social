export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  data?: Record<string, any>
  timestamp: string
  requestId?: string
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  private formatMessage(level: string, message: string, data?: Record<string, any>): string {
    const timestamp = new Date().toISOString()
    const logEntry: LogEntry = {
      level: level as LogEntry['level'],
      message,
      timestamp,
      ...(data && { data })
    }

    if (this.isDevelopment) {
      // Pretty print for development
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${
        data ? '\n' + JSON.stringify(data, null, 2) : ''
      }`
    } else {
      // JSON format for production (easier for log aggregation)
      return JSON.stringify(logEntry)
    }
  }

  debug(message: string, data?: Record<string, any>): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, data))
    }
  }

  info(message: string, data?: Record<string, any>): void {
    console.info(this.formatMessage('info', message, data))
  }

  warn(message: string, data?: Record<string, any>): void {
    console.warn(this.formatMessage('warn', message, data))
  }

  error(message: string, data?: Record<string, any>): void {
    console.error(this.formatMessage('error', message, data))
    
    // In production, you might want to send errors to an external service
    if (this.isProduction) {
      this.sendToExternalService('error', message, data)
    }
  }

  // Placeholder for external logging service integration
  private sendToExternalService(level: string, message: string, data?: Record<string, any>): void {
    // TODO: Integrate with services like:
    // - Sentry for error tracking
    // - LogRocket for session replay
    // - DataDog for monitoring
    // - CloudWatch for AWS deployments
    
    // For now, just ensure the error is logged to console
    // In a real implementation, you would send this to your chosen service
  }

  // Helper method for API request logging
  logApiRequest(method: string, url: string, requestId: string, userId?: string): void {
    this.info('API Request', {
      method,
      url,
      requestId,
      userId,
      userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : undefined
    })
  }

  // Helper method for API response logging
  logApiResponse(status: number, requestId: string, duration?: number): void {
    this.info('API Response', {
      status,
      requestId,
      duration: duration ? `${duration}ms` : undefined
    })
  }

  // Helper method for database operation logging
  logDatabaseOperation(operation: string, table: string, duration?: number, error?: Error): void {
    if (error) {
      this.error('Database Operation Failed', {
        operation,
        table,
        duration: duration ? `${duration}ms` : undefined,
        error: error.message,
        stack: this.isDevelopment ? error.stack : undefined
      })
    } else {
      this.debug('Database Operation', {
        operation,
        table,
        duration: duration ? `${duration}ms` : undefined
      })
    }
  }

  // Helper method for external API logging
  logExternalApiCall(service: string, endpoint: string, status?: number, duration?: number, error?: Error): void {
    if (error) {
      this.error('External API Call Failed', {
        service,
        endpoint,
        status,
        duration: duration ? `${duration}ms` : undefined,
        error: error.message
      })
    } else {
      this.info('External API Call', {
        service,
        endpoint,
        status,
        duration: duration ? `${duration}ms` : undefined
      })
    }
  }

  // Helper method for authentication events
  logAuthEvent(event: string, userId?: string, details?: Record<string, any>): void {
    this.info('Authentication Event', {
      event,
      userId,
      ...details
    })
  }

  // Helper method for business logic events
  logBusinessEvent(event: string, details?: Record<string, any>): void {
    this.info('Business Event', {
      event,
      ...details
    })
  }
}

export const logger = new Logger()

// Performance monitoring helper
export function withPerformanceLogging<T>(
  operation: string,
  fn: () => Promise<T> | T
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now()
    
    try {
      const result = await fn()
      const duration = Date.now() - startTime
      
      logger.debug('Performance', {
        operation,
        duration: `${duration}ms`,
        success: true
      })
      
      resolve(result)
    } catch (error) {
      const duration = Date.now() - startTime
      
      logger.error('Performance', {
        operation,
        duration: `${duration}ms`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      reject(error)
    }
  })
}