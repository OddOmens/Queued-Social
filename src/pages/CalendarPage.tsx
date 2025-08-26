import CalendarContainer from '@/components/calendar/CalendarContainer'
import { useState } from 'react'
import { ScheduledPost } from '@/types'

export function CalendarPage() {
  const [posts] = useState<ScheduledPost[]>([]) // TODO: Load posts from API
  
  const handlePostSelect = (post: ScheduledPost) => {
    // TODO: Handle post selection
    console.log('Selected post:', post)
  }
  
  const handleDateSelect = (date: Date) => {
    // TODO: Handle date selection
    console.log('Selected date:', date)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Content Calendar</h1>
        <p className="mt-2 text-gray-400">
          View and manage your scheduled posts across all platforms.
        </p>
      </div>

      <CalendarContainer 
        posts={posts}
        onPostSelect={handlePostSelect}
        onDateSelect={handleDateSelect}
      />
    </div>
  )
}