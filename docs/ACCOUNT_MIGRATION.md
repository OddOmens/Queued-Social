# 🔧 Account Migration Guide

This guide will help you add account information to your scheduled posts so you can see which Threads account each post is associated with.

## 🎯 What This Does

After running this migration, you'll see account names (like `@MyBusinessAccount`) next to every post in:
- ✅ Posts list (All, Scheduled, Published, Failed)  
- ✅ Calendar views and tooltips
- ✅ Bulk upload functionality
- ✅ Post creation forms

## 📋 Step-by-Step Instructions

### Option 1: Using Supabase Dashboard (Recommended)

1. **Open your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run Each Command Separately**
   
   Copy and paste **ONE command at a time**, then click "Run":

   **Command 1:** Add platform_account_id column
   ```sql
   ALTER TABLE scheduled_posts ADD COLUMN platform_account_id VARCHAR(100);
   ```

   **Command 2:** Add account_name column  
   ```sql
   ALTER TABLE scheduled_posts ADD COLUMN account_name VARCHAR(255);
   ```

   **Command 3:** Add performance index
   ```sql
   CREATE INDEX idx_scheduled_posts_user_platform_account ON scheduled_posts(user_id, platform, platform_account_id);
   ```

### Option 2: Using Local Supabase CLI

If you have Docker and Supabase CLI set up locally:

1. **Make sure Docker Desktop is running**

2. **Apply the migration:**
   ```bash
   npx supabase db reset
   ```
   OR
   ```bash
   npx supabase db push
   ```

## ✅ Verify Migration Worked

After running the SQL commands, verify they worked:

1. **Check in Supabase Dashboard:**
   - Go to "Table Editor"
   - Select "scheduled_posts" table  
   - You should see two new columns: `platform_account_id` and `account_name`

2. **Test in Your App:**
   - Create a new post with account selection
   - Check if it shows the account name in the posts list

## 🔧 Troubleshooting

### If you get SQL errors:

**Error: "column already exists"**
- ✅ This is fine! It means the column was already added
- Skip to the next command

**Error: "relation does not exist"**  
- ❌ This means your `scheduled_posts` table doesn't exist
- Check that you're running the commands on the correct database/project

**Error: "permission denied"**
- ❌ You might not have admin access to the database  
- Make sure you're the project owner or have the right permissions

### Still having issues?

1. **Check your table exists:**
   ```sql
   SELECT * FROM scheduled_posts LIMIT 1;
   ```

2. **Check existing columns:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'scheduled_posts';
   ```

3. **Manual verification:**
   - Go to Supabase Dashboard → Table Editor → scheduled_posts
   - Look for `platform_account_id` and `account_name` columns

## 🎉 What You'll See After Migration

### Before Migration:
```
🧵 Threads  [Scheduled]  "My awesome post content..."
```

### After Migration:
```  
🧵 Threads @MyBusinessAccount  [Scheduled]  "My awesome post content..."
```

## 📝 Notes

- **Existing posts** will have empty account names until you edit and re-save them
- **New posts** will automatically include account information
- **Safe to run multiple times** - won't break existing data
- **No data loss** - this only adds new columns

## 🆘 Need Help?

If you run into issues:
1. Double-check you're in the right Supabase project
2. Verify you have admin/owner permissions  
3. Try running the commands one at a time
4. Check the Supabase logs for detailed error messages

---

*This migration adds multi-account support to your social media scheduler! 🚀*