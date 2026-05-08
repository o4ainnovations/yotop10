import { es } from '../../lib/elasticsearch';
import { INDEX_PREFIX } from './indexer';

const BULK_CHUNK_SIZE = 500;

interface BulkResult {
  indexed: number;
  errors: number;
  errorDetails: Array<{ id: string; reason: string }>;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function executeBulkChunks(
  index: string,
  operations: string[],
  total: number
): Promise<BulkResult> {
  const result: BulkResult = { indexed: 0, errors: 0, errorDetails: [] };

  if (operations.length === 0) return result;

  for (const chunk of chunkArray(operations, BULK_CHUNK_SIZE * 2)) {
    try {
      const body = chunk.join('\n') + '\n';
      const response = await es.bulk({ index: `${INDEX_PREFIX}_${index}`, body } as any);

      if (response.errors) {
        for (const item of (response.items as Array<Record<string, unknown>>)) {
          const op = item.index || item.update || item.create || item.delete;
          if (op && (op as any).error) {
            result.errors++;
            result.errorDetails.push({
              id: String((op as any)._id || 'unknown'),
              reason: String((op as any).error?.reason || (op as any).error || 'unknown'),
            });
          } else {
            result.indexed++;
          }
        }
      } else {
        result.indexed += chunk.length / 2;
      }
    } catch (err) {
      result.errors += chunk.length / 2;
      result.errorDetails.push({ id: 'bulk_chunk', reason: (err as Error).message });
    }
  }

  return result;
}

export async function bulkReindexPosts(posts: Array<Record<string, unknown>>): Promise<BulkResult> {
  const operations: string[] = [];

  for (const post of posts) {
    const docId = (post._id as { toString(): string }).toString();
    const doc: Record<string, unknown> = {
      title: post.title, intro: post.intro, slug: post.slug,
      category_slug: post.category_slug, author_username: post.author_username,
      author_display_name: post.author_display_name, post_type: post.post_type,
      status: post.status, fire_count: post.fire_count || 0, comment_count: post.comment_count || 0,
      view_count: post.view_count || 0, created_at: post.created_at, published_at: post.published_at,
      featured: post.featured || false,
    };
    if ((post as any).items) doc.items = (post as any).items;

    operations.push(JSON.stringify({ index: { _id: docId } }));
    operations.push(JSON.stringify(doc));
  }

  return executeBulkChunks('posts', operations, posts.length);
}

interface PostLookup {
  title?: string;
  slug?: string;
}

export async function bulkReindexComments(
  comments: Array<Record<string, unknown>>,
  postMap?: Map<string, PostLookup>
): Promise<BulkResult> {
  const operations: string[] = [];

  for (const comment of comments) {
    const docId = (comment._id as { toString(): string }).toString();
    const postId = comment.post_id?.toString() || '';
    const postInfo = postMap?.get(postId);

    const doc: Record<string, unknown> = {
      content: comment.content, author_username: comment.author_username,
      post_id: postId, post_title: postInfo?.title || '', post_slug: postInfo?.slug || '',
      spark_score: comment.spark_score || 0, fire_count: comment.fire_count || 0,
      reply_count: comment.reply_count || 0, depth: comment.depth || 0,
      is_item_anchored: !!(comment as any).list_item_id, flag_type: (comment as any).flag_type || null,
      hidden: (comment as any).hidden || false, deleted: !!(comment as any).deleted,
      created_at: comment.created_at,
    };

    operations.push(JSON.stringify({ index: { _id: docId } }));
    operations.push(JSON.stringify(doc));
  }

  return executeBulkChunks('comments', operations, comments.length);
}

export async function bulkReindexCategories(
  categories: Array<Record<string, unknown>>
): Promise<BulkResult> {
  const operations: string[] = [];

  for (const cat of categories) {
    const docId = (cat._id as { toString(): string }).toString();
    const doc: Record<string, unknown> = {
      name: cat.name, slug: cat.slug,
      description: cat.description, post_count: cat.post_count || 0,
    };

    operations.push(JSON.stringify({ index: { _id: docId } }));
    operations.push(JSON.stringify(doc));
  }

  return executeBulkChunks('categories', operations, categories.length);
}

export async function bulkReindexUsers(
  users: Array<Record<string, unknown>>
): Promise<BulkResult> {
  const operations: string[] = [];

  for (const user of users) {
    const docId = (user._id as { toString(): string }).toString();
    const doc: Record<string, unknown> = {
      username: user.username,
      display_name: user.custom_display_name || user.username,
      trust_score: user.trust_score || 1,
      created_at: user.created_at,
    };

    operations.push(JSON.stringify({ index: { _id: docId } }));
    operations.push(JSON.stringify(doc));
  }

  return executeBulkChunks('users', operations, users.length);
}
