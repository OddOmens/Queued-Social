import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function resetPost() {
  console.log('🔄 Resetting fake-published post back to scheduled...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Reset the post that was fake-published
    const { data, error } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'scheduled',
        published_at: null,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'a9b4e35a-0055-45a4-99a6-8005e1f8b887')
      .select()
    
    if (error) {
      console.error('❌ Reset failed:', error.message)
    } else {
      console.log('✅ Post reset successfully!')
      console.log('📝 Post details:', {
        id: data[0].id,
        status: data[0].status,
        scheduled_time: data[0].scheduled_time,
        published_at: data[0].published_at
      })
      
      // Check if it's ready to be published now
      const scheduledTime = new Date(data[0].scheduled_time)
      const now = new Date()
      
      if (scheduledTime <= now) {
        console.log('⏰ This post is ready to be published now!')
      } else {
        console.log(`⏰ This post is scheduled for: ${scheduledTime.toLocaleString()}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Reset failed:', error.message)
  }
}

resetPost().catch(console.error)