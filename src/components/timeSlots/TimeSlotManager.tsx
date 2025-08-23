'use client'

/**
 * TimeSlotManager Component
 * Manages time slot configuration with day-of-week selection and time picker
 */

import React, { useState, useEffect } from 'react'
import type {
  TimeSlotConfig,
  TimeSlotRequest,
  DayOfWeek,
  ValidationResult
} from '../../types'
import { validateTimeSlot, validateTimeSlotBatch, getCommonTimezones } from '../../utils/timeSlotValidation'
import { TimeSlotEditor } from './TimeSlotEditor'
import { TimeSlotList } from './TimeSlotList'

interface TimeSlotManagerProps {
  timeSlots: TimeSlotConfig[]
  onSave: (slots: TimeSlotRequest[]) => Promise<void>
  loading?: boolean
  className?: string
}

interface TimeSlotDraft extends TimeSlotRequest {
  id?: string
  isNew?: boolean
}

const DAYS_OF_WEEK = [
  { value: 0 as DayOfWeek, label: 'Sunday', short: 'Sun' },
  { value: 1 as DayOfWeek, label: 'Monday', short: 'Mon' },
  { value: 2 as DayOfWeek, label: 'Tuesday', short: 'Tue' },
  { value: 3 as DayOfWeek, label: 'Wednesday', short: 'Wed' },
  { value: 4 as DayOfWeek, label: 'Thursday', short: 'Thu' },
  { value: 5 as DayOfWeek, label: 'Friday', short: 'Fri' },
  { value: 6 as DayOfWeek, label: 'Saturday', short: 'Sat' }
]

