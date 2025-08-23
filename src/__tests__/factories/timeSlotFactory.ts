import { TimeSlotConfig } from '@/types'

export interface TimeSlotFactoryOptions {
  id?: string
  userId?: string
  dayOfWeek?: number
  time?: string
  timezone?: string
  isActive?: boolean
}

export const createMockTimeSlot = (options: TimeSlotFactoryOptions = {}): TimeSlotConfig => {
  const defaultTimeSlot: TimeSlotConfig = {
    id: 'slot-123',
    userId: 'user-123',
    dayOfWeek: 1, // Monday
    time: '09:00',
    timezone: 'UTC',
    isActive: true,
  }

  return {
    ...defaultTimeSlot,
    ...options,
  }
}

export const createMockTimeSlots = (
  count: number,
  baseOptions: TimeSlotFactoryOptions = {}
): TimeSlotConfig[] => {
  return Array.from({ length: count }, (_, index) => {
    const dayOfWeek = index % 7
    const hour = 9 + (index % 12)
    const time = `${hour.toString().padStart(2, '0')}:00`

    return createMockTimeSlot({
      ...baseOptions,
      id: `slot-${index + 1}`,
      dayOfWeek,
      time,
    })
  })
}

export const createMockWeeklyTimeSlots = (userId: string = 'user-123'): TimeSlotConfig[] => {
  const timeSlots: TimeSlotConfig[] = []
  
  // Create time slots for each day of the week
  for (let day = 1; day <= 5; day++) { // Monday to Friday
    const morningSlot = createMockTimeSlot({
      id: `slot-${day}-morning`,
      userId,
      dayOfWeek: day,
      time: '09:00',
    })

    const afternoonSlot = createMockTimeSlot({
      id: `slot-${day}-afternoon`,
      userId,
      dayOfWeek: day,
      time: '15:00',
    })

    timeSlots.push(morningSlot, afternoonSlot)
  }

  return timeSlots
}

export const createMockTimeSlotsForDay = (
  dayOfWeek: number,
  times: string[],
  userId: string = 'user-123'
): TimeSlotConfig[] => {
  return times.map((time, index) =>
    createMockTimeSlot({
      id: `slot-${dayOfWeek}-${index}`,
      userId,
      dayOfWeek,
      time,
    })
  )
}

export const createMockInactiveTimeSlot = (options: TimeSlotFactoryOptions = {}): TimeSlotConfig => {
  return createMockTimeSlot({
    ...options,
    isActive: false,
  })
}

export const createMockTimeSlotsWithTimezones = (): TimeSlotConfig[] => {
  const timezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']
  
  return timezones.map((timezone, index) =>
    createMockTimeSlot({
      id: `slot-${timezone}-${index}`,
      dayOfWeek: index + 1,
      time: '12:00',
      timezone,
    })
  )
}