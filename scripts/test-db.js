#!/usr/bin/env node

/**
 * Database connection test script
 * Verifies that the database schema is properly set up
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testDatabaseSetup() {
  console.log('🧪 Testing database setup...\n');

  const tests = [
    {
      name: 'user_profiles table exists',
      test: () => supabase.from('user_profiles').select('count', { count: 'exact', head: true })
    },
    {
      name: 'time_slots table exists',
      test: () => supabase.from('time_slots').select('count', { count: 'exact', head: true })
    },
    {
      name: 'scheduled_posts table exists',
      test: () => supabase.from('scheduled_posts').select('count', { count: 'exact', head: true })
    },
    {
      name: 'platform_credentials table exists',
      test: () => supabase.from('platform_credentials').select('count', { count: 'exact', head: true })
    }
  ];

  let allPassed = true;

  for (const { name, test } of tests) {
    try {
      const { error } = await test();
      if (error) {
        console.log(`❌ ${name}: ${error.message}`);
        allPassed = false;
      } else {
        console.log(`✅ ${name}`);
      }
    } catch (err) {
      console.log(`❌ ${name}: ${err.message}`);
      allPassed = false;
    }
  }

  console.log('\n' + (allPassed ? '🎉 All tests passed!' : '❌ Some tests failed'));
  
  if (allPassed) {
    console.log('\n📋 Database schema is ready for use!');
    console.log('Next steps:');
    console.log('1. Start your Next.js development server: npm run dev');
    console.log('2. Begin implementing the authentication system (Task 4)');
  }
}

testDatabaseSetup().catch(console.error);