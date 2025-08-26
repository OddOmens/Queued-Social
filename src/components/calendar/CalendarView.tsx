'use client'

import React, { useMemo, useCallback } from 'react'
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar'
import moment from 'moment'
import { ScheduledPost, Platform, PostStatus, TimeSlotConfig, DayOfWeek } from '@/types'
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
  timeSlots?: TimeSlotConfig[]
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
  timeSlots = [],
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
      scheduled: '📅',
      publishing: '🚀',
      published: '✅',
      failed: '⚠️',
      cancelled: '🚫'
    }
    return icons[status] || '📅'
  }

  // Generate event title based on post content and platform
  const getEventTitle = (post: ScheduledPost): string => {
    const platformIcon = getPlatformIcon(post.platform)
    
    let contentPreview = ''
    if (post.content.type === 'thread') {
      const threadLength = post.content.threadPosts?.length || 1
      contentPreview = `Thread (${threadLength}): ${post.content.text.substring(0, 25)}`
    } else if (post.content.type === 'media') {
      contentPreview = `Media: ${post.content.text?.substring(0, 25) || 'Image/Video'}`
    } else {
      contentPreview = post.content.text.substring(0, 30)
    }
    
    if (contentPreview.length > 30) {
      contentPreview = contentPreview.substring(0, 27) + '...'
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

    const statusColors = {
      scheduled: '#3B82F6', // Blue
      publishing: '#F59E0B', // Amber
      published: '#10B981', // Emerald
      failed: '#EF4444', // Red
      cancelled: '#6B7280' // Gray
    }

    const backgroundColor = statusColors[event.status] || platformColors[event.platform] || '#6B7280'
    
    return {
      style: {
        backgroundColor,
        border: `2px solid ${backgroundColor}`,
        borderRadius: '8px',
        color: 'white',
        fontSize: '11px',
        fontWeight: '600',
        padding: '4px 8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }
    }
  }, [])

  // Get time slots for a specific day
  const getTimeSlotsForDay = useCallback((date: Date): TimeSlotConfig[] => {
    const dayOfWeek = date.getDay() as DayOfWeek
    return timeSlots.filter(slot => slot.dayOfWeek === dayOfWeek && slot.isActive)
  }, [timeSlots])

  // Custom day prop getter for highlighting and showing time slots
  const dayPropGetter = useCallback((date: Date) => {
    const today = new Date()
    const isToday = moment(date).isSame(today, 'day')
    const dayTimeSlots = getTimeSlotsForDay(date)
    const hasTimeSlots = dayTimeSlots.length > 0
    
    let backgroundColor = '#0f172a'
    
    if (isToday) {
      backgroundColor = '#1e40af'
    } else if (hasTimeSlots) {
      backgroundColor = '#064e3b' // Dark green tint for days with time slots
    }
    
    return {
      style: {
        backgroundColor,
        position: 'relative' as const
      }
    }
  }, [getTimeSlotsForDay])

  // Custom date cell component
  const DateCellWrapper = useCallback(({ children, value }: { children: React.ReactNode, value: Date }) => {
    const dayTimeSlots = getTimeSlotsForDay(value)
    
    return (
      <div className="relative h-full">
        {children}
        {view === 'month' && dayTimeSlots.length > 0 && (
          <div className="absolute bottom-1 left-1 right-1">
            <div className="flex flex-wrap gap-0.5">
              {dayTimeSlots.slice(0, 3).map((slot, index) => (
                <div
                  key={slot.id}
                  className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full flex-shrink-0 shadow-sm border border-emerald-500"
                  title={`Time Slot: ${slot.time}`}
                >
                  {slot.time}
                </div>
              ))}
              {dayTimeSlots.length > 3 && (
                <div className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full shadow-sm border border-emerald-500">
                  +{dayTimeSlots.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }, [view, getTimeSlotsForDay])

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
      [Views.WORK_WEEK]: 'week' as const,
      [Views.DAY]: 'day' as const,
      [Views.AGENDA]: 'day' as const
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
        <span className="ml-2 text-gray-300">Loading calendar...</span>
      </div>
    )
  }

  return (
    <div className={`calendar-container ${className}`}>
      <style>{`
        .rbc-calendar {
          font-family: inherit;
          background-color: #111827;
          color: #f3f4f6;
        }
        
        .rbc-toolbar {
          margin-bottom: 1rem;
          padding: 1rem;
          background-color: #1f2937;
          border-radius: 0.75rem;
          border: 1px solid #374151;
        }
        
        .rbc-toolbar button {
          padding: 0.75rem 1.25rem;
          border: 1px solid #4b5563;
          background-color: #374151;
          color: #d1d5db;
          border-radius: 0.5rem;
          margin: 0 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .rbc-toolbar button:hover {
          background-color: #4b5563;
          border-color: #6b7280;
          color: #f9fafb;
        }
        
        .rbc-toolbar button.rbc-active {
          background-color: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        
        .rbc-toolbar-label {
          color: #f3f4f6;
          font-weight: 600;
        }
        
        .rbc-month-view {
          border: 1px solid #374151;
          border-radius: 0.75rem;
          overflow: hidden;
          background-color: #111827;
        }
        
        .rbc-header {
          background-color: #1f2937;
          padding: 1rem;
          font-weight: 600;
          border-bottom: 1px solid #374151;
          color: #e5e7eb;
        }
        
        .rbc-date-cell {
          padding: 0.75rem;
          text-align: right;
          color: #d1d5db;
          background-color: #0f172a;
          border-right: 1px solid #374151;
          border-bottom: 1px solid #374151;
          aspect-ratio: 1;
          min-height: 140px;
          position: relative;
          transition: all 0.2s ease;
        }
        
        .rbc-date-cell:hover {
          background-color: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .rbc-today {
          background-color: #1e40af !important;
          position: relative;
        }
        
        .rbc-today::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 2px solid #3B82F6;
          border-radius: 8px;
          pointer-events: none;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
        }
        
        .rbc-off-range {
          color: #6b7280;
        }
        
        .rbc-off-range-bg {
          background-color: #0f172a;
        }
        
        .rbc-event {
          border-radius: 8px;
          padding: 4px 8px;
          margin: 2px 0;
          font-size: 11px;
          line-height: 1.4;
          cursor: pointer;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .rbc-event:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 10;
          position: relative;
        }
        
        .rbc-slot-selection {
          background-color: rgba(59, 130, 246, 0.2);
        }
        
        .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid #374151;
          background-color: #0f172a;
        }
        
        .rbc-time-view {
          border: 1px solid #374151;
          border-radius: 0.75rem;
          overflow: hidden;
          background-color: #111827;
        }
        
        .rbc-time-header {
          border-bottom: 1px solid #374151;
          background-color: #1f2937;
          color: #e5e7eb;
        }
        
        .rbc-time-header > * {
          border-left: 1px solid #374151;
        }
        
        .rbc-time-content {
          border-top: none;
        }
        
        .rbc-time-content > * {
          border-left: 1px solid #374151;
        }
        
        .rbc-timeslot-group {
          border-bottom: 1px solid #374151;
        }
        
        .rbc-time-slot {
          color: #9ca3af;
        }
        
        .rbc-current-time-indicator {
          background-color: #ef4444;
          height: 2px;
          z-index: 10;
        }
        
        .rbc-row-bg .rbc-day-bg {
          border-left: 1px solid #374151;
        }
        
        .rbc-month-row {
          border-bottom: 1px solid #374151;
        }
        
        .rbc-month-row + .rbc-month-row {
          border-top: none;
        }
        
        .rbc-row-content {
          z-index: 4;
        }
        
        .rbc-addons-dnd .rbc-addons-dnd-drag-preview {
          background-color: #374151;
          border: 2px solid #60a5fa;
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
        components={{
          dateCellWrapper: DateCellWrapper
        }}
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