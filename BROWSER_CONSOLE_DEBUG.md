# Browser Console Debug for Threads API

## Quick Browser Test

Open your production app (https://schedule.oddomens.com) in the browser, then:

1. **Open Developer Tools** (F12)
2. **Go to Console tab**
3. **Paste and run this code:**

```javascript
// Quick Threads API test from production domain
async function testFromProductionDomain() {
    console.log('🔍 Testing from:', window.location.origin);
    
    // Replace with your actual token (get from network tab or database)
    const accessToken = 'YOUR_ACCESS_TOKEN_HERE';
    const userId = '31057074893906982';
    
    // Test basic access
    console.log('\n1. Testing basic access...');
    try {
        const response = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`);
        console.log('Basic access:', response.status, response.ok ? '✅' : '❌');
        if (response.ok) {
            const data = await response.json();
            console.log('User:', data.username);
        }
    } catch (error) {
        console.log('Basic access error:', error);
    }
    
    // Test post creation
    console.log('\n2. Testing post creation...');
    try {
        const params = new URLSearchParams({
            media_type: 'TEXT',
            text: `Production domain test - ${new Date().toISOString()}`,
            access_token: accessToken
        });
        
        const response = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });
        
        console.log('Post creation:', response.status, response.ok ? '✅' : '❌');
        const responseText = await response.text();
        console.log('Response:', responseText);
        
        if (!response.ok) {
            try {
                const errorData = JSON.parse(responseText);
                console.log('Error code:', errorData.error?.code);
                console.log('Error message:', errorData.error?.message);
            } catch (e) {
                console.log('Could not parse error');
            }
        }
    } catch (error) {
        console.log('Post creation error:', error);
    }
}

// Run the test
testFromProductionDomain();
```

## What to Look For

### If Basic Access Works but Post Creation Fails:
- **Error Code 10**: Domain still not fully propagated (wait 15-30 minutes)
- **Error Code 190**: Token expired or invalid
- **Different error**: New issue to investigate

### If Both Fail:
- **Network errors**: Firewall or connectivity issue
- **CORS errors**: Browser blocking the request
- **Token issues**: Need to refresh authentication

## Alternative: Get Token from Network Tab

1. **Try to post something** in your app (it will fail)
2. **Open Network tab** in Developer Tools
3. **Find the failed Threads API request**
4. **Copy the access_token** from the request
5. **Use that token** in the console test above

## Possible Issues

### 1. Domain Propagation Delay
- Meta's servers might not have updated yet
- Can take up to 30 minutes in some cases
- Solution: Wait and retry

### 2. Subdomain Issues
- If you added `schedule.oddomens.com` but app is on `www.schedule.oddomens.com`
- Solution: Add both domains to Meta console

### 3. Browser Cache
- Browser might be caching old domain restrictions
- Solution: Try incognito/private browsing mode

### 4. Token Scope Issues
- Token might have been issued before domain was added
- Solution: Disconnect and reconnect Threads account

## Expected Results

### Working Scenario:
```
Basic access: 200 ✅
User: kadyn.made
Post creation: 200 ✅
Response: {"id":"17895093921280526"}
```

### Still Broken Scenario:
```
Basic access: 200 ✅
User: kadyn.made
Post creation: 500 ❌
Error code: 10
Error message: Application does not have permission for this action
```

If you get the "still broken" scenario, try:
1. **Wait 15-30 minutes** for full propagation
2. **Clear browser cache** completely
3. **Try incognito mode**
4. **Reconnect your Threads account** (disconnect and connect again)