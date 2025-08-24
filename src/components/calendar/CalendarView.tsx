'use client'

import React, { useMemo, useCallback } from 'react'
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar'
import moment from 'moment'
import { ScheduledPost, Platform, PostStatus } from '@/types'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = momentLocalizer(moment)

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: ScheduledPost
  platform: Platform
  status: PostStatus
}

export interface CalendarViewProps {
  posts: ScheduledPost[]
  onPostSelect: (post: ScheduledPost) => void
  onDateSelect: (date: Date) => void
  view: 'month' | 'week' | 'day'
  onViewChange: (view: 'month' | 'week' | 'day') => void
  currentDate?: Date
  onDateChange?: (date: Date) => void
  loading?: boolean
  className?: string
}

const CalendarView: React.FC<CalendarViewProps> = ({
  posts,
  onPostSelect,
  onDateSelect,
  view,
  onViewChange,
  currentDate = new Date(),
  onDateChange,
  loading = false,
  className = ''
}) => {
  // Get platform icon/indicator
  const getPlatformIcon = (platform: Platform): string => {
    const icons = {
      threads: '🧵',
      twitter: '🐦',
      instagram: '📷',
      linkedin: '💼'
    }
    return icons[platform] || '📱'
  }

  // Get status indicator
  const getStatusIcon = (status: PostStatus): string => {
    const icons = {
      scheduled: '⏰',
      publishing: '🚀',
      published: '✅',
      failed: '❌',
      cancelled: '🚫'
    }
    return icons[status] || '⏰'
  }

  // Generate event title based on post content and platform
  const getEventTitle = (post: ScheduledPost): string => {
    const platformIcon = getPlatformIcon(post.platform)
    const statusIcon = getStatusIcon(post.status)
    
    let contentPreview = ''
    if (post.content.type === 'thread') {
      contentPreview = `Thread: ${post.content.text.substring(0, 30)}...`
    } else {
      contentPreview = post.content.text.substring(0, 30)
      if (post.content.text.length > 30) {
        contentPreview += '...'
      }
    }
    
    return `${platformIcon} ${statusIcon} ${contentPreview}`
  }

  // Convert posts to calendar events
  const events = useMemo((): CalendarEvent[] => {
    if (!posts || !Array.isArray(posts)) {
      return []
    }
    return posts.map(post => {
      const startTime = new Date(post.scheduledTime)
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000) // 30 minutes duration
      
      return {
        id: post.id,
        title: getEventTitle(post),
        start: startTime,
        end: endTime,
        resource: post,
        platform: post.platform,
        status: post.status
      }
    })
  }, [posts])

  // Handle event selection
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    onPostSelect(event.resource)
  }, [onPostSelect])

  // Handle slot selection (clicking on empty calendar slot)
  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    onDateSelect(start)
  }, [onDateSelect])

  // Custom event style based on platform and status
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const platformColors = {
      threads: '#000000',
      twitter: '#1DA1F2',
      instagram: '#E4405F',
      linkedin: '#0077B5'
    }

    const statusOpacity = {
      scheduled: 1,
      publishing: 0.9,
      published: 0.7,
      failed: 0.5,
      cancelled: 0.3
    }

    const backgroundColor = platformColors[event.platform] || '#6B7280'
    const opacity = statusOpacity[event.status] || 1

    return {
      style: {
        backgroundColor,
        opacity,
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        fontSize: '12px',
        padding: '2px 4px'
      }
    }
  }, [])

  // Custom day prop getter for highlighting
  const dayPropGetter = useCallback((date: Date) => {
    const today = new Date()
    const isToday = moment(date).isSame(today, 'day')
    
    if (isToday) {
      return {
        style: {
          backgroundColor: '#EFF6FF'
        }
      }
    }
    
    return {}
  }, [])

  // Convert view prop to react-big-calendar View type
  const calendarView = useMemo((): View => {
    const viewMap = {
      month: Views.MONTH,
      week: Views.WEEK,
      day: Views.DAY
    }
    return viewMap[view]
  }, [view])

  // Handle view change
  const handleViewChange = useCallback((newView: View) => {
    const viewMap = {
      [Views.MONTH]: 'month' as const,
      [Views.WEEK]: 'week' as const,
      [Views.DAY]: 'day' as const
    }
    const mappedView = viewMap[newView]
    if (mappedView) {
      onViewChange(mappedView)
    }
  }, [onViewChange])

  // Handle navigation (prev/next month/week/day)
  const handleNavigate = useCallback((date: Date) => {
    if (onDateChange) {
      onDateChange(date)
    }
  }, [onDateChange])

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading calendar...</span>
      </div>
    )
  }

  return (
    <div className={`calendar-container ${className}`}>
      <style jsx global>{`
        .rbc-calendar {
          font-family: inherit;
        }
        
        .rbc-toolbar {
          margin-bottom: 1rem;
          padding: 0.5rem;
          background-color: #f8fafc;
          border-radius: 0.5rem;
        }
        
        .rbc-toolbar button {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          background-color: white;
          border-radius: 0.375rem;
          margin: 0 0.25rem;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        
        .rbc-toolbar button:hover {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }
        
        .rbc-toolbar button.rbc-active {
          background-color: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        
        .rbc-month-view {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
        }
        
        .rbc-header {
          background-color: #f9fafb;
          padding: 0.75rem;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .rbc-date-cell {
          padding: 0.5rem;
          text-align: right;
        }
        
        .rbc-today {
          background-color: #eff6ff;
        }
        
        .rbc-off-range-bg {
          background-color: #f9fafb;
        }
        
        .rbc-event {
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          margin: 0.125rem 0;
          font-size: 0.75rem;
          line-height: 1.2;
          cursor: pointer;
        }
        
        .rbc-event:hover {
          opacity: 0.8;
        }
        
        .rbc-slot-selection {
          background-color: rgba(59, 130, 246, 0.1);
        }
        
        .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid #f3f4f6;
        }
        
        .rbc-time-view {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
        }
        
        .rbc-time-header {
          border-bottom: 1px solid #e5e7eb;
        }
        
        .rbc-time-content {
          border-top: none;
        }
        
        .rbc-current-time-indicator {
          background-color: #ef4444;
          height: 2px;
          z-index: 10;
        }
      `}</style>
      
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        view={calendarView}
        date={currentDate}
        onView={handleViewChange}
        onNavigate={handleNavigate}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        eventPropGetter={eventStyleGetter}
        dayPropGetter={dayPropGetter}
        popup
        showMultiDayTimes
        step={30}
        timeslots={2}
        style={{ height: 600 }}
        messages={{
          next: 'Next',
          previous: 'Previous',
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day',
          agenda: 'Agenda',
          date: 'Date',
          time: 'Time',
          event: 'Post',
          noEventsInRange: 'No scheduled posts in this range',
          showMore: (total: number) => `+${total} more`
        }}
      />
    </div>
  )
}

export default CalendarView