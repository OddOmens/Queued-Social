'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { TimeSlotManager } from '@/components/timeSlots'
import type { TimeSlotConfig, TimeSlotRequest } from '@/types'

export default function TimeSlotsSettingsPage() {
  const [timeSlots, setTimeSlots] = useState<TimeSlotConfig[]>([])
  const [loading, setLoading] = useState(false)

  // Load time slots on component mount
  useEffect(() => {
    // TODO: Load time slots from API
    // For now, start with empty array
    setTimeSlots([])
  }, [])

  const handleSave = async (slots: TimeSlotRequest[]) => {
    setLoading(true)
    try {
      // TODO: Save time slots to API
      console.log('Saving time slots:', slots)
      
      // Convert TimeSlotRequest to TimeSlotConfig for local state
      const savedSlots: TimeSlotConfig[] = slots.map((slot, index) => ({
        id: `slot-${index}`,
        ...slot
      }))
      
      setTimeSlots(savedSlots)
    } catch (error) {
      console.error('Failed to save time slots:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Time Slots Configuration</h1>
          <p className="text-gray-600 mt-1">
            Set up your preferred posting times for each day of the week. These time slots will be used when scheduling posts to &quot;next available slot&quot;.
          </p>
        </div>
        
        {/* Time Slot Manager */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <TimeSlotManager 
            timeSlots={timeSlots}
            onSave={handleSave}
            loading={loading}
          />
        </div>
      </div>
    </AppLayout>
  )
}