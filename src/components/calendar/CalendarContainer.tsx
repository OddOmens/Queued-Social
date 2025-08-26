'use client'

import React, { useState, useCallback, useMemo } from 'react'
import CalendarView from './CalendarView'
import { ScheduledPost, TimeSlotConfig } from '@/types'

interface CalendarContainerProps {
  posts: ScheduledPost[]
  timeSlots?: TimeSlotConfig[]
  onPostSelect: (post: ScheduledPost) => void
  onDateSelect: (date: Date) => void
  loading?: boolean
  className?: string
}

const CalendarContainer: React.FC<CalendarContainerProps> = ({
  posts,
  timeSlots = [],
  onPostSelect,
  onDateSelect,
  loading = false,
  className = ''
}) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')

  // Filter posts based on current view and date range
  const filteredPosts = useMemo(() => {
    // For now, return all posts. In a real implementation, you might want to
    // filter based on the current view's date range for performance
    return posts
  }, [posts])

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date)
  }, [])

  const handleViewChange = useCallback((newView: 'month' | 'week' | 'day') => {
    setView(newView)
  }, [])



  const handlePostSelect = useCallback((post: ScheduledPost) => {
    onPostSelect(post)
  }, [onPostSelect])

  const handleDateSelect = useCallback((date: Date) => {
    onDateSelect(date)
  }, [onDateSelect])

  return (
    <div className={`calendar-container relative ${className}`}>
      <CalendarView
        posts={filteredPosts}
        timeSlots={timeSlots}
        onPostSelect={handlePostSelect}
        onDateSelect={handleDateSelect}
        view={view}
        onViewChange={handleViewChange}
        loading={loading}
        currentDate={currentDate}
        onDateChange={handleDateChange}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
            <span className="text-gray-300">Loading posts...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarContainer