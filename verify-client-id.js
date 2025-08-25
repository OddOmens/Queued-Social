#!/usr/bin/env node

/**
 * Verify Threads Client ID
 * This script helps verify if the Client ID is valid and accessible
 */

import https from 'https';

const CLIENT_ID = '753393784148937';
const TEST_URLS = [
    // Test the OAuth endpoint with minimal parameters
    `https://graph.threads.net/oauth/authorize?client_id=${CLIENT_ID}&response_type=code`,
    
    // Test a different endpoint to see if the app exists
    `https://graph.facebook.com/${CLIENT_ID}`,
    
    // Test the Threads API base endpoint
    `https://graph.threads.net/v1.0/me?access_token=invalid_token_test`
];

async function makeRequest(url, description) {
    return new Promise((resolve) => {
        console.log(`\n🔍 Testing: ${description}`);
        console.log(`URL: ${url}`);
        
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode} ${res.statusText}`);
                console.log(`Headers:`, Object.fromEntries(
                    Object.entries(res.headers).filter(([key]) => 
                        ['content-type', 'www-authenticate', 'x-fb-trace-id', 'x-fb-rev'].includes(key)
                    )
                ));
                
                if (data.length < 500) {
                    console.log(`Response: ${data}`);
                } else {
                    console.log(`Response: ${data.substring(0, 200)}... (truncated)`);
                }
                
                resolve({
                    url,
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    description
                });
            });
        });
        
        req.on('error', (error) => {
            console.log(`❌ Error: ${error.message}`);
            resolve({
                url,
                error: error.message,
                description
            });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            console.log(`⏰ Request timeout`);
            resolve({
                url,
                error: 'Timeout',
                description
            });
        });
    });
}

async function testClientIdFormats() {
    console.log('🧪 Testing different Client ID formats...\n');
    
    const testIds = [
        CLIENT_ID,                    // Original
        CLIENT_ID.toString(),         // Ensure string
        parseInt(CLIENT_ID).toString() // Parse and stringify to remove any hidden chars
    ];
    
    testIds.forEach((id, index) => {
        console.log(`Format ${index + 1}: "${id}" (length: ${id.length}, type: ${typeof id})`);
        console.log(`Bytes: [${Array.from(id).map(c => c.charCodeAt(0)).join(', ')}]`);
    });
}

async function analyzeOAuthError() {
    console.log('\n🔍 Analyzing OAuth Error Patterns...\n');
    
    // Test with minimal OAuth parameters to isolate the issue
    const testCases = [
        {
            name: 'Minimal OAuth (just client_id)',
            url: `https://graph.threads.net/oauth/authorize?client_id=${CLIENT_ID}`
        },
        {
            name: 'OAuth with response_type',
            url: `https://graph.threads.net/oauth/authorize?client_id=${CLIENT_ID}&response_type=code`
        },
        {
            name: 'OAuth with invalid client_id',
            url: `https://graph.threads.net/oauth/authorize?client_id=123456789&response_type=code`
        },
        {
            name: 'OAuth with empty client_id',
            url: `https://graph.threads.net/oauth/authorize?client_id=&response_type=code`
        }
    ];
    
    const results = [];
    for (const testCase of testCases) {
        const result = await makeRequest(testCase.url, testCase.name);
        results.push(result);
        
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
}

async function checkMetaApiStatus() {
    console.log('\n🌐 Checking Meta API Status...\n');
    
    try {
        const result = await makeRequest(
            'https://graph.facebook.com/v18.0/me?access_token=invalid', 
            'Facebook Graph API Health Check'
        );
        
        if (result.statusCode === 400) {
            console.log('✅ Meta Graph API is responding (400 expected for invalid token)');
        } else {
            console.log(`⚠️ Unexpected response from Meta Graph API: ${result.statusCode}`);
        }
    } catch (error) {
        console.log(`❌ Meta Graph API check failed: ${error.message}`);
    }
}

async function main() {
    console.log('🧵 Threads Client ID Verification Tool\n');
    console.log(`Testing Client ID: ${CLIENT_ID}\n`);
    
    // Test client ID formats
    testClientIdFormats();
    
    // Check Meta API status
    await checkMetaApiStatus();
    
    // Analyze OAuth errors
    const oauthResults = await analyzeOAuthError();
    
    // Summary
    console.log('\n📊 ANALYSIS SUMMARY\n');
    console.log('='.repeat(50));
    
    console.log(`\nClient ID: ${CLIENT_ID}`);
    console.log(`Length: ${CLIENT_ID.length} characters`);
    console.log(`Format: ${/^\d+$/.test(CLIENT_ID) ? 'Valid (numeric)' : 'Invalid (non-numeric)'}`);
    
    console.log('\nOAuth Test Results:');
    oauthResults.forEach(result => {
        if (result.error) {
            console.log(`❌ ${result.description}: ${result.error}`);
        } else {
            console.log(`📊 ${result.description}: HTTP ${result.statusCode}`);
            
            // Analyze specific error patterns
            if (result.statusCode === 400) {
                if (result.body.includes('invalid_client')) {
                    console.log('   → Client ID is invalid or app doesn\'t exist');
                } else if (result.body.includes('redirect_uri')) {
                    console.log('   → Redirect URI issue (but client ID is valid)');
                } else if (result.body.includes('unauthorized')) {
                    console.log('   → App exists but not authorized for Threads');
                } else {
                    console.log('   → Generic 400 error (check Meta Developer Console)');
                }
            } else if (result.statusCode === 200) {
                console.log('   → ✅ This configuration works!');
            }
        }
    });
    
    console.log('\n🎯 RECOMMENDATIONS\n');
    console.log('Based on the test results:');
    
    const has400Errors = oauthResults.some(r => r.statusCode === 400);
    const hasValidClientId = /^\d+$/.test(CLIENT_ID) && CLIENT_ID.length > 10;
    
    if (!hasValidClientId) {
        console.log('❌ Client ID format is invalid');
        console.log('   → Verify the Client ID in Meta Developer Console');
    } else if (has400Errors) {
        console.log('⚠️ Client ID appears valid but OAuth fails');
        console.log('   → Check Meta Developer Console configuration:');
        console.log('     • App must be in Live mode (not Development)');
        console.log('     • Redirect URIs must be configured correctly');
        console.log('     • App domains must be whitelisted');
        console.log('     • Threads API must be added as a product');
    } else {
        console.log('✅ Client ID and basic OAuth appear to work');
        console.log('   → The issue is likely in redirect URI or scope configuration');
    }
    
    console.log('\n📋 NEXT STEPS\n');
    console.log('1. Open Meta Developer Console');
    console.log('2. Verify app is in Live mode');
    console.log('3. Check Threads API configuration');
    console.log('4. Test with the diagnostic tools provided');
    console.log('5. Use test-threads-oauth-direct.html for URL testing');
}

main().catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
});