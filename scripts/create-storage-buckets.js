#!/usr/bin/env node

/**
 * Script to create Supabase storage buckets for media files
 * Run with: node scripts/create-storage-buckets.js
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createStorageBuckets() {
  console.log('🚀 Creating Supabase storage buckets...')
  
  try {
    // Create media-files bucket
    console.log('📁 Creating media-files bucket...')
    const { error: mediaError } = await supabase.storage.createBucket('media-files', {
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
    
    if (mediaError) {
      if (mediaError.message.includes('already exists')) {
        console.log('✅ media-files bucket already exists')
      } else {
        console.error('❌ Failed to create media-files bucket:', mediaError)
      }
    } else {
      console.log('✅ media-files bucket created successfully')
    }

    // Create thumbnails bucket
    console.log('📁 Creating thumbnails bucket...')
    const { error: thumbError } = await supabase.storage.createBucket('thumbnails', {
      public: true,
      allowedMimeTypes: ['image/jpeg'],
      fileSizeLimit: 5 * 1024 * 1024 // 5MB
    })
    
    if (thumbError) {
      if (thumbError.message.includes('already exists')) {
        console.log('✅ thumbnails bucket already exists')
      } else {
        console.error('❌ Failed to create thumbnails bucket:', thumbError)
      }
    } else {
      console.log('✅ thumbnails bucket created successfully')
    }

    // List all buckets to verify
    console.log('\n📋 Listing all storage buckets:')
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('❌ Failed to list buckets:', listError)
    } else {
      buckets.forEach(bucket => {
        console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`)
      })
    }

    console.log('\n🎉 Storage bucket setup complete!')
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

createStorageBuckets()