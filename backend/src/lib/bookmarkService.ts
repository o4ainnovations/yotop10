import { SavedPost } from '../models/SavedPost';
import { Post } from '../models/Post';
import { redis } from '../lib/redis';

const SAVED_SET_PREFIX = 'bookmarks:user:';
const SAVED_TTL = 3600;

export async function saveBookmark(userId: string, postId: string): Promise<{ saved: boolean; already: boolean }> {
  const existing = await SavedPost.findOne({ user_id: userId, post_id: postId });
  if (existing) {
    return { saved: false, already: true };
  }

  await SavedPost.create({ user_id: userId, post_id: postId, saved_at: new Date() });

  await Post.findByIdAndUpdate(postId, { $inc: { bookmark_count: 1 } });

  try {
    const key = `${SAVED_SET_PREFIX}${userId}`;
    await redis.sAdd(key, postId);
    await redis.expire(key, SAVED_TTL);
  } catch {
    // Redis is best-effort for bookmark sets
  }

  return { saved: true, already: false };
}

export async function removeBookmark(userId: string, postId: string): Promise<{ removed: boolean }> {
  const result = await SavedPost.findOneAndDelete({ user_id: userId, post_id: postId });
  if (!result) {
    return { removed: false };
  }

  await Post.findByIdAndUpdate(postId, { $inc: { bookmark_count: -1 } });

  try {
    await redis.sRem(`${SAVED_SET_PREFIX}${userId}`, postId);
  } catch {
    // Redis is best-effort for bookmark sets
  }

  return { removed: true };
}

export interface SavedPostWithPost {
  _id: string;
  user_id: string;
  post_id: string;
  saved_at: Date;
}

export interface GetSavedPostsResult {
  posts: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getSavedPosts(
  userId: string,
  page: number,
  limit: number
): Promise<GetSavedPostsResult> {
  const skip = (page - 1) * limit;

  const savedPosts = await SavedPost.find({ user_id: userId })
    .sort({ saved_at: -1 })
    .skip(skip)
    .limit(limit)
    .lean<SavedPostWithPost[]>();

  const total = await SavedPost.countDocuments({ user_id: userId });

  const postIds = savedPosts.map((sp) => sp.post_id);
  const posts = postIds.length > 0
    ? await Post.find({ _id: { $in: postIds } }).lean()
    : [];

  return {
    posts: posts as Record<string, unknown>[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function checkBookmark(userId: string, postId: string): Promise<boolean> {
  try {
    const key = `${SAVED_SET_PREFIX}${userId}`;
    const isMember = await redis.sIsMember(key, postId);
    if (isMember) {
      return true;
    }
  } catch {
    // Redis error — fall through to MongoDB fallback
  }

  const saved = await SavedPost.findOne({ user_id: userId, post_id: postId }).lean();
  return !!saved;
}
