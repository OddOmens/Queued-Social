'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import moment from 'moment'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { ScheduledPost, Platform, PostStatus } from '@/types'
import PostDetailModal from './PostDetailModal'
import PostGroupModal from './PostGroupModal'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'

const localizer = momentLocalizer(moment)
const DragAndDropCalendar = withDragAndDrop(Calendar)

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: ScheduledPost | ScheduledPost[] // Can be single post or group
  platform: Platform
  status: PostStatus
  isGroup: boolean
  groupCount?: number
}

interface InteractiveCalendarViewProps {
  posts: ScheduledPost[]
  onPostSelect: (post: ScheduledPost) => void
  onPostUpdate: (postId: string, updates: Partial<ScheduledPost>) => Promise<void>
  onPostReschedule: (postId: string, newTime: Date) => Promise<void>
  onDateSelect: (date: Date) => void
  view: 'month' | 'week' | 'day'
  onViewChange: (view: 'month' | 'week' | 'day') => void
  loading?: boolean
  className?: string
}

const InteractiveCalendarView: React.FC<InteractiveCalendarViewProps> = ({
  posts,
  onPostSelect,
  onPostUpdate,
  onPostReschedule,
  onDateSelect,
  view,
  onViewChange,
  loading = false,
  className = ''
}) => {
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<ScheduledPost[] | null>(null)
  const [draggedPost, setDraggedPost] = useState<ScheduledPost | null>(null)

  // Group posts by time slot (within 30 minutes of each other)
  const groupedPosts = useMemo(() => {
    const groups: { [key: string]: ScheduledPost[] } = {}
    
    posts.forEach(post => {
      // Round to nearest 30 minutes for grouping
      const roundedTime = moment(post.scheduledTime)
        .startOf('hour')
        .add(Math.round(moment(post.scheduledTime).minute() / 30) * 30, 'minutes')
        .toISOString()
      
      if (!groups[roundedTime]) {
        groups[roundedTime] = []
      }
      groups[roundedTime].push(post)
    })
    
    return groups
  }, [posts])

  // Convert grouped posts to calendar events
  const events = useMemo((): CalendarEvent[] => {
    return Object.entries(groupedPosts).map(([timeKey, groupPosts]) => {
      const startTime = new Date(timeKey)
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000) // 30 minutes duration
      
      if (groupPosts.length === 1) {
        const post = groupPosts[0]
        return {
          id: post.id,
          title: getSinglePostTitle(post),
          start: startTime,
          end: endTime,
          resource: post,
          platform: post.platform,
          status: post.status,
          isGroup: false
        }
      } else {
        // Multiple posts in same time slot
        const platforms = Array.from(new Set(groupPosts.map(p => p.platform)))
        const statuses = Array.from(new Set(groupPosts.map(p => p.status)))
        
        return {
          id: `group-${timeKey}`,
          title: getGroupTitle(groupPosts),
          start: startTime,
          end: endTime,
          resource: groupPosts,
          platform: platforms[0], // Primary platform for styling
          status: statuses.includes('failed') ? 'failed' : 
                  statuses.includes('scheduled') ? 'scheduled' : 'published',
          isGroup: true,
          groupCount: groupPosts.length
        }
      }
    })
  }, [groupedPosts])

  // Generate title for single post
  const getSinglePostTitle = (post: ScheduledPost): string => {
    const platformIcon = getPlatformIcon(post.platform)
    const statusIcon = getStatusIcon(post.status)
    
    let contentPreview = ''
    if (post.content.type === 'thread') {
      contentPreview = `Thread: ${post.content.text.substring(0, 25)}...`
    } else {
      contentPreview = post.content.text.substring(0, 25)
      if (post.content.text.length > 25) {
        contentPreview += '...'
      }
    }
    
    return `${platformIcon} ${statusIcon} ${contentPreview}`
  }

  // Generate title for grouped posts
  const getGroupTitle = (posts: ScheduledPost[]): string => {
    const platformCounts = posts.reduce((acc, post) => {
      acc[post.platform] = (acc[post.platform] || 0) + 1
      return acc
    }, {} as Record<Platform, number>)
    
    const platformSummary = Object.entries(platformCounts)
      .map(([platform, count]) => `${getPlatformIcon(platform as Platform)}${count > 1 ? count : ''}`)
      .join(' ')
    
    return `📅 ${posts.length} posts: ${platformSummary}`
  }

  // Get platform icon
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

  // Handle event selection
  const handleSelectEvent = useCallback((event: any) => {
    if (event.isGroup) {
      setSelectedGroup(event.resource as ScheduledPost[])
    } else {
      setSelectedPost(event.resource as ScheduledPost)
      onPostSelect(event.resource as ScheduledPost)
    }
  }, [onPostSelect])

  // Handle slot selection
  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    onDateSelect(start)
  }, [onDateSelect])

  // Handle event drag start
  const handleEventDragStart = useCallback((event: any) => {
    if (!event.isGroup) {
      setDraggedPost(event.resource as ScheduledPost)
    }
  }, [])

  // Handle event drop (reschedule)
  const handleEventDrop = useCallback(async (args: any) => {
    const { event, start } = args
    if (event.isGroup || !draggedPost) return
    
    try {
      const startDate = typeof start === 'string' ? new Date(start) : start
      await onPostReschedule(draggedPost.id, startDate)
      setDraggedPost(null)
    } catch (error) {
      console.error('Failed to reschedule post:', error)
      // You could show an error toast here
    }
  }, [draggedPost, onPostReschedule])

  // Custom event style based on platform, status, and grouping
  const eventStyleGetter = useCallback((event: any) => {
    const platformColors = {
      threads: '#000000',
      twitter: '#1DA1F2',
      instagram: '#E4405F',
      linkedin: '#0077B5'
    }

    const statusOpacity = {
      scheduled: 1,
      publishing: 0.8,
      published: 0.7,
      failed: 0.5,
      cancelled: 0.3
    }

    let backgroundColor = platformColors[event.platform as keyof typeof platformColors] || '#6B7280'
    const opacity = statusOpacity[event.status as keyof typeof statusOpacity] || 1

    // Special styling for groups
    if (event.isGroup) {
      backgroundColor = '#6366F1' // Indigo for groups
    }

    return {
      style: {
        backgroundColor,
        opacity,
        border: event.isGroup ? '2px dashed rgba(255,255,255,0.5)' : 'none',
        borderRadius: '6px',
        color: 'white',
        fontSize: '11px',
        padding: '2px 6px',
        fontWeight: event.isGroup ? '600' : '400'
      }
    }
  }, [])

  // Custom day prop getter
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
      [Views.WORK_WEEK]: 'week' as const,
      [Views.DAY]: 'day' as const,
      [Views.AGENDA]: 'day' as const
    }
    const mappedView = viewMap[newView]
    if (mappedView) {
      onViewChange(mappedView)
    }
  }, [onViewChange])

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading calendar...</span>
      </div>
    )
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`interactive-calendar-container ${className}`}>
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
            border-radius: 0.375rem;
            padding: 0.25rem 0.5rem;
            margin: 0.125rem 0;
            font-size: 0.75rem;
            line-height: 1.2;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .rbc-event:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
          
          .rbc-addons-dnd .rbc-event {
            cursor: move;
          }
          
          .rbc-addons-dnd .rbc-event:hover {
            opacity: 0.8;
          }
        `}</style>
        
        <DragAndDropCalendar
          localizer={localizer}
          events={events}
          startAccessor={(event: any) => event.start}
          endAccessor={(event: any) => event.end}
          titleAccessor={(event: any) => event.title}
          view={calendarView}
          onView={handleViewChange}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          onEventDrop={handleEventDrop}
          onDragStart={handleEventDragStart}
          selectable
          resizable={false}
          draggableAccessor={() => true}
          eventPropGetter={eventStyleGetter}
          dayPropGetter={dayPropGetter}
          popup
          showMultiDayTimes
          step={30}
          timeslots={2}
          defaultDate={new Date()}
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

        {/* Post Detail Modal */}
        {selectedPost && (
          <PostDetailModal
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onUpdate={onPostUpdate}
            onReschedule={onPostReschedule}
          />
        )}

        {/* Post Group Modal */}
        {selectedGroup && (
          <PostGroupModal
            posts={selectedGroup}
            onClose={() => setSelectedGroup(null)}
            onPostSelect={(post) => {
              setSelectedGroup(null)
              setSelectedPost(post)
              onPostSelect(post)
            }}
            onUpdate={onPostUpdate}
            onReschedule={onPostReschedule}
          />
        )}
      </div>
    </DndProvider>
  )
}

export default InteractiveCalendarView