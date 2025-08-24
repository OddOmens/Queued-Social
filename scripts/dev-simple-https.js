const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

// Check if certificates exist
const keyPath = path.join(__dirname, '../certs/localhost-key.pem')
const certPath = path.join(__dirname, '../certs/localhost.pem')

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('SSL certificates not found. Please run: npm run certs')
  process.exit(1)
}

console.log('Starting Next.js development server with HTTPS...')

// Use Next.js built-in development server with HTTPS
const nextProcess = spawn('npx', [
  'next', 
  'dev', 
  '--port', '3000',
  '--hostname', 'localhost'
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HTTPS: 'true',
    SSL_CRT_FILE: certPath,
    SSL_KEY_FILE: keyPath
  }
})

nextProcess.on('close', (code) => {
  console.log(`Next.js process exited with code ${code}`)
})

nextProcess.on('error', (err) => {
  console.error('Failed to start Next.js:', err)
})