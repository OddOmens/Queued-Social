import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should display sign in page', async ({ page }) => {
    await page.goto('/auth/signin')
    
    await expect(page.locator('h1')).toContainText('Sign In')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should display sign up page', async ({ page }) => {
    await page.goto('/auth/signup')
    
    await expect(page.locator('h1')).toContainText('Sign Up')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.goto('/auth/signin')
    
    await page.fill('input[type="email"]', 'invalid-email')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })

  test('should navigate between sign in and sign up', async ({ page }) => {
    await page.goto('/auth/signin')
    
    await page.click('a[href="/auth/signup"]')
    await expect(page).toHaveURL('/auth/signup')
    
    await page.click('a[href="/auth/signin"]')
    await expect(page).toHaveURL('/auth/signin')
  })
})