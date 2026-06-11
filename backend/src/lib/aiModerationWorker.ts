import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { redis } from './redis';
import { getAiConfig, analyzePost, type AiModerationResult, type AiModerationConfig } from './aiModeration';
import { indexPost } from '../elasticsearch/lib/indexWriter';

const QUEUE_KEY = 'ai_moderation:queue';
const LOCK_KEY = 'ai_moderation:lock';
const MAX_RETRIES = 3;
const LOCK_TTL = 60;
const BATCH_SIZE = 10;

export async function queuePostForAiReview(postId: string): Promise<void> {
  try {
    await redis.lPush(QUEUE_KEY, postId);
  } catch (err) {
    console.error('[aiWorker] Failed to queue post:', err);
  }
}

export async function processAiModerationQueue(): Promise<void> {
  const locked = await redis.set(LOCK_KEY, '1', { NX: true, EX: LOCK_TTL });
  if (!locked) return;

  try {
    const config = await getAiConfig();
    if (!config || !config.enabled) return;

    const postIds = await redis.lRange(QUEUE_KEY, 0, BATCH_SIZE - 1);
    if (postIds.length === 0) return;

    const batch: string[] = [];
    for (const pid of postIds) {
      const remaining = await redis.lRem(QUEUE_KEY, 1, pid);
      if (remaining > 0) batch.push(pid);
    }

    for (const postId of batch) {
      try {
        await processSinglePost(postId, config);
      } catch (err) {
        console.error(`[aiWorker] Failed to process ${postId}:`, (err as Error).message);
        // Re-enqueue with retry count
        const retryKey = `ai_moderation:retry:${postId}`;
        const retries = await redis.incr(retryKey);
        await redis.expire(retryKey, 86400);
        if (retries <= MAX_RETRIES) {
          await redis.lPush(QUEUE_KEY, postId);
        }
      }
    }
  } finally {
    await redis.del(LOCK_KEY);
  }
}

async function processSinglePost(postId: string, config: AiModerationConfig): Promise<void> {
  const post = await Post.findById(postId).lean();
  if (!post) return;
  if (post.status !== 'pending_review') return;
  if ((post as any).ai_reviewed_at) return; // already reviewed

  // Build items summary
  const items = await ListItem.find({ post_id: postId })
    .sort({ rank: 1 })
    .limit(10)
    .select('title justification')
    .lean();

  const itemsSummary = items
    .map((item: any) => `${item.title}: ${(item.justification || '').substring(0, 100)}`)
    .join(' | ');

  const result: AiModerationResult = await analyzePost(
    post.title,
    post.post_type,
    (post as any).intro || '',
    itemsSummary,
    config,
  );

  const update: Record<string, unknown> = {
    ai_score: result.score,
    ai_reviewed_at: new Date(),
    ai_flags: result.flags,
    ai_model: result.model,
    ai_prompt_tokens: result.prompt_tokens,
  };

  // Auto-approve if score meets threshold
  if (result.score >= config.auto_approve_threshold) {
    update.status = 'approved';
    update.published_at = new Date();
  }

  const updated = await Post.findByIdAndUpdate(postId, { $set: update }, { new: true });
  if (updated && update.status === 'approved') {
    try {
      await indexPost(updated as unknown as Record<string, unknown>);
    } catch { /* non-critical */ }
    console.log(`[aiWorker] Auto-approved ${post.slug} (score: ${result.score})`);
  } else {
    console.log(`[aiWorker] Flagged ${post.slug} (score: ${result.score}, flags: ${result.flags.join(', ')})`);
  }
}
