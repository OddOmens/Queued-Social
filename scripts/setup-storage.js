#!/usr/bin/env node

/**
 * Setup script for Supabase Storage buckets
 * This script creates the necessary storage buckets for media files
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupStorageBuckets() {
  console.log('Setting up Supabase Storage buckets...')

  try {
    // Create media-files bucket
    console.log('Creating media-files bucket...')
    const { data: mediaData, error: mediaError } = await supabase.storage.createBucket('media-files', {
      public: true,
      allowedMimeTypes: [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/webm'
      ],
      fileSizeLimit: 50 * 1024 * 1024 // 50MB
    })

    if (mediaError && !mediaError.message.includes('already exists')) {
      console.error('Failed to create media-files bucket:', mediaError)
    } else {
      console.log('✓ media-files bucket created/exists')
    }

    // Create thumbnails bucket
    console.log('Creating thumbnails bucket...')
    const { data: thumbData, error: thumbError } = await supabase.storage.createBucket('thumbnails', {
      public: true,
      allowedMimeTypes: ['image/jpeg'],
      fileSizeLimit: 5 * 1024 * 1024 // 5MB
    })

    if (thumbError && !thumbError.message.includes('already exists')) {
      console.error('Failed to create thumbnails bucket:', thumbError)
    } else {
      console.log('✓ thumbnails bucket created/exists')
    }

    // Set up RLS policies for buckets
    console.log('Setting up RLS policies...')
    
    // Policy for media-files bucket
    const mediaPolicy = `
      CREATE POLICY "Users can upload their own media files" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'media-files' AND auth.uid()::text = (storage.foldername(name))[1]);
      
      CREATE POLICY "Users can view their own media files" ON storage.objects
      FOR SELECT USING (bucket_id = 'media-files' AND auth.uid()::text = (storage.foldername(name))[1]);
      
      CREATE POLICY "Users can delete their own media files" ON storage.objects
      FOR DELETE USING (bucket_id = 'media-files' AND auth.uid()::text = (storage.foldername(name))[1]);
    `

    // Policy for thumbnails bucket
    const thumbPolicy = `
      CREATE POLICY "Users can upload their own thumbnails" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
      
      CREATE POLICY "Users can view their own thumbnails" ON storage.objects
      FOR SELECT USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
      
      CREATE POLICY "Users can delete their own thumbnails" ON storage.objects
      FOR DELETE USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
    `

    console.log('Note: RLS policies should be set up manually in Supabase dashboard or via SQL:')
    console.log('Media files policies:')
    console.log(mediaPolicy)
    console.log('\nThumbnails policies:')
    console.log(thumbPolicy)

    console.log('\n✅ Storage setup completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Set up RLS policies in Supabase dashboard')
    console.log('2. Run database migrations: npm run migrate')
    console.log('3. Test media upload functionality')

  } catch (error) {
    console.error('Storage setup failed:', error)
    process.exit(1)
  }
}

setupStorageBuckets()