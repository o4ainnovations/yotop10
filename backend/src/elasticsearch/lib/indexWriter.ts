/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- ES client types reject dynamic body objects */
import { es } from '../../lib/elasticsearch';
import { INDEX_PREFIX } from './indexer';
import { SearchDeadLetter } from '../../models/SearchDeadLetter';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [100, 500, 2500];

interface WriteMeta {
  collection: string;
  docId: string;
  operation: 'index' | 'delete';
}

type WriteOp = () => Promise<WriteMeta>;

let deadLetterCount = 0;

export function getDeadLetterCount(): number {
  return deadLetterCount;
}

async function withRetry(op: WriteOp, label: string): Promise<WriteMeta> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const meta = await op();
      if (attempt > 1) {
        console.log(`[Search] ${label} recovered on attempt ${attempt}/${MAX_RETRIES}`);
      }
      return meta;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        console.warn(`[Search] ${label} attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAYS_MS[attempt - 1]}ms: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
      }
    }
  }
  throw lastErr;
}

async function writeDeadLetter(
  label: string,
  error: string,
  meta?: WriteMeta
): Promise<void> {
  try {
    await SearchDeadLetter.findOneAndUpdate(
      {
        index_name: meta ? `${INDEX_PREFIX}_${meta.collection}` : label,
        docId: meta?.docId || 'unknown',
      },
      {
        index_name: meta ? `${INDEX_PREFIX}_${meta.collection}` : label,
        docId: meta?.docId || 'unknown',
        operation: meta?.operation || 'index',
        error: error.substring(0, 500),
        attempts: MAX_RETRIES,
        last_attempt_at: new Date(),
      },
      { upsert: true, new: true }
    );
    deadLetterCount++;
    console.error(`[Search] ${label} written to dead letter queue: ${error.substring(0, 120)}`);
  } catch (dlErr) {
    console.error(`[Search] CRITICAL: Failed to write dead letter for ${label}:`, dlErr);
  }
}

const enqueue = (label: string, op: WriteOp): void => {
  Promise.resolve().then(async () => {
    try {
      const meta = await withRetry(op, label);
      // Success — nothing more to do
      void meta;
    } catch (err) {
      const msg = (err as Error).message;
      if (label.includes('remove') || label.includes('delete')) {
        // Deletes: if document not found in ES, it's not a real error
        if (msg.includes('not_found')) {
          return;
        }
        console.error(`[Search] ${label} delete failed: ${msg}`);
        return;
      }
      // Write to dead letter queue for manual retry
      try {
        const meta: WriteMeta = { collection: 'unknown', docId: 'unknown', operation: 'index' };
        if (label === 'indexPost') { meta.collection = 'posts'; }
        else if (label === 'indexComment') { meta.collection = 'comments'; }
        else if (label === 'indexCategory') { meta.collection = 'categories'; }
        else if (label === 'indexUser') { meta.collection = 'users'; }
        await writeDeadLetter(label, msg, meta);
      } catch {
        console.error(`[Search] ${label} failed after all retries: ${msg}`);
      }
    }
  });
};

export function indexPost(post: Record<string, unknown>): void {
  const docId = (post._id as { toString(): string }).toString();
  enqueue('indexPost', async () => {
    const body: Record<string, unknown> = {
      doc: {
        title: post.title, intro: post.intro, slug: post.slug,
        category_slug: post.category_slug, author_username: post.author_username,
        author_display_name: post.author_display_name, post_type: post.post_type,
        status: post.status, fire_count: post.fire_count || 0, comment_count: post.comment_count || 0,
        view_count: post.view_count || 0, created_at: post.created_at, published_at: post.published_at,
        featured: post.featured || false,
      },
      doc_as_upsert: true,
    };
    if ((post as any).items) (body.doc as any).items = (post as any).items;
    await es.update({
      index: `${INDEX_PREFIX}_posts`,
      id: docId,
      body,
      retry_on_conflict: 3,
    });
    return { collection: 'posts', docId, operation: 'index' };
  });
}

export function removePost(postId: string): void {
  enqueue('removePost', async () => {
    await es.delete({ index: `${INDEX_PREFIX}_posts`, id: postId });
    return { collection: 'posts', docId: postId, operation: 'delete' };
  });
}

export function indexComment(comment: Record<string, unknown>, postTitle?: string, postSlug?: string): void {
  const docId = (comment._id as { toString(): string }).toString();
  enqueue('indexComment', async () => {
    await es.index({
      index: `${INDEX_PREFIX}_comments`,
      id: docId,
      body: {
        content: comment.content, author_username: comment.author_username,
        post_id: comment.post_id?.toString(), post_title: postTitle || '', post_slug: postSlug || '',
        spark_score: comment.spark_score || 0, fire_count: comment.fire_count || 0,
        reply_count: comment.reply_count || 0, depth: comment.depth || 0,
        is_item_anchored: !!(comment as any).list_item_id, flag_type: (comment as any).flag_type || null,
        hidden: (comment as any).hidden || false, deleted: !!(comment as any).deleted,
        created_at: comment.created_at,
      },
    });
    return { collection: 'comments', docId, operation: 'index' };
  });
}

export function removeComment(commentId: string): void {
  enqueue('removeComment', async () => {
    await es.delete({ index: `${INDEX_PREFIX}_comments`, id: commentId });
    return { collection: 'comments', docId: commentId, operation: 'delete' };
  });
}

export function indexCategory(category: Record<string, unknown>): void {
  const docId = (category._id as { toString(): string }).toString();
  enqueue('indexCategory', async () => {
    await es.index({
      index: `${INDEX_PREFIX}_categories`,
      id: docId,
      body: {
        name: category.name, slug: category.slug,
        description: category.description, post_count: category.post_count || 0,
      },
    });
    return { collection: 'categories', docId, operation: 'index' };
  });
}

export function removeCategory(categoryId: string): void {
  enqueue('removeCategory', async () => {
    await es.delete({ index: `${INDEX_PREFIX}_categories`, id: categoryId });
    return { collection: 'categories', docId: categoryId, operation: 'delete' };
  });
}

export function indexUser(user: Record<string, unknown>): void {
  const docId = (user._id as { toString(): string }).toString();
  enqueue('indexUser', async () => {
    await es.index({
      index: `${INDEX_PREFIX}_users`,
      id: docId,
      body: {
        username: user.username,
        display_name: user.custom_display_name || user.username,
        trust_score: user.trust_score || 1,
        created_at: user.created_at,
      },
    });
    return { collection: 'users', docId, operation: 'index' };
  });
}

export function removeUser(userId: string): void {
  enqueue('removeUser', async () => {
    await es.delete({ index: `${INDEX_PREFIX}_users`, id: userId });
    return { collection: 'users', docId: userId, operation: 'delete' };
  });
}

export async function countDocs(index: string): Promise<number> {
  try {
    const result = await es.count({ index: `${INDEX_PREFIX}_${index}` });
    return result.count;
  } catch {
    return 0;
  }
}

export { INDEX_PREFIX };
