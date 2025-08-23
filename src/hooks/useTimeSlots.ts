/**
 * useTimeSlots Hook
 * Custom hook for managing time slot state and operations
 */

import { useState, useEffect, useCallback } from 'react'
import { timeSlotService } from '../services/timeSlots'
import type {
  TimeSlotConfig,
  TimeSlotRequest,
  DayOfWeek,
  UseTimeSlotReturn
} from '../types'

export function useTimeSlots(userId: string): UseTimeSlotReturn {
  const [timeSlots, setTimeSlots] = useState<TimeSlotConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  // Fetch time slots
  const fetchTimeSlots = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const slots = await timeSlotService.getUserTimeSlots(userId)
      setTimeSlots(slots)
    } catch (err) {
      setError(err)
      console.error('Failed to fetch time slots:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Update time slots (bulk replace)
  const updateTimeSlots = useCallback(async (slots: TimeSlotRequest[]) => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const updatedSlots = await timeSlotService.bulkUpdateTimeSlots(userId, slots)
      setTimeSlots(updatedSlots)
    } catch (err) {
      setError(err)
      throw err // Re-throw so components can handle the error
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Get next available slot
  const getNextAvailableSlot = useCallback((): Date | null => {
    if (timeSlots.length === 0) return null

    const activeSlots = timeSlots.filter(slot => slot.isActive)
    if (activeSlots.length === 0) return null

    const now = new Date()
    const currentDay = now.getDay() as DayOfWeek
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

    // Sort slots by day and time
    const sortedSlots = activeSlots.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek - b.dayOfWeek
      }
      return a.time.localeCompare(b.time)
    })

    // Find the next available slot
    for (let daysAhead = 0; daysAhead < 14; daysAhead++) { // Look up to 2 weeks ahead
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + daysAhead)
      const targetDay = targetDate.getDay() as DayOfWeek

      const daySlots = sortedSlots.filter(slot => slot.dayOfWeek === targetDay)
      
      for (const slot of daySlots) {
        const slotDateTime = new Date(targetDate)
        const [hours, minutes] = slot.time.split(':').map(Number)
        slotDateTime.setHours(hours, minutes, 0, 0)

        // Skip if this slot is in the past
        if (slotDateTime <= now) {
          continue
        }

        return slotDateTime
      }
    }

    return null // No available slots found
  }, [timeSlots])

  // Get time slots for a specific day
  const getTimeSlotsForDay = useCallback((dayOfWeek: DayOfWeek) => {
    return timeSlots.filter(slot => slot.dayOfWeek === dayOfWeek && slot.isActive)
  }, [timeSlots])

  // Get available slots for a date range
  const getAvailableSlots = useCallback(async (startDate: Date, endDate: Date) => {
    if (!userId) return []

    try {
      return await timeSlotService.getAvailableSlots(userId, startDate, endDate)
    } catch (err) {
      console.error('Failed to get available slots:', err)
      return []
    }
  }, [userId])

  // Create a single time slot
  const createTimeSlot = useCallback(async (timeSlotData: TimeSlotRequest) => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const newSlot = await timeSlotService.createTimeSlot(userId, timeSlotData)
      setTimeSlots(prev => [...prev, newSlot])
      return newSlot
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Update a single time slot
  const updateTimeSlot = useCallback(async (timeSlotId: string, updates: Partial<TimeSlotRequest>) => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const updatedSlot = await timeSlotService.updateTimeSlot(userId, timeSlotId, updates)
      setTimeSlots(prev => prev.map(slot => slot.id === timeSlotId ? updatedSlot : slot))
      return updatedSlot
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Delete a time slot
  const deleteTimeSlot = useCallback(async (timeSlotId: string) => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      await timeSlotService.deleteTimeSlot(timeSlotId)
      setTimeSlots(prev => prev.filter(slot => slot.id !== timeSlotId))
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Refetch time slots
  const refetch = useCallback(() => {
    return fetchTimeSlots()
  }, [fetchTimeSlots])

  // Initial fetch
  useEffect(() => {
    fetchTimeSlots()
  }, [fetchTimeSlots])

  return {
    timeSlots,
    loading,
    error,
    updateTimeSlots,
    getNextAvailableSlot,
    getTimeSlotsForDay,
    getAvailableSlots,
    createTimeSlot,
    updateTimeSlot,
    deleteTimeSlot,
    refetch
  }
}