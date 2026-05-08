import { es } from '../../lib/elasticsearch';
import { INDEX_PREFIX } from './indexer';
import { SearchDeadLetter } from '../../models/SearchDeadLetter';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [100, 500, 2500];

type WriteOp = () => Promise<void>;

function logFailure(operation: string, err: unknown) {
  console.error(`[Search] ${operation} failed:`, (err as Error).message);
}

async function withRetry(op: WriteOp, label: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await op();
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        console.warn(`[Search] ${label} attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAYS_MS[attempt - 1]}ms`);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
      }
    }
  }
  throw lastErr;
}

async function writeToDeadLetter(indexName: string, docId: string, operation: 'index' | 'delete', error: string): Promise<void> {
  try {
    await SearchDeadLetter.findOneAndUpdate(
      { index_name: indexName, docId },
      { index_name: indexName, docId, operation, error, attempts: MAX_RETRIES, last_attempt_at: new Date() },
      { upsert: true, new: true }
    );
  } catch {
    console.error(`[Search] Failed to write dead letter for ${indexName}/${docId}: ${error}`);
  }
}

const fireAndForget = (label: string, fn: () => Promise<{ collection: string; docId: string; operation: 'index' | 'delete' }>) => {
  Promise.resolve().then(async () => {
    try {
      await fn();
    } catch (err) {
      const msg = (err as Error).message;
      if (label.includes('delete')) {
        logFailure(label, err);
        return;
      }
      try {
        const meta = await fn().catch(() => ({ collection: 'unknown', docId: 'unknown', operation: 'index' as const }));
        await writeToDeadLetter(meta.collection, meta.docId, meta.operation, msg);
      } catch {
        console.error(`[Search] ${label} failed after all retries: ${msg}`);
      }
    }
  });
};

export function indexPost(post: Record<string, unknown>): void {
  const docId = (post._id as { toString(): string }).toString();
  fireAndForget('indexPost', async () => {
    await withRetry(async () => {
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
    }, 'indexPost');
    return { collection: 'posts', docId, operation: 'index' };
  });
}

export function removePost(postId: string): void {
  fireAndForget('removePost', async () => {
    await withRetry(async () => {
      await es.delete({ index: `${INDEX_PREFIX}_posts`, id: postId });
    }, 'removePost');
    return { collection: 'posts', docId: postId, operation: 'delete' };
  });
}

export function indexComment(comment: Record<string, unknown>, postTitle?: string, postSlug?: string): void {
  const docId = (comment._id as { toString(): string }).toString();
  fireAndForget('indexComment', async () => {
    await withRetry(async () => {
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
    }, 'indexComment');
    return { collection: 'comments', docId, operation: 'index' };
  });
}

export function removeComment(commentId: string): void {
  fireAndForget('removeComment', async () => {
    await withRetry(async () => {
      await es.delete({ index: `${INDEX_PREFIX}_comments`, id: commentId });
    }, 'removeComment');
    return { collection: 'comments', docId: commentId, operation: 'delete' };
  });
}

export function indexCategory(category: Record<string, unknown>): void {
  const docId = (category._id as { toString(): string }).toString();
  fireAndForget('indexCategory', async () => {
    await withRetry(async () => {
      await es.index({
        index: `${INDEX_PREFIX}_categories`,
        id: docId,
        body: {
          name: category.name, slug: category.slug,
          description: category.description, post_count: category.post_count || 0,
        },
      });
    }, 'indexCategory');
    return { collection: 'categories', docId, operation: 'index' };
  });
}

export function removeCategory(categoryId: string): void {
  fireAndForget('removeCategory', async () => {
    await withRetry(async () => {
      await es.delete({ index: `${INDEX_PREFIX}_categories`, id: categoryId });
    }, 'removeCategory');
    return { collection: 'categories', docId: categoryId, operation: 'delete' };
  });
}

export function indexUser(user: Record<string, unknown>): void {
  const docId = (user._id as { toString(): string }).toString();
  fireAndForget('indexUser', async () => {
    await withRetry(async () => {
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
    }, 'indexUser');
    return { collection: 'users', docId, operation: 'index' };
  });
}

export function removeUser(userId: string): void {
  fireAndForget('removeUser', async () => {
    await withRetry(async () => {
      await es.delete({ index: `${INDEX_PREFIX}_users`, id: userId });
    }, 'removeUser');
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
