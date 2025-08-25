#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Checks if the application is properly deployed and configured
 */

import https from 'https';
import http from 'http';

const PRODUCTION_URL = 'https://schedule.oddomens.com';
const REQUIRED_PATHS = [
  '/',
  '/login',
  '/signup',
  '/dashboard',
  '/posts',
  '/settings'
];

const THREADS_CONFIG = {
  clientId: '753393784148937',
  redirectUri: 'https://schedule.oddomens.com/auth/threads/callback',
  scope: 'threads_basic,threads_content_publish'
};

console.log('🚀 Starting deployment verification...\n');

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function checkPath(path) {
  try {
    const url = `${PRODUCTION_URL}${path}`;
    const response = await makeRequest(url);
    
    const isSuccess = response.statusCode >= 200 && response.statusCode < 400;
    const status = isSuccess ? '✅' : '❌';
    
    console.log(`${status} ${path} - Status: ${response.statusCode}`);
    
    if (!isSuccess) {
      console.log(`   Error: HTTP ${response.statusCode}`);
    }
    
    return isSuccess;
  } catch (error) {
    console.log(`❌ ${path} - Error: ${error.message}`);
    return false;
  }
}

async function checkThreadsOAuth() {
  console.log('\n🧵 Checking Threads OAuth configuration...');
  
  const params = new URLSearchParams({
    client_id: THREADS_CONFIG.clientId,
    redirect_uri: THREADS_CONFIG.redirectUri,
    scope: THREADS_CONFIG.scope,
    response_type: 'code',
    state: 'verification_test'
  });
  
  const oauthUrl = `https://graph.threads.net/oauth/authorize?${params.toString()}`;
  
  try {
    const response = await makeRequest(oauthUrl);
    
    if (response.statusCode === 200) {
      console.log('✅ Threads OAuth URL is accessible');
      console.log('✅ Meta Developer Console configuration appears correct');
    } else if (response.statusCode === 400) {
      console.log('❌ Threads OAuth returns 400 Bad Request');
      console.log('   This usually means Meta Developer Console configuration issues:');
      console.log('   - App might be in Development mode (should be Live)');
      console.log('   - Redirect URI might not match exactly');
      console.log('   - App domains might not be configured');
      console.log('   - Required scopes might not be approved');
    } else {
      console.log(`⚠️  Threads OAuth returns ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Threads OAuth check failed: ${error.message}`);
  }
  
  console.log(`\n📋 OAuth URL for manual testing:`);
  console.log(oauthUrl);
}

async function checkEnvironmentVariables() {
  console.log('\n🔧 Checking environment configuration...');
  
  try {
    const response = await makeRequest(`${PRODUCTION_URL}/`);
    const html = response.body;
    
    // Check if the app loads without errors
    if (html.includes('<!DOCTYPE html>') || html.includes('<html')) {
      console.log('✅ Application HTML loads correctly');
    } else {
      console.log('❌ Application HTML appears malformed');
    }
    
    // Check for common build issues
    if (html.includes('Vite') && html.includes('Error')) {
      console.log('❌ Vite build errors detected in HTML');
    }
    
  } catch (error) {
    console.log(`❌ Environment check failed: ${error.message}`);
  }
}

async function checkSSL() {
  console.log('\n🔒 Checking SSL configuration...');
  
  try {
    const response = await makeRequest(PRODUCTION_URL);
    console.log('✅ HTTPS is working correctly');
    
    // Check security headers
    const headers = response.headers;
    const securityHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options'
    ];
    
    securityHeaders.forEach(header => {
      if (headers[header]) {
        console.log(`✅ Security header present: ${header}`);
      } else {
        console.log(`⚠️  Security header missing: ${header}`);
      }
    });
    
  } catch (error) {
    console.log(`❌ SSL check failed: ${error.message}`);
  }
}

async function main() {
  console.log(`Verifying deployment at: ${PRODUCTION_URL}\n`);
  
  // Check main application paths
  console.log('📄 Checking application paths...');
  const pathResults = await Promise.all(
    REQUIRED_PATHS.map(path => checkPath(path))
  );
  
  const successfulPaths = pathResults.filter(Boolean).length;
  console.log(`\n📊 Path check results: ${successfulPaths}/${REQUIRED_PATHS.length} successful`);
  
  // Check SSL and security
  await checkSSL();
  
  // Check environment
  await checkEnvironmentVariables();
  
  // Check Threads OAuth
  await checkThreadsOAuth();
  
  // Summary
  console.log('\n📋 Verification Summary:');
  console.log(`- Application paths: ${successfulPaths}/${REQUIRED_PATHS.length} working`);
  console.log(`- Production URL: ${PRODUCTION_URL}`);
  console.log(`- Threads Client ID: ${THREADS_CONFIG.clientId}`);
  console.log(`- Threads Redirect URI: ${THREADS_CONFIG.redirectUri}`);
  
  console.log('\n🎯 Next Steps:');
  if (successfulPaths === REQUIRED_PATHS.length) {
    console.log('✅ Application deployment looks good!');
    console.log('1. Test the Threads OAuth flow manually');
    console.log('2. Check Meta Developer Console settings');
    console.log('3. Verify app is in Live mode (not Development)');
  } else {
    console.log('❌ Some application paths are not working');
    console.log('1. Check deployment status');
    console.log('2. Verify build completed successfully');
    console.log('3. Check server configuration');
  }
  
  console.log('\n📚 Helpful Resources:');
  console.log('- Debug tool: debug-threads-oauth.html');
  console.log('- Setup guide: META_DEVELOPER_CONSOLE_SETUP.md');
  console.log('- Deployment guide: PRODUCTION_DEPLOYMENT.md');
}

main().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});