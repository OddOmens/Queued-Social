import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testScheduler() {
  console.log('🔍 Testing scheduler and database setup...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check if platform_post_id column exists
    console.log('\n1. Checking database schema...')
    const { data: columns, error: schemaError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .limit(0)
    
    if (schemaError) {
      console.error('❌ Schema check failed:', schemaError.message)
    } else {
      console.log('✅ scheduled_posts table accessible')
    }
    
    // Test 2: Check for scheduled posts
    console.log('\n2. Checking for scheduled posts...')
    const { data: posts, error: postsError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_time', new Date().toISOString())
    
    if (postsError) {
      console.error('❌ Posts query failed:', postsError.message)
    } else {
      console.log(`✅ Found ${posts?.length || 0} posts ready for publishing`)
      if (posts && posts.length > 0) {
        console.log('Posts:', posts.map(p => ({
          id: p.id,
          platform: p.platform,
          content: typeof p.content === 'string' ? p.content.substring(0, 50) + '...' : p.content,
          scheduled_time: p.scheduled_time
        })))
      }
    }
    
    // Test 3: Check for platform credentials
    console.log('\n3. Checking platform credentials...')
    const { data: creds, error: credsError } = await supabase
      .from('platform_credentials')
      .select('platform, is_active, expires_at')
      .eq('is_active', true)
    
    if (credsError) {
      console.error('❌ Credentials query failed:', credsError.message)
    } else {
      console.log(`✅ Found ${creds?.length || 0} active platform credentials`)
      if (creds && creds.length > 0) {
        console.log('Credentials:', creds.map(c => ({
          platform: c.platform,
          is_active: c.is_active,
          expires_at: c.expires_at
        })))
      }
    }
    
    // Test 4: Try to add the platform_post_id column if it doesn't exist
    console.log('\n4. Adding platform_post_id column if needed...')
    try {
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS platform_post_id VARCHAR(255);'
      })
      
      if (alterError) {
        console.log('⚠️  Could not add column via RPC (this is normal):', alterError.message)
        console.log('💡 Please add this column manually in Supabase SQL editor:')
        console.log('   ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS platform_post_id VARCHAR(255);')
      } else {
        console.log('✅ platform_post_id column added successfully')
      }
    } catch (error) {
      console.log('⚠️  RPC method not available, manual migration needed')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testScheduler().catch(console.error)