# Threads "Failed to fetch" Error - FIXED ✅

## Problem Summary
Posts were being marked as "published" in Supabase but not appearing on the actual Threads account. The scheduler was failing with the error: `Publishing failed: Failed to publish single post: Failed to fetch`

## Root Cause Analysis
Through systematic debugging, we identified two critical issues:

### 1. User ID Mismatch
- **Issue**: The stored user ID in the database (`31057074893906984`) didn't match the actual user ID from the access token (`31057074893906982`)
- **Impact**: All API calls were failing because they were using the wrong user ID in the endpoint URL
- **Detection**: Verified by comparing `GET /me` response with stored credentials

### 2. Incorrect Request Format
- **Issue**: The Threads API was being called with JSON format instead of URL-encoded format
- **Impact**: Even with correct user ID, requests were failing due to wrong Content-Type
- **Detection**: Tested multiple request formats to find the working one

## Solutions Implemented

### Fix 1: Corrected User ID in Database
Updated the stored credentials to use the correct user ID (`31057074893906982`) obtained from the `/me` endpoint.

### Fix 2: Updated Request Format in ThreadsPlugin
Changed from JSON to URL-encoded format:

**Before (JSON):**
```javascript
headers: { 'Content-Type': 'application/json' }
body: JSON.stringify({ media_type: 'TEXT', text: '...', access_token: '...' })
```

**After (URL-encoded):**
```javascript
headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
body: new URLSearchParams({ media_type: 'TEXT', text: '...', access_token: '...' })
```

## Files Modified
- `src/services/platforms/threadsPlugin.ts` - Updated request format for both post creation and publishing

## Verification
✅ Direct API test successful - post created and published  
✅ Plugin format test successful - matches exact implementation  
✅ Posts now appear on actual Threads account  
✅ Database correctly records platform_post_id  

## Status
**RESOLVED** - The scheduler now successfully publishes posts to Threads and they appear on the actual account.

## Next Steps
- Monitor scheduled posts to ensure consistent success
- Consider adding retry logic for transient API errors
- Add better error logging for future debugging