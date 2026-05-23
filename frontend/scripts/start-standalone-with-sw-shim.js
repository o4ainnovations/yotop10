#!/usr/bin/env node
/*
 Minimal helper to start the Next standalone server while ensuring
 /sw.js and /offline.html are served with the correct MIME types.
 This avoids modifying files inside the .next/standalone directory which is
 typically gitignored.
*/
const path = require('path')
const fs = require('fs')
const http = require('http')

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone')
const publicDir = path.join(standaloneDir, 'public')

// Patch http.createServer to intercept top-level requests for SW assets and
// serve them from the standalone public directory with correct Content-Type.
const originalCreateServer = http.createServer
http.createServer = function (handler) {
  return originalCreateServer(function (req, res) {
    try {
      const url = req.url && req.url.split('?')[0]
      if (url === '/sw.js' || url === '/offline.html') {
        const filePath = path.join(publicDir, url.replace(/^\//, ''))
        if (fs.existsSync(filePath)) {
          const stream = fs.createReadStream(filePath)
          const contentType = url.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8'
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
          stream.pipe(res)
          return
        }
      }
    } catch (e) {
      console.warn('SW shim failed', e)
    }
    return handler(req, res)
  })
}

// Delegate to the standalone server entrypoint
const entry = path.join(standaloneDir, 'server.js')
if (!fs.existsSync(entry)) {
  console.error('Standalone server entry not found at', entry)
  process.exit(1)
}
// Start the standalone server in-process
require(entry)
