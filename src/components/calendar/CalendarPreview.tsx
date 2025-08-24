'use client'

import React, { useMemo } from 'react'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
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

interface CalendarPreviewProps {
  posts: ScheduledPost[]
  onPostSelect?: (post: ScheduledPost) => void
  onDateSelect?: (date: Date) => void
  loading?: boolean
  className?: string
}

const CalendarPreview: React.FC<CalendarPreviewProps> = ({
  posts,
  onPostSelect,
  onDateSelect,
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
      contentPreview = `Thread: ${post.content.text.substring(0, 20)}...`
    } else {
      contentPreview = post.content.text.substring(0, 20)
      if (post.content.text.length > 20) {
        contentPreview += '...'
      }
    }
    
    return `${platformIcon} ${contentPreview}`
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
  const handleSelectEvent = React.useCallback((event: CalendarEvent) => {
    if (onPostSelect) {
      onPostSelect(event.resource)
    }
  }, [onPostSelect])

  // Handle slot selection (clicking on empty calendar slot)
  const handleSelectSlot = React.useCallback(({ start }: { start: Date }) => {
    if (onDateSelect) {
      onDateSelect(start)
    }
  }, [onDateSelect])

  // Custom event style based on platform and status
  const eventStyleGetter = React.useCallback((event: CalendarEvent) => {
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
        fontSize: '11px',
        padding: '1px 3px'
      }
    }
  }, [])

  // Custom day prop getter for highlighting
  const dayPropGetter = React.useCallback((date: Date) => {
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

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 text-sm">Loading calendar...</span>
      </div>
    )
  }

  return (
    <div className={`calendar-preview ${className}`}>
      <style jsx global>{`
        .calendar-preview .rbc-calendar {
          font-family: inherit;
          height: 100%;
        }
        
        .calendar-preview .rbc-toolbar {
          display: none; /* Hide navigation toolbar for preview */
        }
        
        .calendar-preview .rbc-month-view {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
          height: 100%;
        }
        
        .calendar-preview .rbc-header {
          background-color: #f9fafb;
          padding: 0.5rem;
          font-weight: 600;
          font-size: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .calendar-preview .rbc-date-cell {
          padding: 0.25rem;
          text-align: right;
          font-size: 0.75rem;
        }
        
        .calendar-preview .rbc-today {
          background-color: #eff6ff;
        }
        
        .calendar-preview .rbc-off-range-bg {
          background-color: #f9fafb;
        }
        
        .calendar-preview .rbc-event {
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          margin: 0.125rem 0;
          font-size: 0.625rem;
          line-height: 1.1;
          cursor: pointer;
        }
        
        .calendar-preview .rbc-event:hover {
          opacity: 0.8;
        }
        
        .calendar-preview .rbc-day-bg {
          cursor: pointer;
        }
        
        .calendar-preview .rbc-day-bg:hover {
          background-color: #f8fafc;
        }
      `}</style>
      
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        view={Views.MONTH}
        toolbar={false} // Disable toolbar for preview
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable={!!onDateSelect}
        eventPropGetter={eventStyleGetter}
        dayPropGetter={dayPropGetter}
        popup
        style={{ height: '100%' }}
        messages={{
          noEventsInRange: 'No scheduled posts',
          showMore: (total: number) => `+${total}`
        }}
      />
    </div>
  )
}

export default CalendarPreview