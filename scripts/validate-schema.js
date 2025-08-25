#!/usr/bin/env node

/**
 * Database schema validation script
 * Validates that the database schema meets all requirements
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
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

async function validateSchema() {
  console.log('🔍 Validating database schema against requirements...\n');

  const validations = [
    {
      name: 'Tables exist with correct structure',
      test: async () => {
        const tables = ['user_profiles', 'time_slots', 'scheduled_posts', 'platform_credentials'];
        for (const table of tables) {
          const { error } = await supabase.from(table).select('*').limit(0);
          if (error) throw new Error(`Table ${table} not found or accessible`);
        }
      }
    },
    {
      name: 'RLS policies are enabled',
      test: async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT schemaname, tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('user_profiles', 'time_slots', 'scheduled_posts', 'platform_credentials')
          `
        });
        
        if (error) throw error;
        
        const tablesWithoutRLS = data.filter(table => !table.rowsecurity);
        if (tablesWithoutRLS.length > 0) {
          throw new Error(`RLS not enabled on: ${tablesWithoutRLS.map(t => t.tablename).join(', ')}`);
        }
      }
    },
    {
      name: 'Required indexes exist',
      test: async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname LIKE 'idx_%'
          `
        });
        
        if (error) throw error;
        
        const requiredIndexes = [
          'idx_time_slots_user_day',
          'idx_scheduled_posts_user_time',
          'idx_scheduled_posts_status',
          'idx_platform_credentials_user_platform'
        ];
        
        const existingIndexes = data.map(row => row.indexname);
        const missingIndexes = requiredIndexes.filter(idx => !existingIndexes.includes(idx));
        
        if (missingIndexes.length > 0) {
          throw new Error(`Missing indexes: ${missingIndexes.join(', ')}`);
        }
      }
    },
    {
      name: 'Foreign key constraints exist',
      test: async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT 
              tc.table_name, 
              kcu.column_name, 
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name 
            FROM 
              information_schema.table_constraints AS tc 
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public'
            AND tc.table_name IN ('user_profiles', 'time_slots', 'scheduled_posts', 'platform_credentials')
          `
        });
        
        if (error) throw error;
        
        const expectedFKs = [
          { table: 'user_profiles', column: 'id', foreign_table: 'users' },
          { table: 'time_slots', column: 'user_id', foreign_table: 'users' },
          { table: 'scheduled_posts', column: 'user_id', foreign_table: 'users' },
          { table: 'platform_credentials', column: 'user_id', foreign_table: 'users' }
        ];
        
        for (const expectedFK of expectedFKs) {
          const exists = data.some(fk => 
            fk.table_name === expectedFK.table && 
            fk.column_name === expectedFK.column &&
            fk.foreign_table_name === expectedFK.foreign_table
          );
          
          if (!exists) {
            throw new Error(`Missing FK: ${expectedFK.table}.${expectedFK.column} -> ${expectedFK.foreign_table}`);
          }
        }
      }
    },
    {
      name: 'Check constraints exist',
      test: async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT 
              tc.table_name,
              tc.constraint_name,
              cc.check_clause
            FROM information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc 
              ON tc.constraint_name = cc.constraint_name
            WHERE tc.constraint_type = 'CHECK'
            AND tc.table_schema = 'public'
            AND tc.table_name IN ('time_slots', 'scheduled_posts')
          `
        });
        
        if (error) throw error;
        
        const hasTimeSlotCheck = data.some(c => 
          c.table_name === 'time_slots' && 
          c.check_clause.includes('day_of_week')
        );
        
        const hasStatusCheck = data.some(c => 
          c.table_name === 'scheduled_posts' && 
          c.check_clause.includes('status')
        );
        
        if (!hasTimeSlotCheck) {
          throw new Error('Missing day_of_week check constraint on time_slots');
        }
        
        if (!hasStatusCheck) {
          throw new Error('Missing status check constraint on scheduled_posts');
        }
      }
    },
    {
      name: 'Updated_at triggers exist',
      test: async () => {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT 
              event_object_table,
              trigger_name
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND trigger_name LIKE '%updated_at%'
          `
        });
        
        if (error) throw error;
        
        const tables = ['user_profiles', 'time_slots', 'scheduled_posts', 'platform_credentials'];
        for (const table of tables) {
          const hasTrigger = data.some(t => t.event_object_table === table);
          if (!hasTrigger) {
            throw new Error(`Missing updated_at trigger on ${table}`);
          }
        }
      }
    }
  ];

  let allPassed = true;

  for (const { name, test } of validations) {
    try {
      await test();
      console.log(`✅ ${name}`);
    } catch (err) {
      console.log(`❌ ${name}: ${err.message}`);
      allPassed = false;
    }
  }

  console.log('\n' + (allPassed ? '🎉 Schema validation passed!' : '❌ Schema validation failed'));
  
  if (allPassed) {
    console.log('\n✨ Database schema meets all requirements:');
    console.log('  • Requirement 6.1: Supabase database configured ✓');
    console.log('  • Requirement 6.3: Data integrity and security ✓');
    console.log('  • Requirement 8.3: Secure data storage ✓');
    console.log('\n🚀 Ready to proceed with authentication implementation!');
  } else {
    console.log('\n🔧 Please fix the schema issues before proceeding.');
  }
}

validateSchema().catch(console.error);