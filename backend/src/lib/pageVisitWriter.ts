import { PageVisit } from '../models/PageVisit';
import { Request } from 'express';

let geoip: { lookup: (ip: string) => { country: string } | null } | null = null;
try {
  geoip = require('geoip-lite');
} catch { /* geoip-lite not installed or DB missing */ }

function resolveCountry(ip: string): string | null {
  if (!geoip || !ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return null;
  try {
    const result = geoip.lookup(ip);
    return result?.country || null;
  } catch { return null; }
}

export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'] as string;
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    if (ips.length >= 2) return ips[ips.length - 2];
    return ips[0];
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function logPageVisit(params: {
  path: string;
  referer?: string | null;
  user_agent?: string;
  fingerprint?: string | null;
  ip: string;
}): void {
  Promise.resolve().then(async () => {
    try {
      await PageVisit.create({
        path: params.path,
        referer: (params.referer || '').substring(0, 500),
        user_agent: (params.user_agent || '').substring(0, 300),
        fingerprint: params.fingerprint || null,
        ip: params.ip,
        country: resolveCountry(params.ip),
      });
    } catch (err) {
      console.error('[PageVisit] Write failed:', (err as Error).message);
    }
  });
}
