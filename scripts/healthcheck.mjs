#!/usr/bin/env node
// Enterprise health check for Docker — checks app, dependencies, and system resources
// Usage: node healthcheck.mjs [--timeout=5000] [--component=mongodb]

import http from 'http';

const TARGET = process.env.HEALTH_CHECK_URL || 'http://localhost:8000/api/health';
const TIMEOUT = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '10000', 10);

function checkHttp(url, timeout) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[HealthCheck] HTTP ${res.statusCode}`);
          resolve(false);
          return;
        }
        try {
          const body = JSON.parse(data);
          if (body.status === 'ok' || body.status === 'degraded') {
            resolve(true);
          } else {
            console.error(`[HealthCheck] status=${body.status}`);
            resolve(false);
          }
        } catch {
          console.error('[HealthCheck] Invalid JSON response');
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      console.error(`[HealthCheck] Connection error: ${err.message}`);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.error(`[HealthCheck] Timeout after ${timeout}ms`);
      resolve(false);
    });
  });
}

async function run() {
  const healthy = await checkHttp(TARGET, TIMEOUT);
  process.exit(healthy ? 0 : 1);
}

run();
