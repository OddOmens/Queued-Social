'use client'

import React from 'react'
import moment from 'moment'

interface CalendarNavigationProps {
  currentDate: Date
  view: 'month' | 'week' | 'day'
  onDateChange: (date: Date) => void
  onViewChange: (view: 'month' | 'week' | 'day') => void
  onToday: () => void
  className?: string
}

const CalendarNavigation: React.FC<CalendarNavigationProps> = ({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onToday,
  className = ''
}) => {
  const handlePrevious = () => {
    const newDate = moment(currentDate).subtract(1, view).toDate()
    onDateChange(newDate)
  }

  const handleNext = () => {
    const newDate = moment(currentDate).add(1, view).toDate()
    onDateChange(newDate)
  }

  const getDateRangeText = () => {
    const momentDate = moment(currentDate)
    
    switch (view) {
      case 'month':
        return momentDate.format('MMMM YYYY')
      case 'week':
        const weekStart = momentDate.clone().startOf('week')
        const weekEnd = momentDate.clone().endOf('week')
        if (weekStart.month() === weekEnd.month()) {
          return `${weekStart.format('MMM D')} - ${weekEnd.format('D, YYYY')}`
        } else {
          return `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`
        }
      case 'day':
        return momentDate.format('dddd, MMMM D, YYYY')
      default:
        return momentDate.format('MMMM YYYY')
    }
  }

  const isToday = moment(currentDate).isSame(moment(), 'day')

  return (
    <div className={`flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Left side - Navigation controls */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onToday}
          disabled={isToday}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            isToday
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }`}
        >
          Today
        </button>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={handlePrevious}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Previous"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={handleNext}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Next"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Center - Current date range */}
      <div className="flex-1 text-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {getDateRangeText()}
        </h2>
      </div>

      {/* Right side - View controls */}
      <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {(['month', 'week', 'day'] as const).map((viewOption) => (
          <button
            key={viewOption}
            onClick={() => onViewChange(viewOption)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              view === viewOption
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            {viewOption}
          </button>
        ))}
      </div>
    </div>
  )
}

export default CalendarNavigation