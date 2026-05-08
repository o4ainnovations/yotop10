import { AuditLog } from '../models/AuditLog';
import { redis } from './redis';

const THROTTLE_WINDOW = 60;
const THROTTLE_MAX = 300;
const STATS_CACHE_KEY = 'admin:audit:stats';
const STATS_CACHE_TTL = 30;

export function logAudit(params: {
  admin_id: string | null;
  action: string;
  ip: string;
  metadata?: Record<string, unknown>;
  user_agent?: string;
}): void {
  // Fire and forget — never blocks the calling handler
  Promise.resolve().then(async () => {
    try {
      const throttleKey = `audit_throttle:${params.ip}`;
      const current = await redis.incr(throttleKey);
      if (current === 1) await redis.expire(throttleKey, THROTTLE_WINDOW);
      if (current > THROTTLE_MAX) return;

      await AuditLog.create({
        admin_id: params.admin_id,
        action: params.action,
        ip: params.ip,
        user_agent: (params.user_agent || '').substring(0, 200),
        metadata: params.metadata || {},
      });

      await redis.del(STATS_CACHE_KEY);
    } catch (err) {
      console.error('[Audit] Write failed:', (err as Error).message);
    }
  });
}

export async function getAuditStats(): Promise<Record<string, unknown>> {
  try {
    const cached = await redis.get(STATS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss or Redis down — compute live */ }

  const twentyFourH = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [failedLogins24h, successfulLogins24h, totalRows, lastLogin, lastFailed] = await Promise.all([
    AuditLog.countDocuments({ action: 'login_failed', created_at: { $gte: twentyFourH } }),
    AuditLog.countDocuments({ action: 'login_success', created_at: { $gte: twentyFourH } }),
    AuditLog.countDocuments({}),
    AuditLog.findOne({ action: 'login_success' }).sort({ created_at: -1 }).select('created_at metadata').lean(),
    AuditLog.findOne({ action: 'login_failed' }).sort({ created_at: -1 }).select('created_at metadata').lean(),
  ]);

  const stats = {
    failed_logins_24h: failedLogins24h,
    successful_logins_24h: successfulLogins24h,
    last_login: (lastLogin as Record<string, unknown> | null)?.created_at || null,
    last_failed: (lastFailed as Record<string, unknown> | null)?.created_at || null,
    total_rows: totalRows,
    retention_days: 90,
  };

  try {
    await redis.set(STATS_CACHE_KEY, JSON.stringify(stats), { EX: STATS_CACHE_TTL });
  } catch { /* cache miss or Redis down — compute live */ }

  return stats;
}
