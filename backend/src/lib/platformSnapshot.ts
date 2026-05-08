import { PlatformSnapshot } from '../models/PlatformSnapshot';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { PageVisit } from '../models/PageVisit';
import { Notification } from '../models/Notification';
import { AlertThreshold } from '../models/AlertThreshold';
import { AlertHistory } from '../models/AlertHistory';
import { redis } from './redis';
import { reconcilePostCounts } from './postCountReconciler';

async function computeSnapshot(dateStr: string) {
  const dayStart = new Date(dateStr + 'T00:00:00.000Z');
  const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
  const monthStart = new Date(dayStart);
  monthStart.setDate(monthStart.getDate() - 30);
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const postPipeline = (match: Record<string, unknown>) => Post.countDocuments({ ...match, deleted: false });

  const [
    postsSubmitted, postsApproved, postsRejected, postsPending,
    postsInRevision, postsTotal, postsThisWeek, postsThisMonth,
    commentsTotal, commentsThisWeek, commentsToday,
    usersTotal, usersNewToday, usersNewThisWeek, usersActive30d, usersActive7d,
    scholars, neutrals, trolls,
    trollsActive24h,
    fireTotal,
    pageVisitsTotal, pageVisitsToday,
    _reviewsToday, approvedToday, rejectedToday, retryToday,
    categoryDocs,
    topComments,
    topFired,
    topViewed,
    notificationsDelivered, notificationsClicked,
  ] = await Promise.all([
    postPipeline({ created_at: { $gte: dayStart, $lte: dayEnd } }),
    postPipeline({ status: 'approved', created_at: { $gte: dayStart, $lte: dayEnd } }),
    postPipeline({ status: 'rejected', created_at: { $gte: dayStart, $lte: dayEnd } }),
    postPipeline({ status: 'pending_review' }),
    postPipeline({ status: 'pending_review', revision_guidance: { $ne: null } }),
    postPipeline({}),
    postPipeline({ created_at: { $gte: weekStart, $lte: dayEnd } }),
    postPipeline({ created_at: { $gte: monthStart, $lte: dayEnd } }),
    Comment.countDocuments({ deleted: false, hidden: false }),
    Comment.countDocuments({ created_at: { $gte: weekStart, $lte: dayEnd }, deleted: false, hidden: false }),
    Comment.countDocuments({ created_at: { $gte: dayStart, $lte: dayEnd }, deleted: false, hidden: false }),
    User.countDocuments({}),
    User.countDocuments({ created_at: { $gte: dayStart, $lte: dayEnd } }),
    User.countDocuments({ created_at: { $gte: weekStart, $lte: dayEnd } }),
    User.countDocuments({ created_at: { $lte: dayEnd, $gte: monthStart } }),
    User.countDocuments({ created_at: { $lte: dayEnd, $gte: weekStart } }),
    User.countDocuments({ trust_score: { $gte: 1.8 } }),
    User.countDocuments({ trust_score: { $gte: 0.5, $lt: 1.8 } }),
    User.countDocuments({ trust_score: { $lt: 0.5 } }),
    User.countDocuments({ trust_score: { $lt: 0.5 }, updated_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    Post.aggregate([{ $match: { deleted: false } }, { $group: { _id: null, total: { $sum: '$fire_count' } } }]).then(r => (r[0]?.total || 0)),
    PageVisit.countDocuments({}),
    PageVisit.countDocuments({ created_at: { $gte: dayStart, $lte: dayEnd } }),
    Post.countDocuments({ status: 'approved', published_at: { $gte: dayStart, $lte: dayEnd }, deleted: false }),
    Post.countDocuments({ status: 'approved', published_at: { $gte: dayStart, $lte: dayEnd }, deleted: false }),
    Post.countDocuments({ status: 'rejected', updated_at: { $gte: dayStart, $lte: dayEnd }, deleted: false }),
    Post.countDocuments({ revision_count: { $gt: 0 }, updated_at: { $gte: dayStart, $lte: dayEnd }, deleted: false }),
    Category.find({ is_archived: false }).select('slug name post_count parent_id').lean(),
    Post.find({ status: 'approved', deleted: false }).sort({ comment_count: -1 }).limit(10).select('slug title comment_count').lean(),
    Post.find({ status: 'approved', deleted: false }).sort({ fire_count: -1 }).limit(10).select('slug title fire_count').lean(),
    Post.find({ status: 'approved', deleted: false }).sort({ view_count: -1 }).limit(10).select('slug title view_count').lean(),
    Notification.countDocuments({ delivered_at: { $ne: null } }),
    Notification.countDocuments({ clicked_at: { $ne: null } }),
  ]);

  const rejectionReasons = await Post.aggregate([
    { $match: { status: 'rejected', updated_at: { $gte: dayStart, $lte: dayEnd }, deleted: false } },
    { $group: { _id: '$rejection_reason', count: { $sum: 1 } } },
  ]);

  const rejectionReasonMap: Record<string, number> = {};
  for (const r of rejectionReasons) {
    const key = (r._id || 'other').toString().substring(0, 50);
    rejectionReasonMap[key] = (rejectionReasonMap[key] || 0) + r.count;
  }

  const categoryChildren = categoryDocs.filter((c: Record<string, unknown>) => c.parent_id);
  const _categoryParents = categoryDocs.filter((c: Record<string, unknown>) => !c.parent_id);
  const topCategories = [...categoryDocs]
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.post_count as number) - (a.post_count as number))
    .slice(0, 10)
    .map((c: Record<string, unknown>) => ({ slug: c.slug, post_count: c.post_count }));
  const emptyChildren = categoryChildren.filter((c: Record<string, unknown>) => (c.post_count as number) === 0).length;

  const snapshot = {
    date: dateStr,
    generated_at: new Date(),
    content: {
      posts: {
        submitted: postsSubmitted, approved: postsApproved, rejected: postsRejected,
        pending: postsPending, in_revision: postsInRevision, total: postsTotal,
        this_week: postsThisWeek, this_month: postsThisMonth,
      },
      comments: { total: commentsTotal, this_week: commentsThisWeek, today: commentsToday },
    },
    community: {
      users: {
        total: usersTotal, new_today: usersNewToday, new_this_week: usersNewThisWeek,
        active_30d: usersActive30d, active_7d: usersActive7d,
      },
      trust: { scholars, neutrals, trolls },
      trolls_active_24h: trollsActive24h,
    },
    moderation: {
      reviews_today: approvedToday + rejectedToday + retryToday,
      approved_today: approvedToday,
      rejected_today: rejectedToday,
      retry_today: retryToday,
      pending_queue: { total: postsPending },
      rejection_reasons: rejectionReasonMap,
    },
    categories: {
      top_by_posts: topCategories,
      empty_children: emptyChildren,
      utilization_pct: categoryChildren.length > 0
        ? Math.round(((categoryChildren.length - emptyChildren) / categoryChildren.length) * 100)
        : 0,
    },
    engagement: {
      total_fire: fireTotal,
      top_commented: topComments.map((p: Record<string, unknown>) => ({ slug: p.slug, title: p.title, comment_count: p.comment_count })),
      top_fired: topFired.map((p: Record<string, unknown>) => ({ slug: p.slug, title: p.title, fire_count: p.fire_count })),
      top_viewed: topViewed.map((p: Record<string, unknown>) => ({ slug: p.slug, title: p.title, view_count: p.view_count })),
      notification_delivery_rate: notificationsDelivered > 0 ? Math.round((notificationsClicked / notificationsDelivered) * 100) : 0,
    },
    traffic: {
      total_visits: pageVisitsTotal,
      visits_today: pageVisitsToday,
    },
  };

  return snapshot;
}

