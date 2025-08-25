import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function findUserId() {
  console.log('🔍 Trying to find the correct user ID...')
  
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
    console.log('🔑 Using access token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING')
    
    // Try different approaches to get user ID
    const approaches = [
      // Method 1: Use 'me' as user ID
      { name: 'Using "me" as user ID', userId: 'me' },
      
      // Method 2: Try to get user info first
      { name: 'Getting user info from /me endpoint', userId: null, getInfo: true }
    ]
    
    for (const approach of approaches) {
      console.log(`\n🧪 ${approach.name}...`)
      
      try {
        if (approach.getInfo) {
          // Try to get user info
          const infoResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=${accessToken}`)
          const infoData = await infoResponse.json()
          
          console.log('📥 User info response:', infoData)
          
          if (infoData.id) {
            console.log('✅ Found user ID from /me endpoint:', infoData.id)
            approach.userId = infoData.id
          } else if (infoData.error) {
            console.log('❌ Error getting user info:', infoData.error.message)
            continue
          }
        }
        
        if (approach.userId) {
          // Test creating a post with this user ID
          console.log(`🧪 Testing post creation with user ID: ${approach.userId}`)
          
          const createResponse = await fetch(`https://graph.threads.net/v1.0/${approach.userId}/threads`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              media_type: 'TEXT',
              text: 'Test post from scheduler app',
              access_token: accessToken
            })
          })
          
          const createData = await createResponse.json()
          console.log('📥 Create response:', createData)
          
          if (!createData.error) {
            console.log('✅ SUCCESS! This user ID works:', approach.userId)
            
            // Update credentials with the correct user ID
            const updatedCredentials = {
              ...creds.credentials,
              userId: approach.userId
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
              console.log('✅ Credentials updated with working user ID!')
            }
            
            return approach.userId
          } else {
            console.log('❌ This user ID doesn\'t work:', createData.error.message)
          }
        }
        
      } catch (error) {
        console.log('❌ Approach failed:', error.message)
      }
    }
    
    console.log('\n❌ Could not find a working user ID')
    console.log('💡 You may need to re-authenticate with Threads to get a fresh token with user_id')
    
  } catch (error) {
    console.error('❌ Failed:', error.message)
  }
}

findUserId().catch(console.error)