#!/usr/bin/env node

/**
 * Check Threads API Documentation and Examples
 * This script helps verify the correct OAuth flow for Threads
 */

import https from 'https';

const DOCS_URLS = [
    'https://developers.facebook.com/docs/threads',
    'https://developers.facebook.com/docs/threads/get-started',
    'https://developers.facebook.com/docs/threads/authentication'
];

const TEST_ENDPOINTS = [
    // Standard OAuth endpoints
    'https://graph.threads.net/oauth/authorize',
    'https://graph.threads.net/oauth/access_token',
    
    // Alternative endpoints
    'https://www.threads.net/oauth/authorize',
    'https://threads.net/oauth/authorize',
    
    // Facebook-style endpoints
    'https://www.facebook.com/v18.0/dialog/oauth',
    'https://graph.facebook.com/v18.0/oauth/access_token'
];

async function makeRequest(url, method = 'GET', body = null) {
    return new Promise((resolve) => {
        console.log(`\n🔍 Testing: ${method} ${url}`);
        
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        };

        if (body && method === 'POST') {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const client = urlObj.protocol === 'https:' ? https : require('http');
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode} ${res.statusText}`);
                console.log(`Content-Type: ${res.headers['content-type']}`);
                
                if (res.headers['location']) {
                    console.log(`Redirect: ${res.headers['location']}`);
                }
                
                if (data.length < 1000) {
                    console.log(`Response: ${data}`);
                } else {
                    console.log(`Response: ${data.substring(0, 300)}... (truncated)`);
                }
                
                resolve({
                    url,
                    method,
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (error) => {
            console.log(`❌ Error: ${error.message}`);
            resolve({ url, method, error: error.message });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            console.log(`⏰ Request timeout`);
            resolve({ url, method, error: 'Timeout' });
        });

        if (body && method === 'POST') {
            req.write(body);
        }
        
        req.end();
    });
}

async function testOAuthEndpoints() {
    console.log('🧪 Testing OAuth Endpoints...\n');
    
    const CLIENT_ID = '753393784148937';
    const results = [];
    
    for (const baseUrl of TEST_ENDPOINTS) {
        // Test with minimal parameters
        const testUrl = `${baseUrl}?client_id=${CLIENT_ID}`;
        const result = await makeRequest(testUrl);
        results.push(result);
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
}

async function analyzeOAuthPatterns() {
    console.log('\n🔍 Analyzing OAuth Patterns...\n');
    
    const CLIENT_ID = '753393784148937';
    const CLIENT_SECRET = '4cf0c65d88a7d192f89048d8c4d03c78';
    
    const testCases = [
        {
            name: 'Standard OAuth (no client_secret)',
            url: `https://graph.threads.net/oauth/authorize?client_id=${CLIENT_ID}&response_type=code`
        },
        {
            name: 'With client_secret (current approach)',
            url: `https://graph.threads.net/oauth/authorize?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&response_type=code`
        },
        {
            name: 'Facebook-style OAuth',
            url: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${CLIENT_ID}&response_type=code`
        },
        {
            name: 'Direct token exchange',
            url: `https://graph.threads.net/oauth/access_token`,
            method: 'POST',
            body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
        }
    ];
    
    const results = [];
    for (const testCase of testCases) {
        console.log(`\n📊 Testing: ${testCase.name}`);
        const result = await makeRequest(testCase.url, testCase.method || 'GET', testCase.body);
        result.testName = testCase.name;
        results.push(result);
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    return results;
}

