import { SystemConfig } from '../models/SystemConfig';
import { redis } from './redis';
import { logAudit } from './auditWriter';

export const DEFAULT_CONFIG = {
  key: 'global' as const,
  rate_limits: {
    base_posts_per_hour: 4,
    base_comments_per_hour: 20,
    tiers: {
      troll: { multiplier: 0.5, min_posts: 2 },
      neutral: { multiplier: 1.0, min_posts: 4 },
      scholar: { multiplier: 2.0, min_posts: 8 },
    },
    counter_lists_unlimited: true,
    comment_edit_window_minutes: 120,
  },
  trust_tiers: {
    troll_max: 0.49,
    neutral_min: 0.5,
    scholar_min: 1.8,
    hysteresis_enter: 1.85,
    hysteresis_lose: 1.70,
    review_window: 50,
    double_blind: true,
  },
  version: 1,
  updated_at: new Date(),
  updated_by: 'system',
};

type ConfigShape = typeof DEFAULT_CONFIG;

const REDIS_KEY = 'system:config';
const REDIS_TTL = 86400;

let cachedConfig: ConfigShape = { ...DEFAULT_CONFIG };
let cronInterval: NodeJS.Timeout | null = null;

function leanToShape(doc: Record<string, unknown>): ConfigShape {
  const rl = doc.rate_limits as Record<string, unknown> | undefined;
  const tt = doc.trust_tiers as Record<string, unknown> | undefined;
  const rlTiers = rl?.tiers as Record<string, Record<string, unknown>> | undefined;

  return {
    key: ((doc.key as string) || 'global') as 'global',
    rate_limits: {
      base_posts_per_hour: (rl?.base_posts_per_hour as number) ?? DEFAULT_CONFIG.rate_limits.base_posts_per_hour,
      base_comments_per_hour: (rl?.base_comments_per_hour as number) ?? DEFAULT_CONFIG.rate_limits.base_comments_per_hour,
      tiers: {
        troll: {
          multiplier: (rlTiers?.troll?.multiplier as number) ?? DEFAULT_CONFIG.rate_limits.tiers.troll.multiplier,
          min_posts: (rlTiers?.troll?.min_posts as number) ?? DEFAULT_CONFIG.rate_limits.tiers.troll.min_posts,
        },
        neutral: {
          multiplier: (rlTiers?.neutral?.multiplier as number) ?? DEFAULT_CONFIG.rate_limits.tiers.neutral.multiplier,
          min_posts: (rlTiers?.neutral?.min_posts as number) ?? DEFAULT_CONFIG.rate_limits.tiers.neutral.min_posts,
        },
        scholar: {
          multiplier: (rlTiers?.scholar?.multiplier as number) ?? DEFAULT_CONFIG.rate_limits.tiers.scholar.multiplier,
          min_posts: (rlTiers?.scholar?.min_posts as number) ?? DEFAULT_CONFIG.rate_limits.tiers.scholar.min_posts,
        },
      },
      counter_lists_unlimited: (rl?.counter_lists_unlimited as boolean) ?? DEFAULT_CONFIG.rate_limits.counter_lists_unlimited,
      comment_edit_window_minutes: (rl?.comment_edit_window_minutes as number) ?? DEFAULT_CONFIG.rate_limits.comment_edit_window_minutes,
    },
    trust_tiers: {
      troll_max: (tt?.troll_max as number) ?? DEFAULT_CONFIG.trust_tiers.troll_max,
      neutral_min: (tt?.neutral_min as number) ?? DEFAULT_CONFIG.trust_tiers.neutral_min,
      scholar_min: (tt?.scholar_min as number) ?? DEFAULT_CONFIG.trust_tiers.scholar_min,
      hysteresis_enter: (tt?.hysteresis_enter as number) ?? DEFAULT_CONFIG.trust_tiers.hysteresis_enter,
      hysteresis_lose: (tt?.hysteresis_lose as number) ?? DEFAULT_CONFIG.trust_tiers.hysteresis_lose,
      review_window: (tt?.review_window as number) ?? DEFAULT_CONFIG.trust_tiers.review_window,
      double_blind: (tt?.double_blind as boolean) ?? DEFAULT_CONFIG.trust_tiers.double_blind,
    },
    version: (doc.version as number) ?? DEFAULT_CONFIG.version,
    updated_at: (doc.updated_at as Date) ?? DEFAULT_CONFIG.updated_at,
    updated_by: (doc.updated_by as string) ?? DEFAULT_CONFIG.updated_by,
  };
}

export function getConfig(): ConfigShape {
  return cachedConfig;
}

export async function initConfig(): Promise<void> {
  try {
    let doc = await SystemConfig.findOne({ key: 'global' }).lean();

    if (!doc) {
      await SystemConfig.create(DEFAULT_CONFIG);
      doc = await SystemConfig.findOne({ key: 'global' }).lean();
    }

    if (doc) {
      cachedConfig = leanToShape(doc as Record<string, unknown>);
    }
  } catch (err) {
    console.error('[systemConfig] init failed, using defaults:', (err as Error).message);
  }
}

