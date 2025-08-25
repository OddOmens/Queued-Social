import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function getThreadsUserId() {
  console.log('🔍 Getting Threads User ID...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Get the credentials
    const { data: creds, error } = await supabase
      .from('platform_credentials')
      .select('*')
      .eq('platform', 'threads')
      .eq('is_active', true)
      .single()
    
    if (error || !creds) {
      console.error('❌ No credentials found:', error?.message)
      return
    }
    
    const accessToken = creds.credentials.accessToken
    console.log('🔑 Using access token:', accessToken ? `${accessToken.substring(0, 10)}...` : 'MISSING')
    
    // Try to get user info from Threads API
    console.log('\n🌐 Calling Threads API to get user info...')
    
    // Method 1: Try to get user info using "me" endpoint
    try {
      const response = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`)
      const data = await response.json()
      
      console.log('📥 User info response:', data)
      
      if (data.id) {
        console.log('✅ Found user ID:', data.id)
        
        // Update the credentials with the user ID
        const updatedCredentials = {
          ...creds.credentials,
          userId: data.id
        }
        
        const { error: updateError } = await supabase
          .from('platform_credentials')
          .update({
            credentials: updatedCredentials,
            updated_at: new Date().toISOString()
          })
          .eq('id', creds.id)
        
        if (updateError) {
          console.error('❌ Failed to update credentials:', updateError.message)
        } else {
          console.log('✅ Credentials updated with user ID!')
        }
        
        return data.id
      }
    } catch (error) {
      console.log('⚠️  Method 1 failed:', error.message)
    }
    
    // Method 2: Try different endpoint
    try {
      const response = await fetch(`https://graph.threads.net/v1.0/me?access_token=${accessToken}`)
      const data = await response.json()
      
      console.log('📥 Alternative endpoint response:', data)
      
      if (data.id) {
        console.log('✅ Found user ID via alternative method:', data.id)
        return data.id
      }
    } catch (error) {
      console.log('⚠️  Method 2 failed:', error.message)
    }
    
    console.log('❌ Could not retrieve user ID from Threads API')
    
  } catch (error) {
    console.error('❌ Failed:', error.message)
  }
}

getThreadsUserId().catch(console.error)