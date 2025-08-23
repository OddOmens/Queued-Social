import { test, expect } from '@playwright/test'

test.describe('Time Slots Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication state
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      }))
    })
  })

  test('should display time slots settings page', async ({ page }) => {
    await page.goto('/settings/time-slots')
    
    await expect(page.locator('h1')).toContainText('Time Slots')
    await expect(page.locator('[data-testid="time-slot-manager"]')).toBeVisible()
  })

  test('should add new time slot', async ({ page }) => {
    await page.goto('/settings/time-slots')
    
    // Select a day of the week
    await page.selectOption('[data-testid="day-select"]', '1') // Monday
    
    // Set time
    await page.fill('[data-testid="time-input"]', '09:00')
    
    // Add the time slot
    await page.click('[data-testid="add-time-slot"]')
    
    // Should display the new time slot
    await expect(page.locator('[data-testid="time-slot-item"]')).toBeVisible()
  })

  test('should edit existing time slot', async ({ page }) => {
    // Mock existing time slots
    await page.route('/api/time-slots', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timeSlots: [
            {
              id: '1',
              dayOfWeek: 1,
              time: '09:00',
              timezone: 'UTC',
              isActive: true
            }
          ]
        })
      })
    })
    
    await page.goto('/settings/time-slots')
    
    // Click edit button
    await page.click('[data-testid="edit-time-slot-1"]')
    
    // Modify time
    await page.fill('[data-testid="edit-time-input"]', '10:00')
    
    // Save changes
    await page.click('[data-testid="save-time-slot"]')
    
    // Should show updated time
    await expect(page.locator('[data-testid="time-slot-time"]')).toContainText('10:00')
  })

  test('should delete time slot', async ({ page }) => {
    // Mock existing time slots
    await page.route('/api/time-slots', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timeSlots: [
            {
              id: '1',
              dayOfWeek: 1,
              time: '09:00',
              timezone: 'UTC',
              isActive: true
            }
          ]
        })
      })
    })
    
    await page.goto('/settings/time-slots')
    
    // Click delete button
    await page.click('[data-testid="delete-time-slot-1"]')
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]')
    
    // Time slot should be removed
    await expect(page.locator('[data-testid="time-slot-item"]')).not.toBeVisible()
  })

  test('should validate time slot conflicts', async ({ page }) => {
    await page.goto('/settings/time-slots')
    
    // Add first time slot
    await page.selectOption('[data-testid="day-select"]', '1')
    await page.fill('[data-testid="time-input"]', '09:00')
    await page.click('[data-testid="add-time-slot"]')
    
    // Try to add conflicting time slot
    await page.selectOption('[data-testid="day-select"]', '1')
    await page.fill('[data-testid="time-input"]', '09:00')
    await page.click('[data-testid="add-time-slot"]')
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('conflict')
  })
})