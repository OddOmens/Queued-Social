/**
 * Time Slot Components Tests
 * Tests for TimeSlotManager, TimeSlotEditor, and TimeSlotList components
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TimeSlotManager, TimeSlotEditor, TimeSlotList } from '../components/timeSlots'
import type { TimeSlotConfig, TimeSlotRequest } from '../types'

// Mock the validation utilities
vi.mock('../utils/timeSlotValidation', () => ({
  validateTimeSlot: vi.fn(() => ({ isValid: true, errors: [] })),
  validateTimeSlotBatch: vi.fn(() => ({ isValid: true, errors: [] })),
  getCommonTimezones: vi.fn(() => [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' }
  ]),
  formatTimeForDisplay: vi.fn((time, use12Hour) => use12Hour ? '9:00 AM' : '09:00'),
  convertTo24Hour: vi.fn((time, period) => '09:00')
}))

describe('TimeSlotEditor', () => {
  const mockSlot: TimeSlotRequest = {
    dayOfWeek: 1, // Monday
    time: '09:00',
    timezone: 'UTC',
    isActive: true
  }

  const mockProps = {
    slot: mockSlot,
    onSave: vi.fn(),
    onCancel: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render time slot editor with initial values', () => {
    render(<TimeSlotEditor {...mockProps} />)
    
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('UTC')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /active/i })).toBeChecked()
  })

  it('should call onSave when save button is clicked', async () => {
    render(<TimeSlotEditor {...mockProps} />)
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(mockProps.onSave).toHaveBeenCalledWith(mockSlot)
    })
  })

  it('should call onCancel when cancel button is clicked', () => {
    render(<TimeSlotEditor {...mockProps} />)
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)
    
    expect(mockProps.onCancel).toHaveBeenCalled()
  })

  it('should update time when time input changes', () => {
    render(<TimeSlotEditor {...mockProps} />)
    
    const timeInput = screen.getByDisplayValue('09:00')
    fireEvent.change(timeInput, { target: { value: '15:30' } })
    
    expect(timeInput).toHaveValue('15:30')
  })

  it('should toggle between 12-hour and 24-hour format', () => {
    render(<TimeSlotEditor {...mockProps} />)
    
    const formatToggle = screen.getByRole('button', { name: /12h/i })
    fireEvent.click(formatToggle)
    
    expect(screen.getByRole('button', { name: /24h/i })).toBeInTheDocument()
  })
})

describe('TimeSlotList', () => {
  const mockSlots = [
    {
      id: '1',
      dayOfWeek: 1 as const,
      time: '09:00',
      timezone: 'UTC',
      isActive: true
    },
    {
      id: '2',
      dayOfWeek: 1 as const,
      time: '15:00',
      timezone: 'UTC',
      isActive: false
    }
  ]

  const mockProps = {
    slots: mockSlots,
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    isEditing: false,
    onEditingChange: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render list of time slots', () => {
    render(<TimeSlotList {...mockProps} />)
    
    expect(screen.getByText('9:00 AM')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('should call onUpdate when active status is toggled', () => {
    render(<TimeSlotList {...mockProps} />)
    
    const activeButton = screen.getByText('Active')
    fireEvent.click(activeButton)
    
    expect(mockProps.onUpdate).toHaveBeenCalledWith(0, { isActive: false })
  })

  it('should call onRemove when remove button is clicked', () => {
    render(<TimeSlotList {...mockProps} />)
    
    const removeButtons = screen.getAllByText('Remove')
    fireEvent.click(removeButtons[0])
    
    expect(mockProps.onRemove).toHaveBeenCalledWith(0)
  })

  it('should enter edit mode when edit button is clicked', () => {
    render(<TimeSlotList {...mockProps} />)
    
    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])
    
    expect(mockProps.onEditingChange).toHaveBeenCalledWith(true)
  })

  it('should show empty state when no slots provided', () => {
    render(<TimeSlotList {...mockProps} slots={[]} />)
    
    expect(screen.getByText('No time slots configured for this day')).toBeInTheDocument()
  })
})

describe('TimeSlotManager', () => {
  const mockTimeSlots: TimeSlotConfig[] = [
    {
      id: '1',
      userId: 'user1',
      dayOfWeek: 1, // Monday
      time: '09:00',
      timezone: 'UTC',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  const mockProps = {
    timeSlots: mockTimeSlots,
    onSave: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render time slot manager with days of week', () => {
    render(<TimeSlotManager {...mockProps} />)
    
    expect(screen.getByText('Time Slot Configuration')).toBeInTheDocument()
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Tuesday')).toBeInTheDocument()
    expect(screen.getByText('Wednesday')).toBeInTheDocument()
  })

  it('should show slot count for days with slots', () => {
    render(<TimeSlotManager {...mockProps} />)
    
    expect(screen.getByText('(1 slot)')).toBeInTheDocument()
  })

  it('should allow adding new time slots', () => {
    render(<TimeSlotManager {...mockProps} />)
    
    const addButton = screen.getByRole('button', { name: /add time slot/i })
    expect(addButton).toBeInTheDocument()
    
    fireEvent.click(addButton)
    // Should show the new slot in editing mode
  })

  it('should show save/cancel buttons when changes are made', async () => {
    render(<TimeSlotManager {...mockProps} />)
    
    const addButton = screen.getByRole('button', { name: /add time slot/i })
    fireEvent.click(addButton)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  it('should call onSave when save changes is clicked', async () => {
    render(<TimeSlotManager {...mockProps} />)
    
    const addButton = screen.getByRole('button', { name: /add time slot/i })
    fireEvent.click(addButton)
    
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save changes/i })
      fireEvent.click(saveButton)
    })
    
    expect(mockProps.onSave).toHaveBeenCalled()
  })

  it('should show loading state', () => {
    render(<TimeSlotManager {...mockProps} loading={true} />)
    
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })
})