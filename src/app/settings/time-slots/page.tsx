'use client'

import React from 'react'
import { TimeSlotManager } from '@/components/timeSlots'

export default function TimeSlotsSettingsPage() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Time Slots Configuration</h2>
        <p className="text-gray-600 mt-1">
          Set up your preferred posting times for each day of the week. These time slots will be used when scheduling posts to &quot;next available slot&quot;.
        </p>
      </div>
      
      <TimeSlotManager />
    </div>
  )
}