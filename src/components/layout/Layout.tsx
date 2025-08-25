import { Outlet } from 'react-router-dom'
import MainNavigation from './MainNavigation'

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}