#!/usr/bin/env node
/*
  generate-sw-manifest.js

  Usage:
    node scripts/generate-sw-manifest.js [--nextDir=frontend/.next] [--publicDir=frontend/public] [--outDir=frontend/public]

  What it does:
  - Computes BUILD_ID (git short SHA + date) unless BUILD_ID env provided
  - Walks fingerprinted static files under nextDir/static and publicDir
  - Produces outDir/sw-manifest.json and outDir/__build_info.json

  This script is intentionally dependency-free and uses Node builtins only.
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function usageAndExit() {
  console.log('Usage: node scripts/generate-sw-manifest.js [--nextDir=frontend/.next] [--publicDir=frontend/public] [--outDir=frontend/public]');
  process.exit(1);
}

const args = process.argv.slice(2);
const opts = {};
for (const a of args) {
  if (a === '--help' || a === '-h') usageAndExit();
  const m = a.match(/^--([a-zA-Z0-9_-]+)=(.*)$/);
  if (m) opts[m[1]] = m[2];
}

const repoRoot = process.cwd();
const nextDir = path.resolve(repoRoot, opts.nextDir || 'frontend/.next');
const publicDir = path.resolve(repoRoot, opts.publicDir || 'frontend/public');
const outDir = path.resolve(repoRoot, opts.outDir || publicDir);

function computeBuildId() {
  if (process.env.BUILD_ID) return process.env.BUILD_ID;
  try {
    const sha = execSync('git rev-parse --short=8 HEAD', { encoding: 'utf8' }).trim();
    const date = new Date().toISOString().replace(/[:\.]/g, '-');
    return `${sha}-${date}`;
  } catch (e) {
    // fallback to timestamp
    return `manual-${Date.now()}`;
  }
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function walk(dir, cb) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const res = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(res, cb);
    else await cb(res);
  }
}

function relativeUrlForNextStatic(filePath, nextDir) {
  // filePath: /.../frontend/.next/static/...
  const staticRoot = path.join(nextDir, 'static');
  if (!filePath.startsWith(staticRoot)) return null;
  const rel = path.relative(staticRoot, filePath).split(path.sep).join('/');
  return '/_next/static/' + rel;
}

function relativeUrlForPublic(filePath, publicDir) {
  const rel = path.relative(publicDir, filePath).split(path.sep).join('/');
  return '/' + rel;
}

(async function main() {
  const BUILD_ID = computeBuildId();
  console.log('BUILD_ID:', BUILD_ID);

  const manifest = {
    buildId: BUILD_ID,
    generatedAt: new Date().toISOString(),
    assets: [],
    groups: {
      precache: [],
      static: [],
      public: [],
    },
  };

  // include public/offline.html and root
  const precacheCandidates = ['offline.html', 'index.html'];
  for (const p of precacheCandidates) {
    const file = path.join(publicDir, p);
    if (fs.existsSync(file)) {
      const url = relativeUrlForPublic(file, publicDir);
      manifest.groups.precache.push(url);
    }
  }
  // Always include root; server will serve root at /
  if (!manifest.groups.precache.includes('/')) manifest.groups.precache.push('/');

  // Walk .next/static assets
  const nextStatic = path.join(nextDir, 'static');
  if (fs.existsSync(nextStatic)) {
    await walk(nextStatic, async (file) => {
      if (file.endsWith('.map')) return; // skip sourcemaps
      const stat = await fs.promises.stat(file);
      if (!stat.isFile()) return;
      const buf = await fs.promises.readFile(file);
      const hash = sha256Hex(buf);
      const size = stat.size;
      const url = relativeUrlForNextStatic(file, nextDir);
      manifest.assets.push({ url, path: path.relative(repoRoot, file).split(path.sep).join('/'), size, hash, origin: 'next' });
      manifest.groups.static.push(url);
    });
  } else {
    console.warn('Warning: next static dir not found:', nextStatic);
  }

  // Walk public dir
  if (fs.existsSync(publicDir)) {
    await walk(publicDir, async (file) => {
      if (file.endsWith('.map')) return;
      const stat = await fs.promises.stat(file);
      if (!stat.isFile()) return;
      const buf = await fs.promises.readFile(file);
      const hash = sha256Hex(buf);
      const size = stat.size;
      const url = relativeUrlForPublic(file, publicDir);
      manifest.assets.push({ url, path: path.relative(repoRoot, file).split(path.sep).join('/'), size, hash, origin: 'public' });
      manifest.groups.public.push(url);
    });
  } else {
    console.warn('Warning: public dir not found:', publicDir);
  }

  // dedupe groups
  for (const k of Object.keys(manifest.groups)) {
    manifest.groups[k] = Array.from(new Set(manifest.groups[k]));
  }

  // Save manifest and build info
  const outManifest = path.join(outDir, 'sw-manifest.json');
  const outBuildInfo = path.join(outDir, '__build_info.json');

  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(outManifest, JSON.stringify(manifest, null, 2), 'utf8');
  await fs.promises.writeFile(outBuildInfo, JSON.stringify({ buildId: BUILD_ID, generatedAt: manifest.generatedAt }, null, 2), 'utf8');

  console.log('Wrote manifest:', outManifest);
  console.log('Wrote build info:', outBuildInfo);
  console.log('Assets counted:', manifest.assets.length, 'precache:', manifest.groups.precache.length);
})();
