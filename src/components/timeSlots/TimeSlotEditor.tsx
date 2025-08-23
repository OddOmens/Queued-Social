'use client'

/**
 * TimeSlotEditor Component
 * Individual time slot editor with time picker and timezone support
 */

import React, { useState, useEffect } from 'react'
import type { TimeSlotRequest, DayOfWeek } from '../../types'
import { validateTimeSlot, getCommonTimezones, formatTimeForDisplay, convertTo24Hour } from '../../utils/timeSlotValidation'

interface TimeSlotEditorProps {
  slot: TimeSlotRequest & { id?: string }
  onSave: (slot: TimeSlotRequest) => void
  onCancel: () => void
  className?: string
}

export function TimeSlotEditor({ slot, onSave, onCancel, className = '' }: TimeSlotEditorProps) {
  const [time, setTime] = useState(slot.time)
  const [timezone, setTimezone] = useState(slot.timezone)
  const [isActive, setIsActive] = useState(slot.isActive ?? true)
  const [use12Hour, setUse12Hour] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const timezones = getCommonTimezones()

  // Convert 24-hour time to 12-hour for display
  const get12HourTime = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return {
      time: `${displayHours}:${minutes.toString().padStart(2, '0')}`,
      period
    }
  }

  // Handle time change for 12-hour format
  const handle12HourTimeChange = (newTime: string, period: 'AM' | 'PM') => {
    const time24 = convertTo24Hour(newTime, period)
    setTime(time24)
  }

  // Validate current values
  const validateCurrentSlot = () => {
    const validation = validateTimeSlot({
      dayOfWeek: slot.dayOfWeek,
      time,
      timezone,
      isActive
    })
    
    setErrors(validation.errors.map(e => e.message))
    return validation.isValid
  }

  // Handle save
  const handleSave = () => {
    if (validateCurrentSlot()) {
      onSave({
        dayOfWeek: slot.dayOfWeek,
        time,
        timezone,
        isActive
      })
    }
  }

  // Validate on changes
  useEffect(() => {
    validateCurrentSlot()
  }, [time, timezone, isActive])

  const { time: displayTime, period } = use12Hour ? get12HourTime(time) : { time, period: 'AM' }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 space-y-4 ${className}`}>
      {/* Time Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time
        </label>
        <div className="flex items-center space-x-2">
          {use12Hour ? (
            <>
              <input
                type="time"
                value={displayTime}
                onChange={(e) => handle12HourTimeChange(e.target.value, period as 'AM' | 'PM')}
                className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <select
                value={period}
                onChange={(e) => handle12HourTimeChange(displayTime, e.target.value as 'AM' | 'PM')}
                className="block w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </>
          ) : (
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          )}
          
          <button
            type="button"
            onClick={() => setUse12Hour(!use12Hour)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {use12Hour ? '24h' : '12h'}
          </button>
        </div>
        
        {use12Hour && (
          <p className="mt-1 text-xs text-gray-500">
            24-hour format: {formatTimeForDisplay(time)}
          </p>
        )}
      </div>

      {/* Timezone Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Timezone
        </label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          {timezones.map(tz => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      {/* Active Toggle */}
      <div className="flex items-center">
        <input
          id="active-toggle"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="active-toggle" className="ml-2 block text-sm text-gray-900">
          Active
        </label>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={errors.length > 0}
          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  )
}