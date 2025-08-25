# Threads 500 Error Debug Guide

## Current Status
- ✅ API works fine in Node.js environment (direct test)
- ❌ Getting 500 errors in production app
- ✅ User authentication and quota are fine
- ✅ Request format is correct

## Debugging Steps Added

### 1. Enhanced Error Logging
Added detailed request/response logging to see exactly what's being sent and received.

### 2. Retry Logic
Added automatic retry for 500 errors (up to 3 attempts with delays) since these are typically transient server issues.

### 3. Quota Checking
Added pre-flight quota check to ensure we're not hitting rate limits.

## Browser Console Test
To test the API directly from your browser:

1. Open your app in the browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Paste and run this code:

```javascript
// Test Threads API directly from browser
async function testThreadsAPI() {
  const accessToken = 'YOUR_ACCESS_TOKEN'; // Replace with actual token
  const userId = '31057074893906982';
  
  const params = new URLSearchParams({
    media_type: 'TEXT',
    text: `Browser console test - ${new Date().toISOString()}`,
    access_token: accessToken
  });
  
  try {
    const response = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    
    console.log('Status:', response.status);
    console.log('Response:', await response.text());
  } catch (error) {
    console.error('Error:', error);
  }
}

testThreadsAPI();
```

## Possible Causes of 500 Errors

### 1. Rate Limiting (Ruled Out)
- ✅ Quota check shows only 3/250 posts used
- ✅ Not hitting rate limits

### 2. Server-Side Issues
- 🔍 Threads API might be experiencing temporary issues
- 🔧 Added retry logic to handle this

### 3. Request Differences
- 🔍 Production environment might modify requests
- 🔧 Added detailed logging to compare

### 4. CORS/Network Issues
- 🔍 Browser might handle requests differently
- 🔧 Test with browser console to verify

### 5. Token Issues
- ✅ Token works fine for /me endpoint
- ✅ Token has correct permissions

## Next Steps

1. **Check the enhanced logs** in browser console when posting
2. **Try the browser console test** to see if it works directly
3. **Wait and retry** - 500 errors are often temporary
4. **Monitor the retry attempts** to see if they succeed

## Expected Behavior
With the retry logic, the system should:
- Attempt the request
- If 500 error, wait 2 seconds and retry
- If still 500, wait 4 seconds and retry once more
- If all attempts fail, show detailed error message

This should resolve most temporary server issues automatically.