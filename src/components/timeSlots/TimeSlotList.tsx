'use client'

/**
 * TimeSlotList Component
 * Displays a list of time slots with inline editing capabilities
 */

import React, { useState } from 'react'
import type { TimeSlotRequest } from '../../types'
import { formatTimeForDisplay } from '../../utils/timeSlotValidation'
import { TimeSlotEditor } from './TimeSlotEditor'

interface TimeSlotListProps {
  slots: (TimeSlotRequest & { id?: string; isNew?: boolean })[]
  onUpdate: (index: number, slot: Partial<TimeSlotRequest>) => void
  onRemove: (index: number) => void
  isEditing: boolean
  onEditingChange: (editing: boolean) => void
  className?: string
}

export function TimeSlotList({ 
  slots, 
  onUpdate, 
  onRemove, 
  isEditing,
  onEditingChange,
  className = '' 
}: TimeSlotListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    onEditingChange(true)
  }

  const handleSave = (index: number, updatedSlot: TimeSlotRequest) => {
    onUpdate(index, updatedSlot)
    setEditingIndex(null)
    onEditingChange(false)
  }

  const handleCancel = () => {
    setEditingIndex(null)
    onEditingChange(false)
  }

  const handleRemove = (index: number) => {
    if (editingIndex === index) {
      setEditingIndex(null)
      onEditingChange(false)
    }
    onRemove(index)
  }

  const handleToggleActive = (index: number) => {
    const slot = slots[index]
    onUpdate(index, { isActive: !slot.isActive })
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {slots.map((slot, index) => (
        <div key={slot.id || `new-${index}`} className="border border-gray-200 rounded-lg">
          {editingIndex === index ? (
            <TimeSlotEditor
              slot={slot}
              onSave={(updatedSlot) => handleSave(index, updatedSlot)}
              onCancel={handleCancel}
              className="border-0 rounded-lg"
            />
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Time Display */}
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-medium text-gray-900">
                      {formatTimeForDisplay(slot.time, true)}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({formatTimeForDisplay(slot.time)})
                    </span>
                  </div>

                  {/* Timezone */}
                  <div className="text-sm text-gray-600">
                    {slot.timezone}
                  </div>

                  {/* Status Badge */}
                  <button
                    onClick={() => handleToggleActive(index)}
                    disabled={isEditing}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      slot.isActive
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    } ${isEditing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    {slot.isActive ? 'Active' : 'Inactive'}
                  </button>

                  {/* New Badge */}
                  {slot.isNew && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      New
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(index)}
                    disabled={isEditing}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(index)}
                    disabled={isEditing}
                    className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Additional Info */}
              <div className="mt-2 text-xs text-gray-500">
                Posts will be scheduled at this time in {slot.timezone} timezone
              </div>
            </div>
          )}
        </div>
      ))}

      {slots.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p className="text-sm">No time slots configured for this day</p>
        </div>
      )}
    </div>
  )
}