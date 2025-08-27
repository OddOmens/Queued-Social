'use client'

import React, { useState, useCallback, useMemo } from 'react'
import NewCalendar, { ViewType } from './NewCalendar'
import { ScheduledPost, TimeSlotConfig } from '@/types'

interface CalendarContainerProps {
  posts: ScheduledPost[]
  timeSlots?: TimeSlotConfig[]
  onPostSelect: (post: ScheduledPost) => void
  onDateSelect: (date: Date) => void
  loading?: boolean
  className?: string
  initialView?: 'month' | 'week' | 'day'
}

const CalendarContainer: React.FC<CalendarContainerProps> = ({
  posts,
  timeSlots = [],
  onPostSelect,
  onDateSelect,
  loading = false,
  className = '',
  initialView = 'month'
}) => {
  const [view, setView] = useState<ViewType>(initialView === 'day' ? 'week' : initialView as ViewType)

  // Update view when initialView changes
  React.useEffect(() => {
    setView(initialView === 'day' ? 'week' : initialView as ViewType)
  }, [initialView])

  // Convert posts to calendar events
  const events = useMemo(() => {
    return posts.map(post => ({
      id: post.id,
      title: getPostTitle(post),
      time: new Date(post.scheduledTime),
      platform: post.platform,
      status: post.status
    }))
  }, [posts])

  // Convert time slots to the new format
  const convertedTimeSlots = useMemo(() => {
    return timeSlots.map(slot => ({
      id: slot.id,
      time: slot.time,
      dayOfWeek: slot.dayOfWeek,
      hour: parseInt(slot.time.split(':')[0]),
      minute: parseInt(slot.time.split(':')[1]) || 0
    }))
  }, [timeSlots])

  const getPostTitle = (post: ScheduledPost): string => {
    const platformIcon = getPlatformIcon(post.platform)
    let preview = ''
    
    if (post.content.type === 'thread') {
      preview = `Thread: ${post.content.text.substring(0, 30)}...`
    } else {
      preview = post.content.text.substring(0, 30)
      if (post.content.text.length > 30) {
        preview += '...'
      }
    }
    
    return `${platformIcon} ${preview}`
  }

  const getPlatformIcon = (platform: string): string => {
    const icons = {
      threads: '🧵',
      twitter: '🐦',
      instagram: '📷',
      linkedin: '💼'
    }
    return icons[platform as keyof typeof icons] || '📱'
  }

  const handleViewChange = useCallback((newView: ViewType) => {
    setView(newView)
  }, [])

  const handleTimeSlotClick = useCallback((date: Date, timeSlot: any) => {
    // Set the time on the date based on the time slot
    const scheduledTime = new Date(date)
    scheduledTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0)
    onDateSelect(scheduledTime)
  }, [onDateSelect])

  const handleDateClick = useCallback((date: Date) => {
    onDateSelect(date)
  }, [onDateSelect])

  const handleEventClick = useCallback((event: any) => {
    // Find the original post from the event ID
    const post = posts.find(p => p.id === event.id)
    if (post) {
      onPostSelect(post)
    }
  }, [posts, onPostSelect])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600 dark:text-gray-300">Loading calendar...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`calendar-container ${className}`}>
      <NewCalendar
        view={view}
        onViewChange={handleViewChange}
        events={events}
        timeSlots={convertedTimeSlots}
        onTimeSlotClick={handleTimeSlotClick}
        onDateClick={handleDateClick}
        onEventClick={handleEventClick}
      />
    </div>
  )
}

export default CalendarContainer