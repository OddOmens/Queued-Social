import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function checkPosts() {
  console.log('🔍 Checking all posts in the database...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Get all posts
    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('❌ Query failed:', error.message)
      return
    }
    
    console.log(`\n📊 Found ${posts?.length || 0} posts total`)
    
    if (posts && posts.length > 0) {
      posts.forEach((post, index) => {
        console.log(`\n${index + 1}. Post ID: ${post.id}`)
        console.log(`   Platform: ${post.platform}`)
        console.log(`   Status: ${post.status}`)
        console.log(`   Content: ${typeof post.content === 'string' ? post.content.substring(0, 100) : JSON.stringify(post.content).substring(0, 100)}...`)
        console.log(`   Scheduled: ${post.scheduled_time}`)
        console.log(`   Published: ${post.published_at || 'Not published'}`)
        console.log(`   Platform Post ID: ${post.platform_post_id || 'None'}`)
        console.log(`   Error: ${post.error_message || 'None'}`)
      })
      
      // Check for posts that were marked as published but have no platform_post_id
      const fakePublished = posts.filter(p => p.status === 'published' && !p.platform_post_id)
      if (fakePublished.length > 0) {
        console.log(`\n⚠️  Found ${fakePublished.length} posts marked as "published" but with no platform_post_id`)
        console.log('   These were likely only simulated, not actually published to the platform')
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message)
  }
}

checkPosts().catch(console.error)