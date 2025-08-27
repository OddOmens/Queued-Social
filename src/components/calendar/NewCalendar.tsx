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
  onEventRightClick?: (event: CalendarEvent, mouseEvent: React.MouseEvent) => void
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
  onEventRightClick,
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
    <div className={`bg-gray-900 rounded-lg shadow-sm border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={goToToday}
            className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
          >
            Today
          </button>
          <div className="flex items-center space-x-1">
            <button
              onClick={goToPrevious}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-white">
          {view === 'month' 
            ? format(currentDate, 'MMMM yyyy')
            : `${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`
          }
        </h2>

        <div className="flex items-center bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => onViewChange('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === 'month' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onViewChange('week')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === 'week' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
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
          onEventRightClick={onEventRightClick}
        />
      ) : (
        <WeekView 
          currentDate={currentDate}
          events={events}
          timeSlots={timeSlots}
          onTimeSlotClick={onTimeSlotClick}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
          onEventRightClick={onEventRightClick}
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
  onEventRightClick?: (event: CalendarEvent, mouseEvent: React.MouseEvent) => void
}

const MonthView: React.FC<MonthViewProps> = ({ 
  currentDate, 
  events, 
  getEventsForDate, 
  onDateClick,
  onEventClick,
  onEventRightClick 
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
          <div key={day} className="py-2 text-center text-sm font-medium text-gray-400">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-700 rounded-lg overflow-hidden">
        {days.map(day => {
          const dayEvents = getEventsForDate(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isCurrentDay = isToday(day)

          return (
            <div
              key={day.toString()}
              onClick={() => onDateClick?.(day)}
              className={`
                min-h-[120px] bg-gray-800 p-2 cursor-pointer hover:bg-gray-700 transition-colors
                ${!isCurrentMonth ? 'text-gray-500 bg-gray-900' : ''}
                ${isCurrentDay ? 'bg-blue-900 border-2 border-blue-500' : ''}
              `}
            >
              <div className={`
                text-sm font-medium mb-2
                ${isCurrentDay ? 'text-blue-300' : isCurrentMonth ? 'text-white' : 'text-gray-500'}
              `}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => {
                  const statusColors = {
                    scheduled: 'bg-blue-900 text-blue-200 border-blue-700',
                    publishing: 'bg-amber-900 text-amber-200 border-amber-700',
                    published: 'bg-green-900 text-green-200 border-green-700',
                    failed: 'bg-red-900 text-red-200 border-red-700',
                    cancelled: 'bg-gray-600 text-gray-200 border-gray-500'
                  }
                  const colorClass = statusColors[event.status as keyof typeof statusColors] || statusColors.scheduled
                  
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick?.(event)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onEventRightClick?.(event, e)
                      }}
                      className={`px-2 py-1 text-xs rounded border cursor-pointer hover:shadow-sm transition-shadow ${colorClass} w-full overflow-hidden text-ellipsis whitespace-nowrap`}
                      title={`${event.title} - ${event.status} (Right-click for options)`}
                    >
                      {event.title}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-400 px-2">
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
  onEventRightClick?: (event: CalendarEvent, mouseEvent: React.MouseEvent) => void
}

const WeekView: React.FC<WeekViewProps> = ({ 
  currentDate, 
  events, 
  timeSlots,
  onTimeSlotClick,
  onDateClick,
  onEventClick,
  onEventRightClick 
}) => {
  const weekStart = startOfWeek(currentDate)
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(currentDate)
  })

  const timeSlotQuarters = useMemo(() => {
    const quarters = []
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        quarters.push({
          hour,
          minute,
          label: format(new Date().setHours(hour, minute), 'h:mm a'),
          fullTime: format(new Date().setHours(hour, minute), 'h:mm a').toLowerCase(),
          slots: timeSlots.filter(slot => slot.hour === hour && slot.minute === minute)
        })
      }
    }
    return quarters
  }, [timeSlots])

  const getEventsForDateTime = (date: Date, hour: number, minute: number) => {
    return events.filter(event => {
      return isSameDay(event.time, date) && 
             event.time.getHours() === hour && 
             Math.floor(event.time.getMinutes() / 15) * 15 === minute
    })
  }

  return (
    <div className="flex flex-col h-[800px]">
      {/* Week header */}
      <div className="flex border-b border-gray-600">
        <div className="w-20 py-4"></div>
        {weekDays.map(day => (
          <div 
            key={day.toString()}
            onClick={() => onDateClick?.(day)}
            className={`
              flex-1 py-4 text-center cursor-pointer hover:bg-gray-700 transition-colors
              ${isToday(day) ? 'bg-blue-900 text-blue-300 font-semibold' : 'text-white'}
            `}
          >
            <div className="text-sm font-medium">
              {format(day, 'EEE')}
            </div>
            <div className={`
              text-2xl font-bold mt-1
              ${isToday(day) ? 'text-blue-300' : 'text-white'}
            `}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time slots */}
      <div className="flex-1 overflow-y-auto">
        {timeSlotQuarters.map((timeSlotData) => {
          const { hour, minute, label, fullTime, slots } = timeSlotData
          return (
            <div key={`${hour}-${minute}`} className="flex border-b border-gray-600 min-h-[40px]">
            <div className="w-20 py-1 px-2 text-xs text-gray-400 text-right">
              {label}
            </div>
            {weekDays.map(day => {
              const dayEvents = getEventsForDateTime(day, hour, minute)
              const dayOfWeek = day.getDay() // 0 = Sunday, 1 = Monday, etc.
              const availableSlots = slots.filter(slot => 
                (slot as any).dayOfWeek === dayOfWeek
              )
              
              return (
                <div 
                  key={`${day.toString()}-${hour}-${minute}`}
                  className="flex-1 border-r border-gray-600 p-1 relative hover:bg-gray-700 transition-colors min-w-0"
                >
                  {/* Events */}
                  {dayEvents.map(event => {
                    const statusColors = {
                      scheduled: 'bg-blue-900 text-blue-200 border-blue-700',
                      publishing: 'bg-amber-900 text-amber-200 border-amber-700',
                      published: 'bg-green-900 text-green-200 border-green-700',
                      failed: 'bg-red-900 text-red-200 border-red-700',
                      cancelled: 'bg-gray-600 text-gray-200 border-gray-500'
                    }
                    const colorClass = statusColors[event.status as keyof typeof statusColors] || statusColors.scheduled
                    
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick?.(event)
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onEventRightClick?.(event, e)
                        }}
                        className={`mb-1 px-2 py-1 text-xs rounded border cursor-pointer hover:shadow-sm transition-shadow ${colorClass} w-full overflow-hidden text-ellipsis whitespace-nowrap`}
                        title={`${event.title} - ${event.status} (Right-click for options)`}
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
                          className="w-full flex items-center justify-center py-1 px-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-600 border border-dashed border-gray-500 hover:border-gray-400 rounded transition-colors group"
                        >
                          <PlusIcon className="w-3 h-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs">
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
                        id: `${day.toString()}-${hour}-${minute}`, 
                        time: fullTime,
                        hour,
                        minute
                      })}
                      className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 hover:bg-gray-600 hover:bg-opacity-80 transition-all group"
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded-full transition-colors">
                        <PlusIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          )
        })}
      </div>
    </div>
  )
}

export default NewCalendar