'use client'

import React from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import MainNavigation from './MainNavigation'
import { ErrorHandlingProvider } from '@/components/ErrorHandlingProvider'
import { Toast } from '@/components/Toast'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedRoute>
      <ErrorHandlingProvider>
        <div className="min-h-screen bg-gray-50">
          <MainNavigation />
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 sm:px-0">
              {children}
            </div>
          </main>
          <Toast />
        </div>
      </ErrorHandlingProvider>
    </ProtectedRoute>
  )
}