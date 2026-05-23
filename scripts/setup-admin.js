#!/usr/bin/env node

/**
 * Admin Email Configuration Script
 * Configure admin email addresses for Google OAuth users
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function setupAdminEmails() {
  try {
    console.log('🔧 Admin Email Configuration')
    console.log('Since you\'re using Google OAuth, we\'ll configure admin access by email address.\n')

    const adminConfigPath = path.join(__dirname, '..', 'src', 'config', 'admin.ts')
    
    // Read current config
    let currentEmails = []
    try {
      const currentConfig = fs.readFileSync(adminConfigPath, 'utf8')
      const emailMatches = currentConfig.match(/['"`]([^'"`]+@[^'"`]+)['"`]/g)
      if (emailMatches) {
        currentEmails = emailMatches.map(match => match.slice(1, -1))
      }
    } catch (error) {
      // File doesn't exist or can't be read, that's okay
    }

    if (currentEmails.length > 0) {
      console.log('Current admin emails:')
      currentEmails.forEach((email, index) => {
        console.log(`  ${index + 1}. ${email}`)
      })
      console.log()
    }

    const emails = []
    
    console.log('Enter admin email addresses (press Enter with empty input to finish):')
    
    let emailIndex = 1
    while (true) {
      const email = await question(`Admin email ${emailIndex}: `)
      
      if (!email.trim()) {
        break
      }
      
      // Basic email validation
      if (!email.includes('@') || !email.includes('.')) {
        console.log('⚠️  Invalid email format, please try again.')
        continue
      }
      
      emails.push(email.trim().toLowerCase())
      emailIndex++
    }

    if (emails.length === 0) {
      console.log('❌ No admin emails provided. Exiting.')
      rl.close()
      return
    }

    // Generate the config file content
    const configContent = `/**
 * Admin Configuration
 * Configure admin email addresses here
 */

// Admin email addresses - users with these emails will have admin privileges
export const ADMIN_EMAILS = [
${emails.map(email => `  '${email}',`).join('\n')}
]

/**
 * Check if an email is an admin email
 */
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * Get all admin emails (for display purposes)
 */
export function getAdminEmails(): string[] {
  return [...ADMIN_EMAILS]
}`

    // Write the config file
    fs.writeFileSync(adminConfigPath, configContent)

    console.log('\n✅ Admin configuration updated!')
    console.log('\nAdmin emails configured:')
    emails.forEach((email, index) => {
      console.log(`  ${index + 1}. ${email}`)
    })

    console.log('\n📝 Next steps:')
    console.log('1. Update your database migration with the admin emails')
    console.log('2. Run the migration: npm run migrate')
    console.log('3. Users with these emails can access /admin after signing in with Google')

    // Update migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '009_admin_service_control.sql')
    try {
      let migrationContent = fs.readFileSync(migrationPath, 'utf8')
      
      // Replace the placeholder email with actual emails
      const emailArray = emails.map(email => `'${email}'`).join(', ')
      migrationContent = migrationContent.replace(
        /ARRAY\['your-admin-email@gmail\.com'\]/g,
        `ARRAY[${emailArray}]`
      )
      
      fs.writeFileSync(migrationPath, migrationContent)
      console.log('✅ Migration file updated with admin emails')
    } catch (error) {
      console.log('⚠️  Could not update migration file automatically. Please update it manually.')
    }

  } catch (error) {
    console.error('❌ Error setting up admin emails:', error.message)
  } finally {
    rl.close()
  }
}

setupAdminEmails()