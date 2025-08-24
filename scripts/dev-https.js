const { createServer } = require('https')
const { parse } = require('url')
const next = require('next')
const fs = require('fs')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

// Check if certificates exist
const keyPath = path.join(__dirname, '../certs/localhost-key.pem')
const certPath = path.join(__dirname, '../certs/localhost.pem')

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('SSL certificates not found. Please run: npm run certs')
  process.exit(1)
}

// Create Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// SSL certificate options
const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
}

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      // Add CORS headers for development
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .once('error', (err) => {
      console.error('HTTPS Server Error:', err)
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please stop other processes or use a different port.`)
      }
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on https://${hostname}:${port}`)
      console.log('> Note: You may need to accept the self-signed certificate in your browser')
    })
})