async function checkDocumentationUrls() {
    console.log('\n📚 Checking Documentation URLs...\n');
    
    const results = [];
    for (const url of DOCS_URLS) {
        const result = await makeRequest(url);
        results.push(result);
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
}

async function main() {
    console.log('🧵 Threads API Documentation and OAuth Flow Analysis\n');
    console.log('=' .repeat(60));
    
    // Test OAuth endpoints
    const endpointResults = await testOAuthEndpoints();
    
    // Analyze OAuth patterns
    const patternResults = await analyzeOAuthPatterns();
    
    // Check documentation
    const docResults = await checkDocumentationUrls();
    
    // Analysis
    console.log('\n📊 ANALYSIS SUMMARY\n');
    console.log('=' .repeat(50));
    
    console.log('\n🔗 OAuth Endpoint Analysis:');
    endpointResults.forEach(result => {
        if (result.error) {
            console.log(`❌ ${result.url}: ${result.error}`);
        } else {
            console.log(`📊 ${result.url}: HTTP ${result.statusCode}`);
            
            if (result.statusCode === 400 && result.body) {
                try {
                    const errorData = JSON.parse(result.body);
                    if (errorData.error && errorData.error.message) {
                        console.log(`   → Error: ${errorData.error.message}`);
                    }
                } catch (e) {
                    // Not JSON, ignore
                }
            }
        }
    });
    
    console.log('\n🧪 OAuth Pattern Analysis:');
    patternResults.forEach(result => {
        if (result.error) {
            console.log(`❌ ${result.testName}: ${result.error}`);
        } else {
            console.log(`📊 ${result.testName}: HTTP ${result.statusCode}`);
            
            if (result.statusCode === 400 && result.body) {
                try {
                    const errorData = JSON.parse(result.body);
                    if (errorData.error && errorData.error.message) {
                        console.log(`   → Error: ${errorData.error.message}`);
                        
                        // Analyze specific error patterns
                        const message = errorData.error.message.toLowerCase();
                        if (message.includes('missing') && message.includes('code')) {
                            console.log(`   → 🚨 This suggests wrong endpoint or flow!`);
                        } else if (message.includes('invalid_client')) {
                            console.log(`   → ✅ Client ID is recognized`);
                        } else if (message.includes('redirect_uri')) {
                            console.log(`   → ⚠️ Redirect URI configuration issue`);
                        }
                    }
                } catch (e) {
                    // Not JSON, ignore
                }
            } else if (result.statusCode === 200) {
                console.log(`   → ✅ This approach might work!`);
            } else if (result.statusCode === 302) {
                console.log(`   → ✅ Redirect (likely successful OAuth start)`);
            }
        }
    });
    
    console.log('\n📚 Documentation Access:');
    docResults.forEach(result => {
        if (result.error) {
            console.log(`❌ ${result.url}: ${result.error}`);
        } else {
            console.log(`📊 ${result.url}: HTTP ${result.statusCode}`);
        }
    });
    
    console.log('\n🎯 RECOMMENDATIONS\n');
    
    // Look for patterns in the results
    const hasCodeError = patternResults.some(r => 
        r.body && r.body.includes('Missing required field: code')
    );
    
    const hasWorkingEndpoint = patternResults.some(r => 
        r.statusCode === 200 || r.statusCode === 302
    );
    
    if (hasCodeError) {
        console.log('🚨 CRITICAL FINDING: "Missing required field: code" error detected');
        console.log('   This suggests we might be using the wrong endpoint or flow');
        console.log('   Recommendations:');
        console.log('   1. Check if Threads uses a different OAuth flow');
        console.log('   2. Verify we\'re using the correct endpoint');
        console.log('   3. Check if Threads requires pre-authorization steps');
    }
    
    if (hasWorkingEndpoint) {
        console.log('✅ Found potentially working OAuth approach');
        console.log('   Check the results above for successful patterns');
    } else {
        console.log('⚠️ No clearly working OAuth patterns found');
        console.log('   This might indicate:');
        console.log('   1. Threads API configuration issues');
        console.log('   2. Non-standard OAuth implementation');
        console.log('   3. Missing prerequisites or app approval');
    }
    
    console.log('\n📋 NEXT STEPS\n');
    console.log('1. Review the analysis above for working patterns');
    console.log('2. Check Threads API documentation for correct flow');
    console.log('3. Verify Meta Developer Console configuration');
    console.log('4. Consider contacting Meta Developer Support');
}

main().catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
});