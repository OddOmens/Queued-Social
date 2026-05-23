import { test, expect } from '@playwright/test'

test.describe('Post Scheduling Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication state
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      }))
    })
  })

  test('should create a new post', async ({ page }) => {
    await page.goto('/posts/new')
    
    await expect(page.locator('h1')).toContainText('Create New Post')
    
    // Fill in post content
    await page.fill('[data-testid="post-content"]', 'This is a test post for scheduling')
    
    // Select platform
    await page.selectOption('[data-testid="platform-select"]', 'threads')
    
    // Choose scheduling option
    await page.click('[data-testid="next-slot-option"]')
    
    // Submit the form
    await page.click('button[type="submit"]')
    
    // Should redirect to posts list or show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should schedule post to custom time', async ({ page }) => {
    await page.goto('/posts/new')
    
    await page.fill('[data-testid="post-content"]', 'Custom scheduled post')
    await page.selectOption('[data-testid="platform-select"]', 'threads')
    
    // Choose custom time option
    await page.click('[data-testid="custom-time-option"]')
    
    // Set custom date and time
    await page.fill('[data-testid="custom-date"]', '2024-12-31')
    await page.fill('[data-testid="custom-time"]', '14:30')
    
    await page.click('button[type="submit"]')
    
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should create a thread post', async ({ page }) => {
    await page.goto('/posts/new')
    
    // Switch to thread mode
    await page.click('[data-testid="thread-mode-toggle"]')
    
    // Add first thread post
    await page.fill('[data-testid="thread-post-0"]', 'First post in thread')
    
    // Add second thread post
    await page.click('[data-testid="add-thread-post"]')
    await page.fill('[data-testid="thread-post-1"]', 'Second post in thread')
    
    await page.selectOption('[data-testid="platform-select"]', 'threads')
    await page.click('[data-testid="next-slot-option"]')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should upload media with post', async ({ page }) => {
    await page.goto('/posts/new')
    
    await page.fill('[data-testid="post-content"]', 'Post with media attachment')
    
    // Upload a test image
    const fileInput = page.locator('[data-testid="media-upload"]')
    await fileInput.setInputFiles('e2e/fixtures/test-image.jpg')
    
    // Wait for upload to complete
    await expect(page.locator('[data-testid="media-preview"]')).toBeVisible()
    
    await page.selectOption('[data-testid="platform-select"]', 'threads')
    await page.click('[data-testid="next-slot-option"]')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })
})