export function TimeSlotManager({ 
  timeSlots, 
  onSave, 
  loading = false,
  className = ''
}: TimeSlotManagerProps) {
  const [draftSlots, setDraftSlots] = useState<TimeSlotDraft[]>([])
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1) // Default to Monday
  const [isEditing, setIsEditing] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationResult | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize draft slots from props
  useEffect(() => {
    const drafts: TimeSlotDraft[] = timeSlots.map(slot => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      time: slot.time,
      timezone: slot.timezone,
      isActive: slot.isActive,
      isNew: false
    }))
    setDraftSlots(drafts)
    setHasChanges(false)
  }, [timeSlots])

  // Group slots by day for display
  const slotsByDay = React.useMemo(() => {
    const grouped = new Map<DayOfWeek, TimeSlotDraft[]>()
    
    DAYS_OF_WEEK.forEach(day => {
      grouped.set(day.value, [])
    })

    draftSlots.forEach(slot => {
      const daySlots = grouped.get(slot.dayOfWeek) || []
      daySlots.push(slot)
      grouped.set(slot.dayOfWeek, daySlots.sort((a, b) => a.time.localeCompare(b.time)))
    })

    return grouped
  }, [draftSlots])

  // Get slots for selected day
  const selectedDaySlots = slotsByDay.get(selectedDay) || []

  // Add new time slot
  const handleAddSlot = () => {
    const newSlot: TimeSlotDraft = {
      dayOfWeek: selectedDay,
      time: '09:00',
      timezone: 'UTC',
      isActive: true,
      isNew: true
    }
    
    setDraftSlots(prev => [...prev, newSlot])
    setHasChanges(true)
    setIsEditing(true)
  }

  // Update a time slot
  const handleUpdateSlot = (index: number, updates: Partial<TimeSlotDraft>) => {
    setDraftSlots(prev => {
      const newSlots = [...prev]
      const slotIndex = prev.findIndex((slot, i) => {
        const daySlots = slotsByDay.get(selectedDay) || []
        return slot === daySlots[index]
      })
      
      if (slotIndex !== -1) {
        newSlots[slotIndex] = { ...newSlots[slotIndex], ...updates }
      }
      
      return newSlots
    })
    setHasChanges(true)
  }

  // Remove a time slot
  const handleRemoveSlot = (index: number) => {
    const daySlots = slotsByDay.get(selectedDay) || []
    const slotToRemove = daySlots[index]
    
    setDraftSlots(prev => prev.filter(slot => slot !== slotToRemove))
    setHasChanges(true)
  }

  // Validate all slots
  const validateAllSlots = (): ValidationResult => {
    const slotsToValidate: TimeSlotRequest[] = draftSlots
      .filter(slot => slot.isActive)
      .map(slot => ({
        dayOfWeek: slot.dayOfWeek,
        time: slot.time,
        timezone: slot.timezone,
        isActive: slot.isActive
      }))

    return validateTimeSlotBatch(slotsToValidate)
  }

  // Save changes
  const handleSave = async () => {
    const validation = validateAllSlots()
    setValidationErrors(validation)

    if (!validation.isValid) {
      return
    }

    try {
      const slotsToSave: TimeSlotRequest[] = draftSlots.map(slot => ({
        dayOfWeek: slot.dayOfWeek,
        time: slot.time,
        timezone: slot.timezone,
        isActive: slot.isActive ?? true
      }))

      await onSave(slotsToSave)
      setHasChanges(false)
      setIsEditing(false)
      setValidationErrors(null)
    } catch (error) {
      console.error('Failed to save time slots:', error)
      // Error handling could be improved with a toast notification
    }
  }

  // Cancel changes
  const handleCancel = () => {
    const originalDrafts: TimeSlotDraft[] = timeSlots.map(slot => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      time: slot.time,
      timezone: slot.timezone,
      isActive: slot.isActive,
      isNew: false
    }))
    
    setDraftSlots(originalDrafts)
    setHasChanges(false)
    setIsEditing(false)
    setValidationErrors(null)
  }

  // Toggle active state for a day
  const handleToggleDay = (dayOfWeek: DayOfWeek) => {
    const daySlots = slotsByDay.get(dayOfWeek) || []
    const hasActiveSlots = daySlots.some(slot => slot.isActive)
    
    setDraftSlots(prev => 
      prev.map(slot => 
        slot.dayOfWeek === dayOfWeek 
          ? { ...slot, isActive: !hasActiveSlots }
          : slot
      )
    )
    setHasChanges(true)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Slot Configuration</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure your posting schedule by setting time slots for each day of the week
          </p>
        </div>
        
        {hasChanges && (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors && !validationErrors.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Please fix the following errors:
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.errors.map((error, index) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Day Selection */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Days of Week</h3>
          <div className="space-y-2">
            {DAYS_OF_WEEK.map(day => {
              const daySlots = slotsByDay.get(day.value) || []
              const activeSlots = daySlots.filter(slot => slot.isActive)
              const hasSlots = daySlots.length > 0
              
              return (
                <div
                  key={day.value}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDay === day.value
                      ? 'border-blue-500 bg-blue-50'
                      : hasSlots
                      ? 'border-green-200 bg-green-50 hover:bg-green-100'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedDay(day.value)}
                >
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900">{day.label}</span>
                    {hasSlots && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({activeSlots.length} slot{activeSlots.length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  
                  {hasSlots && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleDay(day.value)
                      }}
                      className={`text-xs px-2 py-1 rounded ${
                        activeSlots.length > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {activeSlots.length > 0 ? 'Active' : 'Inactive'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Time Slot Configuration */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {DAYS_OF_WEEK.find(d => d.value === selectedDay)?.label} Time Slots
            </h3>
            <button
              onClick={handleAddSlot}
              className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add Time Slot
            </button>
          </div>

          {selectedDaySlots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No time slots</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding a time slot for {DAYS_OF_WEEK.find(d => d.value === selectedDay)?.label}.
              </p>
            </div>
          ) : (
            <TimeSlotList
              slots={selectedDaySlots}
              onUpdate={handleUpdateSlot}
              onRemove={handleRemoveSlot}
              isEditing={isEditing}
              onEditingChange={setIsEditing}
            />
          )}
        </div>
      </div>
    </div>
  )
}