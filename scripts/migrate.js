#!/usr/bin/env node

/**
 * Database migration script for Social Media Scheduler
 * This script applies database migrations to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Migrations directory not found:', migrationsDir);
    process.exit(1);
  }

  // Get all migration files
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('ℹ️  No migration files found');
    return;
  }

  // Create migrations tracking table if it doesn't exist
  const { error: trackingError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  });

  if (trackingError) {
    console.error('❌ Failed to create migrations tracking table:', trackingError);
    process.exit(1);
  }

  // Get already executed migrations
  const { data: executedMigrations, error: fetchError } = await supabase
    .from('_migrations')
    .select('filename');

  if (fetchError) {
    console.error('❌ Failed to fetch executed migrations:', fetchError);
    process.exit(1);
  }

  const executedFilenames = new Set(executedMigrations?.map(m => m.filename) || []);

  // Execute pending migrations
  for (const filename of migrationFiles) {
    if (executedFilenames.has(filename)) {
      console.log(`⏭️  Skipping ${filename} (already executed)`);
      continue;
    }

    console.log(`📄 Executing ${filename}...`);
    
    const migrationPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
      // Execute the migration SQL
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        throw error;
      }

      // Record the migration as executed
      const { error: recordError } = await supabase
        .from('_migrations')
        .insert({ filename });

      if (recordError) {
        throw recordError;
      }

      console.log(`✅ Successfully executed ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to execute ${filename}:`, error);
      process.exit(1);
    }
  }

  console.log('\n🎉 All migrations completed successfully!');
}

// Alternative function to execute SQL directly (for Supabase CLI or manual execution)
async function executeSqlFile(filename) {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', filename);
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`📄 Executing ${filename}...`);
  console.log('SQL to execute:');
  console.log('================');
  console.log(sql);
  console.log('================\n');
}

// Command line interface
const command = process.argv[2];

if (command === 'run') {
  runMigrations().catch(console.error);
} else if (command === 'show' && process.argv[3]) {
  executeSqlFile(process.argv[3]);
} else {
  console.log('Usage:');
  console.log('  node scripts/migrate.js run           # Run all pending migrations');
  console.log('  node scripts/migrate.js show <file>   # Show SQL content of a migration file');
}