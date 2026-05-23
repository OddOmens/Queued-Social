import { test, expect } from '@playwright/test'

test.describe('Calendar Interaction', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication state
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      }))
    })
  })

  test('should display calendar view', async ({ page }) => {
    await page.goto('/calendar')
    
    await expect(page.locator('[data-testid="calendar-container"]')).toBeVisible()
    await expect(page.locator('[data-testid="calendar-navigation"]')).toBeVisible()
  })

  test('should navigate between months', async ({ page }) => {
    await page.goto('/calendar')
    
    // Click next month
    await page.click('[data-testid="next-month"]')
    
    // Verify month changed
    const monthDisplay = page.locator('[data-testid="current-month"]')
    await expect(monthDisplay).toBeVisible()
    
    // Click previous month
    await page.click('[data-testid="prev-month"]')
  })

  test('should switch calendar views', async ({ page }) => {
    await page.goto('/calendar')
    
    // Switch to week view
    await page.click('[data-testid="week-view"]')
    await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible()
    
    // Switch to day view
    await page.click('[data-testid="day-view"]')
    await expect(page.locator('[data-testid="calendar-day-view"]')).toBeVisible()
    
    // Switch back to month view
    await page.click('[data-testid="month-view"]')
    await expect(page.locator('[data-testid="calendar-month-view"]')).toBeVisible()
  })

  test('should display scheduled posts on calendar', async ({ page }) => {
    // Mock API response with scheduled posts
    await page.route('/api/posts', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          posts: [
            {
              id: '1',
              content: { text: 'Test post 1', type: 'single' },
              scheduledTime: new Date().toISOString(),
              platform: 'threads',
              status: 'scheduled'
            }
          ]
        })
      })
    })
    
    await page.goto('/calendar')
    
    // Should display the scheduled post
    await expect(page.locator('[data-testid="calendar-event"]')).toBeVisible()
  })

  test('should open post details modal', async ({ page }) => {
    // Mock API response
    await page.route('/api/posts', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          posts: [
            {
              id: '1',
              content: { text: 'Test post 1', type: 'single' },
              scheduledTime: new Date().toISOString(),
              platform: 'threads',
              status: 'scheduled'
            }
          ]
        })
      })
    })
    
    await page.goto('/calendar')
    
    // Click on a scheduled post
    await page.click('[data-testid="calendar-event"]')
    
    // Should open post details modal
    await expect(page.locator('[data-testid="post-detail-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="post-content"]')).toContainText('Test post 1')
  })
})