export async function updateConfig(
  changes: Partial<{
    rate_limits: Partial<ConfigShape['rate_limits']>;
    trust_tiers: Partial<ConfigShape['trust_tiers']>;
  }>,
  adminId: string,
): Promise<ConfigShape> {
  const setOps: Record<string, unknown> = {};
  const now = new Date();

  if (changes.rate_limits) {
    const rl = changes.rate_limits;
    if (rl.base_posts_per_hour !== undefined) setOps['rate_limits.base_posts_per_hour'] = rl.base_posts_per_hour;
    if (rl.base_comments_per_hour !== undefined) setOps['rate_limits.base_comments_per_hour'] = rl.base_comments_per_hour;
    if (rl.counter_lists_unlimited !== undefined) setOps['rate_limits.counter_lists_unlimited'] = rl.counter_lists_unlimited;
    if (rl.comment_edit_window_minutes !== undefined) setOps['rate_limits.comment_edit_window_minutes'] = rl.comment_edit_window_minutes;
    if (rl.tiers) {
      if (rl.tiers.troll) {
        if (rl.tiers.troll.multiplier !== undefined) setOps['rate_limits.tiers.troll.multiplier'] = rl.tiers.troll.multiplier;
        if (rl.tiers.troll.min_posts !== undefined) setOps['rate_limits.tiers.troll.min_posts'] = rl.tiers.troll.min_posts;
      }
      if (rl.tiers.neutral) {
        if (rl.tiers.neutral.multiplier !== undefined) setOps['rate_limits.tiers.neutral.multiplier'] = rl.tiers.neutral.multiplier;
        if (rl.tiers.neutral.min_posts !== undefined) setOps['rate_limits.tiers.neutral.min_posts'] = rl.tiers.neutral.min_posts;
      }
      if (rl.tiers.scholar) {
        if (rl.tiers.scholar.multiplier !== undefined) setOps['rate_limits.tiers.scholar.multiplier'] = rl.tiers.scholar.multiplier;
        if (rl.tiers.scholar.min_posts !== undefined) setOps['rate_limits.tiers.scholar.min_posts'] = rl.tiers.scholar.min_posts;
      }
    }
  }

  if (changes.trust_tiers) {
    const tt = changes.trust_tiers;
    if (tt.troll_max !== undefined) setOps['trust_tiers.troll_max'] = tt.troll_max;
    if (tt.neutral_min !== undefined) setOps['trust_tiers.neutral_min'] = tt.neutral_min;
    if (tt.scholar_min !== undefined) setOps['trust_tiers.scholar_min'] = tt.scholar_min;
    if (tt.hysteresis_enter !== undefined) setOps['trust_tiers.hysteresis_enter'] = tt.hysteresis_enter;
    if (tt.hysteresis_lose !== undefined) setOps['trust_tiers.hysteresis_lose'] = tt.hysteresis_lose;
    if (tt.review_window !== undefined) setOps['trust_tiers.review_window'] = tt.review_window;
    if (tt.double_blind !== undefined) setOps['trust_tiers.double_blind'] = tt.double_blind;
  }

  if (Object.keys(setOps).length === 0) {
    return cachedConfig;
  }

  setOps.version = cachedConfig.version + 1;
  setOps.updated_at = now;
  setOps.updated_by = adminId;

  const doc = await SystemConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: setOps },
    { new: true },
  ).lean();

  if (!doc) {
    throw new Error('SystemConfig document not found');
  }

  cachedConfig = leanToShape(doc as Record<string, unknown>);

  try {
    await redis.set(REDIS_KEY, JSON.stringify(cachedConfig), { EX: REDIS_TTL });
  } catch (err) {
    console.error('[systemConfig] Redis cache write failed:', (err as Error).message);
  }

  logAudit({
    admin_id: adminId,
    action: 'config_update',
    ip: 'system',
    metadata: {
      version: cachedConfig.version,
      changed_fields: Object.keys(changes.rate_limits ?? {}).concat(Object.keys(changes.trust_tiers ?? {})),
    },
  });

  return cachedConfig;
}

export async function refreshConfig(): Promise<void> {
  try {
    const doc = await SystemConfig.findOne({ key: 'global' }).lean();
    if (doc) {
      cachedConfig = leanToShape(doc as Record<string, unknown>);
      try {
        await redis.set(REDIS_KEY, JSON.stringify(cachedConfig), { EX: REDIS_TTL });
      } catch { /* Redis optional */ }
    }
  } catch (err) {
    console.error('[systemConfig] refresh failed:', (err as Error).message);
  }
}

export function startConfigCron(): void {
  if (cronInterval) return;
  cronInterval = setInterval(refreshConfig, 60000);
}

export function stopConfigCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}

export function getConfigVersions(): ConfigShape[] {
  return [cachedConfig];
}
