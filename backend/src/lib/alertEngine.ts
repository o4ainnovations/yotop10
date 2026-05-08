import { AlertThreshold } from '../models/AlertThreshold';
import { AlertHistory } from '../models/AlertHistory';
import { AlertNotificationModel } from '../models/AlertNotification';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { PlatformSnapshot } from '../models/PlatformSnapshot';
import { redis } from './redis';
import { countDocs } from '../elasticsearch/lib/indexWriter';
import type { AlertMetric } from '../models/AlertNotification';

const ALERT_REDIS_PREFIX = 'alert:';
const ALERT_TICK_MS = 60_000;

const METRIC_TITLES: Record<string, string> = {
  pending_queue_depth: 'Review Queue Backlog',
  approval_rate_drop: 'Approval Rate Drop',
  zero_review_hours: 'No Reviews',
  comment_brigade: 'Comment Brigade Detected',
  es_index_gap_pct: 'Search Index Gap',
  restricted_user_surge: 'Restricted User Surge',
  new_user_spam_wave: 'New User Spam Wave',
  scholar_ratio_collapse: 'Scholar Ratio Collapse',
  flagged_comment_backlog: 'Flagged Comment Backlog',
  hidden_comment_surge: 'Hidden Comment Surge',
  post_quality_drop: 'Post Quality Drop',
  snapshot_staleness: 'Snapshot Staleness',
};

function formatMessage(metric: string, value: number, threshold: number, operator: string): string {
  const op = operator === 'gt' ? 'above' : 'below';
  return `${METRIC_TITLES[metric] || metric}: value ${value} is ${op} threshold ${threshold}`;
}

export async function computeMetric(metric: string): Promise<number> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const fiveMinAgo = new Date(now.getTime() - 300_000);

  switch (metric) {
    case 'pending_queue_depth':
      return Post.countDocuments({ status: 'pending_review', deleted: false });

    case 'approval_rate_drop': {
      const [approved24h, rejected24h] = await Promise.all([
        Post.countDocuments({ status: 'approved', published_at: { $gte: dayAgo }, deleted: false }),
        Post.countDocuments({ status: 'rejected', created_at: { $gte: dayAgo }, deleted: false }),
      ]);
      const total = approved24h + rejected24h;
      return total > 0 ? Math.round((approved24h / total) * 100) : 100;
    }

    case 'zero_review_hours': {
      // Query Post directly — last approved or rejected post, not dependent on audit log
      const lastReviewed = await Post.findOne({
        status: { $in: ['approved', 'rejected'] },
        $or: [
          { published_at: { $ne: null } },
          { rejection_reason: { $ne: null } },
        ],
        deleted: false,
      }).sort({ updated_at: -1 }).select('published_at updated_at').lean();

      if (!lastReviewed) return 999;
      const lastAction = lastReviewed.published_at || (lastReviewed as any).updated_at;
      if (!lastAction) return 999;
      return Math.round((now.getTime() - new Date(lastAction).getTime()) / 3_600_000);
    }

    case 'comment_brigade': {
      const maxReply = await Comment.findOne({
        reply_count: { $gt: 0 },
        created_at: { $gte: fiveMinAgo },
        deleted: false,
      }).sort({ reply_count: -1 }).select('reply_count').lean();
      return maxReply?.reply_count || 0;
    }

    case 'es_index_gap_pct': {
      const [dbPosts, dbComments] = await Promise.all([
        Post.countDocuments({ $or: [{ deleted: false }, { deleted: { $exists: false } }] }),
        Comment.countDocuments({ $or: [{ deleted: false }, { deleted: { $exists: false } }], hidden: { $ne: true } }),
      ]);
      const [esPosts, esComments] = await Promise.all([countDocs('posts'), countDocs('comments')]);
      const totalDb = dbPosts + dbComments || 1;
      const totalEs = esPosts + esComments;
      return Math.round(((totalDb - totalEs) / totalDb) * 100);
    }

    case 'restricted_user_surge':
      return User.countDocuments({ restricted_until: { $gt: now } });

    case 'new_user_spam_wave': {
      const newUserIds = await User.distinct('user_id', { created_at: { $gte: dayAgo } });
      return Post.countDocuments({
        author_id: { $in: newUserIds },
        created_at: { $gte: hourAgo },
        deleted: false,
      });
    }

    case 'scholar_ratio_collapse': {
      const [total, scholars] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ trust_score: { $gte: 1.8 } }),
      ]);
      return total > 0 ? Math.round((scholars / total) * 100) : 100;
    }

    case 'flagged_comment_backlog':
      return Comment.countDocuments({ flag_type: { $ne: null }, deleted: false });

    case 'hidden_comment_surge':
      return Comment.countDocuments({ hidden: true, created_at: { $gte: hourAgo } });

    case 'post_quality_drop':
      return Post.countDocuments({
        status: 'approved',
        published_at: { $gte: dayAgo },
        intro: { $exists: true, $regex: /^.{0,99}$/ },
        deleted: false,
      });

    case 'snapshot_staleness': {
      const latest = await PlatformSnapshot.findOne().sort({ generated_at: -1 }).select('generated_at').lean();
      if (!latest) return 999;
      return Math.round((now.getTime() - new Date(latest.generated_at).getTime()) / 3_600_000);
    }

    default:
      return 0;
  }
}

