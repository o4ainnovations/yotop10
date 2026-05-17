import { redis } from './redis';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';

const SCORED_CACHE_KEY = 'arguments:scored';
const HOT_ZSET_KEY = 'arguments:hot';

let cronInterval: NodeJS.Timeout | null = null;

export async function computeArgumentScores() {
  try {
    const posts = await Post.find({
      post_type: { $in: ['this_vs_that', 'counter_list'] },
      status: 'approved',
      deleted: { $ne: true },
      created_at: { $gte: new Date(Date.now() - 30 * 86400000) },
    })
      .select('_id slug post_type created_at bumped_at')
      .lean();

    if (!posts || posts.length === 0) return;

    const scored: Array<{ slug: string; score: number }> = [];

    for (const post of posts as Record<string, unknown>[]) {
      const pid = typeof post._id === 'object' && post._id !== null
        ? (post._id as { toString(): string }).toString()
        : String(post._id);

      const velocityKey = `arguments:velocity:${pid}`;
      const velocity = parseInt((await redis.get(velocityKey)) || '0', 10);

      const lastActivity = (post.bumped_at || post.created_at) as string | Date;
      const hoursSinceLast = (Date.now() - new Date(lastActivity).getTime()) / 3600000;
      const freshness = Math.max(0, 1 - hoursSinceLast / 168);

      const sparkComments = await Comment.countDocuments({
        post_id: post._id,
        list_item_id: { $ne: null },
        spark_score: { $gte: 0.5 },
      });

      const spark = Math.log1p(sparkComments) / Math.log1p(10);

      const score = velocity * 0.5 + freshness * 0.3 + spark * 0.2;
      const finalScore = parseFloat(score.toFixed(4));

      const slug = post.slug as string;

      try {
        await redis.zAdd(HOT_ZSET_KEY, { score: finalScore, value: slug });
      } catch {
        /* zAdd may fail in test mocks */
      }

      scored.push({ slug, score: finalScore });
    }

    scored.sort((a, b) => b.score - a.score);

    try {
      await redis.set(SCORED_CACHE_KEY, JSON.stringify(scored.slice(0, 100)), { EX: 7200 });
    } catch {
      /* set may fail in test mocks */
    }
  } catch (e) {
    console.error('[ArgumentCron] Error:', (e as Error).message);
  }
}

export function startArgumentCron() {
  if (cronInterval) return;
  computeArgumentScores();
  cronInterval = setInterval(computeArgumentScores, 60000);
}

export function stopArgumentCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}
