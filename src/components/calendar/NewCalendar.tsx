'use client'

import React, { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react'

export type ViewType = 'month' | 'week'

interface TimeSlot {
  id: string
  time: string
  hour: number
  minute: number
}

interface CalendarEvent {
  id: string
  title: string
  time: Date
  platform?: string
  status?: string
}

interface NewCalendarProps {
  view: ViewType
  onViewChange: (view: ViewType) => void
  events?: CalendarEvent[]
  timeSlots?: TimeSlot[]
  onTimeSlotClick?: (date: Date, timeSlot: TimeSlot) => void
  onDateClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
  className?: string
}

const NewCalendar: React.FC<NewCalendarProps> = ({
  view,
  onViewChange,
  events = [],
  timeSlots = [],
  onTimeSlotClick,
  onDateClick,
  onEventClick,
  className = ''
}) => {
  const [currentDate, setCurrentDate] = useState(new Date())

  const goToPrevious = () => {
    setCurrentDate(prev => view === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1))
  }

  const goToNext = () => {
    setCurrentDate(prev => view === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.time, date))
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={goToToday}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Today
          </button>
          <div className="flex items-center space-x-1">
            <button
              onClick={goToPrevious}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {view === 'month' 
            ? format(currentDate, 'MMMM yyyy')
            : `${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`
          }
        </h2>

        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => onViewChange('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === 'month' 
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onViewChange('week')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === 'week' 
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      {view === 'month' ? (
        <MonthView 
          currentDate={currentDate}
          events={events}
          getEventsForDate={getEventsForDate}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      ) : (
        <WeekView 
          currentDate={currentDate}
          events={events}
          timeSlots={timeSlots}
          onTimeSlotClick={onTimeSlotClick}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      )}
    </div>
  )
}

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  getEventsForDate: (date: Date) => CalendarEvent[]
  onDateClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
}

const MonthView: React.FC<MonthViewProps> = ({ 
  currentDate, 
  events, 
  getEventsForDate, 
  onDateClick,
  onEventClick 
}) => {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  
  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  })

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="p-4">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-4">
        {weekdays.map(day => (
          <div key={day} className="py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden">
        {days.map(day => {
          const dayEvents = getEventsForDate(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isCurrentDay = isToday(day)

          return (
            <div
              key={day.toString()}
              onClick={() => onDateClick?.(day)}
              className={`
                min-h-[120px] bg-white dark:bg-gray-700 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors
                ${!isCurrentMonth ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-600' : ''}
                ${isCurrentDay ? 'bg-blue-50 dark:bg-blue-900 border-2 border-blue-200 dark:border-blue-600' : ''}
              `}
            >
              <div className={`
                text-sm font-medium mb-2
                ${isCurrentDay ? 'text-blue-600 dark:text-blue-300' : isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}
              `}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => {
                  const statusColors = {
                    scheduled: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
                    publishing: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700',
                    published: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
                    failed: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
                    cancelled: 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-500'
                  }
                  const colorClass = statusColors[event.status as keyof typeof statusColors] || statusColors.scheduled
                  
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick?.(event)
                      }}
                      className={`px-2 py-1 text-xs rounded border truncate cursor-pointer hover:shadow-sm transition-shadow ${colorClass}`}
                      title={`${event.title} - ${event.status}`}
                    >
                      {event.title}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  timeSlots: TimeSlot[]
  onTimeSlotClick?: (date: Date, timeSlot: TimeSlot) => void
  onDateClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
}

const WeekView: React.FC<WeekViewProps> = ({ 
  currentDate, 
  events, 
  timeSlots,
  onTimeSlotClick,
  onDateClick,
  onEventClick 
}) => {
  const weekStart = startOfWeek(currentDate)
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(currentDate)
  })

  const timeSlotHours = useMemo(() => {
    const hours = []
    for (let hour = 6; hour <= 23; hour++) {
      hours.push({
        hour,
        label: format(new Date().setHours(hour, 0), 'ha').toLowerCase(),
        slots: timeSlots.filter(slot => slot.hour === hour)
      })
    }
    return hours
  }, [timeSlots])

  const getEventsForDateTime = (date: Date, hour: number) => {
    return events.filter(event => {
      return isSameDay(event.time, date) && event.time.getHours() === hour
    })
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Week header */}
      <div className="flex border-b border-gray-200 dark:border-gray-600">
        <div className="w-16 py-4"></div>
        {weekDays.map(day => (
          <div 
            key={day.toString()}
            onClick={() => onDateClick?.(day)}
            className={`
              flex-1 py-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
              ${isToday(day) ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-semibold' : 'text-gray-900 dark:text-white'}
            `}
          >
            <div className="text-sm font-medium">
              {format(day, 'EEE')}
            </div>
            <div className={`
              text-2xl font-bold mt-1
              ${isToday(day) ? 'text-blue-600 dark:text-blue-300' : 'text-gray-900 dark:text-white'}
            `}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time slots */}
      <div className="flex-1 overflow-y-auto">
        {timeSlotHours.map(({ hour, label, slots }) => (
          <div key={hour} className="flex border-b border-gray-100 dark:border-gray-600 min-h-[60px]">
            <div className="w-16 py-2 px-3 text-sm text-gray-500 dark:text-gray-400 text-right">
              {label}
            </div>
            {weekDays.map(day => {
              const dayEvents = getEventsForDateTime(day, hour)
              const dayOfWeek = day.getDay() // 0 = Sunday, 1 = Monday, etc.
              const availableSlots = slots.filter(slot => 
                (slot as any).dayOfWeek === dayOfWeek || 
                (!(slot as any).dayOfWeek && (slot as any).hour === hour)
              )
              
              return (
                <div 
                  key={`${day.toString()}-${hour}`}
                  className="flex-1 border-r border-gray-100 dark:border-gray-600 p-2 relative hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {/* Events */}
                  {dayEvents.map(event => {
                    const statusColors = {
                      scheduled: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
                      publishing: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700',
                      published: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
                      failed: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
                      cancelled: 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-500'
                    }
                    const colorClass = statusColors[event.status as keyof typeof statusColors] || statusColors.scheduled
                    
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick?.(event)
                        }}
                        className={`mb-1 px-2 py-1 text-xs rounded border truncate cursor-pointer hover:shadow-sm transition-shadow ${colorClass}`}
                        title={`${event.title} - ${event.status}`}
                      >
                        {event.title}
                      </div>
                    )
                  })}
                  
                  {/* Time slot buttons */}
                  {availableSlots.length > 0 && dayEvents.length === 0 && (
                    <div className="space-y-1">
                      {availableSlots.map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => onTimeSlotClick?.(day, slot)}
                          className="w-full flex items-center justify-center py-1 px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-600 border border-dashed border-gray-300 dark:border-gray-500 hover:border-gray-400 dark:hover:border-gray-400 rounded transition-colors group"
                        >
                          <PlusIcon className="w-3 h-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {slot.time}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Add button for empty slots without predefined time slots */}
                  {availableSlots.length === 0 && dayEvents.length === 0 && (
                    <button
                      onClick={() => onTimeSlotClick?.(day, { 
                        id: `${day.toString()}-${hour}`, 
                        time: format(new Date().setHours(hour, 0), 'h:mm a'),
                        hour,
                        minute: 0
                      })}
                      className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 hover:bg-white dark:hover:bg-gray-600 hover:bg-opacity-80 dark:hover:bg-opacity-80 transition-all group"
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-full transition-colors">
                        <PlusIcon className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                      </div>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default NewCalendar