export async function tickAlertEngine(): Promise<number> {
  const thresholds = await AlertThreshold.find({ enabled: true }).lean();
  if (thresholds.length === 0) return 0;

  const now = new Date();
  let fired = 0;

  for (const t of thresholds) {
    const cooldownMs = t.cooldown_minutes * 60_000;
    if (t.last_triggered_at && now.getTime() - new Date(t.last_triggered_at).getTime() < cooldownMs) {
      continue;
    }

    const value = await computeMetric(t.metric);
    const breached =
      t.operator === 'gt' ? value > t.threshold :
      t.operator === 'lt' ? value < t.threshold :
      false;

    const redisKey = `${ALERT_REDIS_PREFIX}${t.metric}`;
    const existingRedis = await redis.get(redisKey);

    if (breached) {
      await AlertHistory.create({
        metric: t.metric,
        severity: t.severity,
        value,
        threshold: t.threshold,
        operator: t.operator,
        triggered_at: now,
      });

      const payload = JSON.stringify({
        metric: t.metric,
        severity: t.severity,
        value,
        threshold: t.threshold,
        operator: t.operator,
        triggered_at: now.toISOString(),
      });
      await (redis as any).set(redisKey, payload, 'EX', Math.max(cooldownMs / 1000 * 2, 60));

      await AlertNotificationModel.create({
        alert_type: t.metric as AlertMetric,
        severity: t.severity,
        title: METRIC_TITLES[t.metric] || t.metric,
        message: formatMessage(t.metric, value, t.threshold, t.operator),
        value,
        threshold: t.threshold,
      });

      await AlertThreshold.findByIdAndUpdate(t._id, {
        last_triggered_at: now,
        notification_sent: true,
      });

      fired++;
    } else if (existingRedis) {
      await redis.del(redisKey);

      await AlertHistory.findOneAndUpdate(
        { metric: t.metric, resolved_at: null },
        { resolved_at: now },
        { sort: { triggered_at: -1 } }
      );

      await AlertThreshold.findByIdAndUpdate(t._id, {
        notification_sent: false,
      });
    }
  }

  return fired;
}

let cronHandle: NodeJS.Timeout | null = null;

async function seedDefaultThresholds(): Promise<void> {
  const count = await AlertThreshold.countDocuments({});
  if (count > 0) return;

  const defaults = [
    { metric: 'pending_queue_depth', threshold: 20, operator: 'gt' as const, severity: 'warning' as const, cooldown_minutes: 30 },
    { metric: 'pending_queue_depth', threshold: 50, operator: 'gt' as const, severity: 'critical' as const, cooldown_minutes: 15 },
    { metric: 'zero_review_hours', threshold: 24, operator: 'gt' as const, severity: 'warning' as const, cooldown_minutes: 60 },
    { metric: 'zero_review_hours', threshold: 72, operator: 'gt' as const, severity: 'critical' as const, cooldown_minutes: 60 },
    { metric: 'es_index_gap_pct', threshold: 10, operator: 'gt' as const, severity: 'warning' as const, cooldown_minutes: 30 },
    { metric: 'restricted_user_surge', threshold: 10, operator: 'gt' as const, severity: 'warning' as const, cooldown_minutes: 30 },
    { metric: 'new_user_spam_wave', threshold: 5, operator: 'gt' as const, severity: 'critical' as const, cooldown_minutes: 15 },
    { metric: 'flagged_comment_backlog', threshold: 30, operator: 'gt' as const, severity: 'warning' as const, cooldown_minutes: 30 },
    { metric: 'approval_rate_drop', threshold: 50, operator: 'lt' as const, severity: 'warning' as const, cooldown_minutes: 30 },
    { metric: 'scholar_ratio_collapse', threshold: 5, operator: 'lt' as const, severity: 'warning' as const, cooldown_minutes: 60 },
    { metric: 'snapshot_staleness', threshold: 24, operator: 'gt' as const, severity: 'warning' as const, cooldown_minutes: 60 },
    { metric: 'post_quality_drop', threshold: 5, operator: 'gt' as const, severity: 'warning' as const, cooldown_minutes: 30 },
  ];

  for (const d of defaults) {
    const exists = await AlertThreshold.findOne({ metric: d.metric, threshold: d.threshold, operator: d.operator, severity: d.severity });
    if (!exists) {
      await AlertThreshold.create(d);
    }
  }
  console.log(`[AlertEngine] Seeded ${defaults.length} default thresholds`);
}

export function startAlertEngine(): void {
  if (cronHandle) return;
  console.log('[AlertEngine] Starting (every 60s)');

  seedDefaultThresholds();

  tickAlertEngine();
  cronHandle = setInterval(tickAlertEngine, ALERT_TICK_MS);
}

export function stopAlertEngine(): void {
  if (cronHandle) { clearInterval(cronHandle); cronHandle = null; }
}