async function evaluateAlerts(snapshot: Record<string, unknown>) {
  const alerts = await AlertThreshold.find({ enabled: true });
  for (const alert of alerts) {
    const value = alert.metric === 'queue_length' ? ((snapshot.moderation as Record<string, unknown>)?.pending_queue as number)
      : alert.metric === 'trolls_active' ? ((snapshot.community as Record<string, unknown>)?.trolls_active_24h as number)
      : null;

    if (value === null || value === undefined) continue;

    const triggered = alert.operator === 'gt' ? value > alert.threshold : value < alert.threshold;
    if (triggered) {
      const existingUnresolved = await AlertHistory.findOne({ metric: alert.metric, resolved_at: null });
      if (!existingUnresolved) {
        await AlertHistory.create({
          metric: alert.metric, severity: alert.severity,
          value, threshold: alert.threshold, operator: alert.operator,
          triggered_at: new Date(),
        });
      }
      await AlertThreshold.findByIdAndUpdate(alert._id, {
        last_triggered_at: new Date(), notification_sent: true,
      });
      await redis.set(`alert:${alert.metric}`, JSON.stringify({
        metric: alert.metric, severity: alert.severity, value, threshold: alert.threshold,
        triggered_at: new Date().toISOString(),
      }), { EX: 24 * 60 * 60 });
    } else {
      await AlertHistory.findOneAndUpdate(
        { metric: alert.metric, resolved_at: null },
        { resolved_at: new Date() }
      );
      await AlertThreshold.findByIdAndUpdate(alert._id, { notification_sent: false });
    }
  }
}

async function writeCronHeartbeat(name: string, success: boolean, error?: string) {
  try {
    await redis.hSet('cron:heartbeats', name, JSON.stringify({
      last_run: new Date().toISOString(),
      last_success: success ? new Date().toISOString() : null,
      last_error: error || null,
    }));
  } catch { /* Redis may be down — heartbeat write is best-effort */ }
}

let cronHandle: NodeJS.Timeout | null = null;

export async function runSnapshotNow(): Promise<void> {
  const today = new Date().toISOString().substring(0, 10);
  try {
    const snapshot = await computeSnapshot(today);
    await PlatformSnapshot.findOneAndUpdate(
      { date: today },
      { $set: snapshot },
      { upsert: true, new: true }
    );
    await reconcilePostCounts();
    await evaluateAlerts(snapshot);
    await writeCronHeartbeat('snapshot', true);
    console.log(`[Snapshot] Generated for ${today}`);
  } catch (err) {
    await writeCronHeartbeat('snapshot', false, (err as Error).message);
    console.error('[Snapshot] Failed:', (err as Error).message);
  }
}

export function startSnapshotCron(): void {
  if (cronHandle) return;
  runSnapshotNow();

  // Auto hard-delete expired soft-deleted posts every 60 seconds
  setInterval(async () => {
    try {
      const result = await Post.deleteMany({ auto_hard_delete_at: { $lt: new Date(), $ne: null } });
      if (result.deletedCount > 0) console.log(`[HardDelete] Removed ${result.deletedCount} expired soft-deleted posts`);
    } catch (e) { /* silent */ }
  }, 60 * 1000);

  cronHandle = setInterval(runSnapshotNow, 60 * 60 * 1000);
  console.log('[Snapshot] Cron started (hourly)');
}

export function stopSnapshotCron(): void {
  if (cronHandle) { clearInterval(cronHandle); cronHandle = null; }
}
