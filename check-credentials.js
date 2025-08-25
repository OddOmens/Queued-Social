import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function checkCredentials() {
  console.log('🔍 Checking stored credentials...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    const { data: creds, error } = await supabase
      .from('platform_credentials')
      .select('*')
      .eq('platform', 'threads')
      .eq('is_active', true)
    
    if (error) {
      console.error('❌ Query failed:', error.message)
      return
    }
    
    if (!creds || creds.length === 0) {
      console.log('❌ No credentials found')
      return
    }
    
    console.log('📊 Found credentials:')
    creds.forEach((cred, index) => {
      console.log(`\n${index + 1}. Credential ID: ${cred.id}`)
      console.log(`   User ID: ${cred.user_id}`)
      console.log(`   Platform: ${cred.platform}`)
      console.log(`   Is Active: ${cred.is_active}`)
      console.log(`   Expires At: ${cred.expires_at}`)
      console.log(`   Credentials Object:`, JSON.stringify(cred.credentials, null, 2))
    })
    
  } catch (error) {
    console.error('❌ Check failed:', error.message)
  }
}

checkCredentials().catch(console.error)