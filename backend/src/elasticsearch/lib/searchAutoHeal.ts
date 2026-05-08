import { Post } from '../../models/Post';
import { Comment } from '../../models/Comment';
import { Category } from '../../models/Category';
import { User } from '../../models/User';
import { countDocs } from './indexWriter';
import { bulkReindexPosts, bulkReindexComments, bulkReindexCategories, bulkReindexUsers } from './bulkWriter';

const GAP_THRESHOLD_PCT = 5;
const GAP_PERSIST_CHECKS = 2;
const HEAL_INTERVAL_MS = 5 * 60 * 1000;

const gapCounters: Record<string, number> = { posts: 0, comments: 0, categories: 0, users: 0 };

export async function checkAndHeal(): Promise<void> {
  const checks: Array<{ name: string; dbCount: number }> = [];

  try {
    checks.push({ name: 'posts', dbCount: await Post.countDocuments({ $or: [{ deleted: false }, { deleted: { $exists: false } }] }) });
    checks.push({ name: 'comments', dbCount: await Comment.countDocuments({ $or: [{ deleted: false }, { deleted: { $exists: false } }], hidden: { $ne: true } }) });
    checks.push({ name: 'categories', dbCount: await Category.countDocuments({ is_archived: false }) });
    checks.push({ name: 'users', dbCount: await User.countDocuments({}) });
  } catch (err) { return; }

  for (const check of checks) {
    const esCount = await countDocs(check.name);
    const gap = check.dbCount - esCount;
    const gapPct = check.dbCount > 0 ? (gap / check.dbCount) * 100 : 0;

    if (gapPct > GAP_THRESHOLD_PCT) {
      gapCounters[check.name] = (gapCounters[check.name] || 0) + 1;
      if (gapCounters[check.name] >= GAP_PERSIST_CHECKS) {
        console.log(`[SearchAutoHeal] Gap in ${check.name}: DB=${check.dbCount} ES=${esCount} → reindexing`);
        await reindexCollection(check.name);
        gapCounters[check.name] = 0;
      }
    } else {
      gapCounters[check.name] = 0;
    }
  }
}

async function reindexCollection(name: string): Promise<void> {
  try {
    if (name === 'posts') {
      const posts = await Post.find({ $or: [{ deleted: false }, { deleted: { $exists: false } }] }).lean();
      const result = await bulkReindexPosts(posts as Array<Record<string, unknown>>);
      console.log(`[SearchAutoHeal] Posts reindexed: ${result.indexed} indexed, ${result.errors} errors`);
    } else if (name === 'comments') {
      const comments = await Comment.find({
        $or: [{ deleted: false }, { deleted: { $exists: false } }],
        hidden: { $ne: true },
      }).lean();

      const postIds = [...new Set(comments.map((c) => c.post_id?.toString()).filter(Boolean))];
      const postLookups = await Post.find({ _id: { $in: postIds } }).select('title slug').lean();
      const postMap = new Map(postLookups.map((p) => [p._id.toString(), { title: p.title, slug: p.slug }]));

      const result = await bulkReindexComments(comments as Array<Record<string, unknown>>, postMap);
      console.log(`[SearchAutoHeal] Comments reindexed: ${result.indexed} indexed, ${result.errors} errors`);
    } else if (name === 'categories') {
      const cats = await Category.find({ is_archived: false }).lean();
      const result = await bulkReindexCategories(cats as unknown as Array<Record<string, unknown>>);
      console.log(`[SearchAutoHeal] Categories reindexed: ${result.indexed} indexed, ${result.errors} errors`);
    } else if (name === 'users') {
      const users = await User.find({}).lean();
      const result = await bulkReindexUsers(users as unknown as Array<Record<string, unknown>>);
      console.log(`[SearchAutoHeal] Users reindexed: ${result.indexed} indexed, ${result.errors} errors`);
    }
  } catch (err) {
    console.error(`[SearchAutoHeal] Reindex failed: ${name}`, err);
  }
}

let cronHandle: NodeJS.Timeout | null = null;

export function startAutoHeal(): void {
  if (cronHandle) return;
  checkAndHeal();
  cronHandle = setInterval(checkAndHeal, HEAL_INTERVAL_MS);
  console.log('[SearchAutoHeal] Started (every 5min)');
}

export function stopAutoHeal(): void {
  if (cronHandle) { clearInterval(cronHandle); cronHandle = null; }
}
