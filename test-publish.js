import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Simple Threads API test
async function testThreadsAPI() {
  console.log('🧪 Testing Threads API publishing...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Get the scheduled post
    const { data: post, error: postError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .single()
    
    if (postError || !post) {
      console.log('❌ No scheduled posts found:', postError?.message)
      return
    }
    
    console.log('📝 Found scheduled post:', {
      id: post.id,
      platform: post.platform,
      content: post.content,
      scheduled_time: post.scheduled_time
    })
    
    // Get credentials
    const { data: creds, error: credsError } = await supabase
      .from('platform_credentials')
      .select('*')
      .eq('user_id', post.user_id)
      .eq('platform', post.platform)
      .eq('is_active', true)
      .single()
    
    if (credsError || !creds) {
      console.log('❌ No credentials found:', credsError?.message)
      return
    }
    
    console.log('🔑 Found credentials for platform:', creds.platform)
    console.log('🔑 Access token exists:', !!creds.credentials.accessToken)
    console.log('🔑 User ID:', creds.credentials.userId)
    
    // Test the Threads API directly
    const content = typeof post.content === 'string' ? post.content : post.content.text
    
    console.log('\n🚀 Attempting to publish to Threads...')
    console.log('📝 Content:', content)
    
    // Step 1: Create the post
    const createResponse = await fetch(`https://graph.threads.net/v1.0/${creds.credentials.userId}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: content,
        access_token: creds.credentials.accessToken
      })
    })
    
    const createResult = await createResponse.json()
    console.log('📤 Create response:', createResult)
    
    if (!createResponse.ok || createResult.error) {
      console.error('❌ Create failed:', createResult)
      
      // Mark as failed in database
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: `Create failed: ${JSON.stringify(createResult)}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)
      
      return
    }
    
    // Step 2: Publish the post
    console.log('\n📡 Publishing the created post...')
    const publishResponse = await fetch(`https://graph.threads.net/v1.0/${creds.credentials.userId}/threads_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        creation_id: createResult.id,
        access_token: creds.credentials.accessToken
      })
    })
    
    const publishResult = await publishResponse.json()
    console.log('📡 Publish response:', publishResult)
    
    if (!publishResponse.ok || publishResult.error) {
      console.error('❌ Publish failed:', publishResult)
      
      // Mark as failed in database
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: `Publish failed: ${JSON.stringify(publishResult)}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)
      
      return
    }
    
    // Success! Update the database
    console.log('✅ Successfully published to Threads!')
    console.log('🆔 Threads Post ID:', publishResult.id)
    
    const updateData = {
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { error: updateError } = await supabase
      .from('scheduled_posts')
      .update(updateData)
      .eq('id', post.id)
    
    if (updateError) {
      console.error('⚠️  Database update failed:', updateError.message)
    } else {
      console.log('✅ Database updated successfully!')
    }
    
    console.log('\n🎉 Post should now be visible on your Threads account!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testThreadsAPI().catch(console.error)