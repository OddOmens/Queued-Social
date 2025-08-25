import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get posts scheduled for publishing (within the last minute to current time)
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)
    
    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_time', now.toISOString())
      .gte('scheduled_time', oneMinuteAgo.toISOString())

    if (error) {
      console.error('Error fetching scheduled posts:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch scheduled posts' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No posts to process', processed: 0 }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Processing ${posts.length} scheduled posts`)
    
    let processed = 0
    let failed = 0

    // Process each post
    for (const post of posts) {
      try {
        // For now, we'll simulate posting by marking as published
        // In a real implementation, you'd call the actual platform APIs here
        
        // Update post status to published
        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id)

        if (updateError) {
          console.error(`Error updating post ${post.id}:`, updateError)
          
          // Mark as failed
          await supabase
            .from('scheduled_posts')
            .update({
              status: 'failed',
              error_message: updateError.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', post.id)
          
          failed++
        } else {
          console.log(`Successfully processed post ${post.id}`)
          processed++
        }
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error)
        
        // Mark as failed
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id)
        
        failed++
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${processed} posts, ${failed} failed`,
        processed,
        failed
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})