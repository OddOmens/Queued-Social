import { test, expect } from '@playwright/test'

test.describe('Basic Playwright Setup', () => {
  test('should be able to navigate to a webpage', async ({ page }) => {
    await page.goto('https://example.com')
    
    await expect(page.locator('h1')).toContainText('Example Domain')
    await expect(page).toHaveTitle(/Example Domain/)
  })

  test('should be able to interact with page elements', async ({ page }) => {
    await page.goto('data:text/html,<html><body><h1>Test Page</h1><button id="test-btn">Click me</button><div id="result"></div></body></html>')
    
    await expect(page.locator('h1')).toContainText('Test Page')
    await expect(page.locator('#test-btn')).toBeVisible()
    
    // Add some JavaScript to make the button interactive
    await page.addScriptTag({
      content: `
        document.getElementById('test-btn').addEventListener('click', function() {
          document.getElementById('result').textContent = 'Button clicked!';
        });
      `
    })
    
    await page.click('#test-btn')
    await expect(page.locator('#result')).toContainText('Button clicked!')
  })

  test('should handle form interactions', async ({ page }) => {
    await page.goto('data:text/html,<html><body><form><input type="text" id="name" placeholder="Enter name"><input type="email" id="email" placeholder="Enter email"><button type="submit">Submit</button></form></body></html>')
    
    await page.fill('#name', 'Test User')
    await page.fill('#email', 'test@example.com')
    
    await expect(page.locator('#name')).toHaveValue('Test User')
    await expect(page.locator('#email')).toHaveValue('test@example.com')
  })
})