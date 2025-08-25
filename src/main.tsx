import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

// Environment validation
import { checkEnvironmentVariables } from './utils/envCheck'

// Check environment variables on startup
const envCheck = checkEnvironmentVariables()
if (!envCheck.isValid) {
  console.error('❌ Critical Environment Variable Errors:', envCheck.errors)
  console.error('Current config:', envCheck.config)
  
  // In production, show user-friendly error
  if (import.meta.env.MODE === 'production') {
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto;">
        <h1 style="color: #dc2626;">Configuration Error</h1>
        <p>The application is not properly configured. Please contact the administrator.</p>
        <details style="margin-top: 20px;">
          <summary>Technical Details</summary>
          <pre style="background: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto;">
Environment Errors:
${envCheck.errors.join('\n')}

Current Configuration:
${JSON.stringify(envCheck.config, null, 2)}
          </pre>
        </details>
      </div>
    `
    throw new Error('Application configuration is invalid')
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)