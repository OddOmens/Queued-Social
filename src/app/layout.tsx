import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { ServerInitializer } from '@/components/ServerInitializer'
import { EnvCheck } from '@/components/debug/EnvCheck'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Social Media Scheduler',
  description: 'Schedule and manage your social media posts across multiple platforms',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ServerInitializer />
          {children}
          <EnvCheck />
        </AuthProvider>
      </body>
    </html>
  )
}