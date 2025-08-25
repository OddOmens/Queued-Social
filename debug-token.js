import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function debugToken() {
  console.log('🔍 Debugging Threads token...')
  
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
    console.log('🔑 Full access token:', accessToken)
    
    // Parse the token - Threads tokens have format: TH|APP_ID|TOKEN
    const tokenParts = accessToken.split('|')
    console.log('🔍 Token parts:', tokenParts)
    
    if (tokenParts.length >= 2) {
      const appId = tokenParts[1]
      console.log('📱 App ID from token:', appId)
      console.log('📱 Expected App ID:', process.env.VITE_THREADS_CLIENT_ID)
      
      if (appId === process.env.VITE_THREADS_CLIENT_ID) {
        console.log('✅ App ID matches!')
      } else {
        console.log('❌ App ID mismatch!')
      }
    }
    
    // Check token expiry
    const expiresAt = new Date(creds.expires_at)
    const now = new Date()
    console.log('⏰ Token expires at:', expiresAt.toISOString())
    console.log('⏰ Current time:', now.toISOString())
    console.log('⏰ Token expired:', expiresAt < now)
    
    // Try a simple API call to test the token
    console.log('\n🧪 Testing token with a simple API call...')
    
    // According to Threads API docs, we might need to use the app ID as the user ID for some calls
    const testUserId = tokenParts[1] // This might be the user ID
    
    try {
      const response = await fetch(`https://graph.threads.net/v1.0/${testUserId}/threads?access_token=${accessToken}`)
      const data = await response.json()
      
      console.log('📥 API test response:', data)
      
      if (!data.error) {
        console.log('✅ Token seems to work with user ID:', testUserId)
        
        // Update credentials with this user ID
        const updatedCredentials = {
          ...creds.credentials,
          userId: testUserId
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
      }
    } catch (error) {
      console.log('❌ API test failed:', error.message)
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message)
  }
}

debugToken().catch(console.error)