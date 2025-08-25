import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function addColumn() {
  console.log('🔧 Adding platform_post_id column...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Try to select the column to see if it exists
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('platform_post_id')
      .limit(1)
    
    if (error && error.message.includes('column "platform_post_id" does not exist')) {
      console.log('❌ Column does not exist, needs to be added manually')
      console.log('\n📋 Please run this SQL in your Supabase SQL Editor:')
      console.log('---')
      console.log('ALTER TABLE scheduled_posts ADD COLUMN platform_post_id VARCHAR(255);')
      console.log('CREATE INDEX idx_scheduled_posts_platform_post_id ON scheduled_posts(platform_post_id) WHERE platform_post_id IS NOT NULL;')
      console.log('---')
      console.log('\n🌐 Go to: https://supabase.com/dashboard/project/elbmmhzvvbwoumcjxjlf/sql')
    } else if (error) {
      console.error('❌ Unexpected error:', error.message)
    } else {
      console.log('✅ Column already exists!')
    }
    
  } catch (error) {
    console.error('❌ Failed:', error.message)
  }
}

addColumn().catch(console.error)