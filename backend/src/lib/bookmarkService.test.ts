import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSavedPostFindOne = vi.fn();
const mockSavedPostCreate = vi.fn();
const mockSavedPostFindOneAndDelete = vi.fn();
const mockSavedPostFind = vi.fn();
const mockSavedPostCountDocuments = vi.fn();

const mockPostFindByIdAndUpdate = vi.fn();
const mockPostFind = vi.fn();

const mockRedisSAdd = vi.fn();
const mockRedisSRem = vi.fn();
const mockRedisSIsMember = vi.fn();
const mockRedisExpire = vi.fn();

vi.mock('../models/SavedPost', () => ({
  SavedPost: {
    findOne: (...args: unknown[]) => mockSavedPostFindOne(...args),
    create: (...args: unknown[]) => mockSavedPostCreate(...args),
    findOneAndDelete: (...args: unknown[]) => mockSavedPostFindOneAndDelete(...args),
    find: (...args: unknown[]) => mockSavedPostFind(...args),
    countDocuments: (...args: unknown[]) => mockSavedPostCountDocuments(...args),
  },
}));

vi.mock('../models/Post', () => ({
  Post: {
    findByIdAndUpdate: (...args: unknown[]) => mockPostFindByIdAndUpdate(...args),
    find: (...args: unknown[]) => mockPostFind(...args),
  },
}));

vi.mock('../lib/redis', () => ({
  redis: {
    sAdd: (...args: unknown[]) => mockRedisSAdd(...args),
    sRem: (...args: unknown[]) => mockRedisSRem(...args),
    sIsMember: (...args: unknown[]) => mockRedisSIsMember(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
  },
}));

import {
  saveBookmark,
  removeBookmark,
  getSavedPosts,
  checkBookmark,
} from '../lib/bookmarkService';

describe('saveBookmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates SavedPost, increments Post.bookmark_count, and adds to Redis', async () => {
    mockSavedPostFindOne.mockResolvedValue(null);
    mockSavedPostCreate.mockResolvedValue({ _id: 'sp1', user_id: 'user1', post_id: 'post1' });
    mockPostFindByIdAndUpdate.mockResolvedValue({ _id: 'post1' });
    mockRedisSAdd.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);

    const result = await saveBookmark('user1', 'post1');

    expect(result).toEqual({ saved: true, already: false });
    expect(mockSavedPostFindOne).toHaveBeenCalledWith({ user_id: 'user1', post_id: 'post1' });
    expect(mockSavedPostCreate).toHaveBeenCalledTimes(1);
    expect(mockPostFindByIdAndUpdate).toHaveBeenCalledWith('post1', { $inc: { bookmark_count: 1 } });
    expect(mockRedisSAdd).toHaveBeenCalledWith('bookmarks:user:user1', 'post1');
    expect(mockRedisExpire).toHaveBeenCalledWith('bookmarks:user:user1', 3600);
  });

  it('returns already=true on duplicate, no new DB entry created', async () => {
    mockSavedPostFindOne.mockResolvedValue({ _id: 'existing', user_id: 'user1', post_id: 'post1' });

    const result = await saveBookmark('user1', 'post1');

    expect(result).toEqual({ saved: false, already: true });
    expect(mockSavedPostCreate).not.toHaveBeenCalled();
    expect(mockPostFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('still succeeds if Redis sAdd fails', async () => {
    mockSavedPostFindOne.mockResolvedValue(null);
    mockSavedPostCreate.mockResolvedValue({ _id: 'sp1' });
    mockPostFindByIdAndUpdate.mockResolvedValue({ _id: 'post1' });
    mockRedisSAdd.mockRejectedValue(new Error('Redis connection refused'));

    const result = await saveBookmark('user1', 'post1');

    expect(result).toEqual({ saved: true, already: false });
    expect(mockSavedPostCreate).toHaveBeenCalledTimes(1);
    expect(mockPostFindByIdAndUpdate).toHaveBeenCalledWith('post1', { $inc: { bookmark_count: 1 } });
  });
});

describe('removeBookmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes SavedPost, decrements Post.bookmark_count, removes from Redis', async () => {
    mockSavedPostFindOneAndDelete.mockResolvedValue({ _id: 'sp1', user_id: 'user1', post_id: 'post1' });
    mockPostFindByIdAndUpdate.mockResolvedValue({ _id: 'post1' });
    mockRedisSRem.mockResolvedValue(1);

    const result = await removeBookmark('user1', 'post1');

    expect(result).toEqual({ removed: true });
    expect(mockSavedPostFindOneAndDelete).toHaveBeenCalledWith({ user_id: 'user1', post_id: 'post1' });
    expect(mockPostFindByIdAndUpdate).toHaveBeenCalledWith('post1', { $inc: { bookmark_count: -1 } });
    expect(mockRedisSRem).toHaveBeenCalledWith('bookmarks:user:user1', 'post1');
  });

  it('returns removed=false when SavedPost does not exist', async () => {
    mockSavedPostFindOneAndDelete.mockResolvedValue(null);

    const result = await removeBookmark('user1', 'post1');

    expect(result).toEqual({ removed: false });
    expect(mockPostFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('still succeeds if Redis sRem fails', async () => {
    mockSavedPostFindOneAndDelete.mockResolvedValue({ _id: 'sp1' });
    mockPostFindByIdAndUpdate.mockResolvedValue({ _id: 'post1' });
    mockRedisSRem.mockRejectedValue(new Error('Redis connection refused'));

    const result = await removeBookmark('user1', 'post1');

    expect(result).toEqual({ removed: true });
  });
});

describe('getSavedPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated saved posts sorted by saved_at desc', async () => {
    mockSavedPostFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: 'sp2', user_id: 'user1', post_id: 'post2', saved_at: new Date('2026-01-02') },
        { _id: 'sp1', user_id: 'user1', post_id: 'post1', saved_at: new Date('2026-01-01') },
      ]),
    });
    mockSavedPostCountDocuments.mockResolvedValue(5);
    mockPostFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: 'post2', title: 'Post 2' },
        { _id: 'post1', title: 'Post 1' },
      ]),
    });

    const result = await getSavedPosts('user1', 1, 2);

    expect(result.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0]).toEqual({ _id: 'post2', title: 'Post 2' });
  });

  it('passes correct sort, skip, and limit to query', async () => {
    const sortFn = vi.fn().mockReturnThis();
    const skipFn = vi.fn().mockReturnThis();
    const limitFn = vi.fn().mockReturnThis();
    mockSavedPostFind.mockReturnValue({
      sort: sortFn,
      skip: skipFn,
      limit: limitFn,
      lean: vi.fn().mockResolvedValue([]),
    });
    mockSavedPostCountDocuments.mockResolvedValue(0);

    await getSavedPosts('user1', 3, 10);

    expect(mockSavedPostFind).toHaveBeenCalledWith({ user_id: 'user1' });
    expect(sortFn).toHaveBeenCalledWith({ saved_at: -1 });
    expect(skipFn).toHaveBeenCalledWith(20);
    expect(limitFn).toHaveBeenCalledWith(10);
  });

  it('returns empty posts array when no saved posts exist', async () => {
    mockSavedPostFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    mockSavedPostCountDocuments.mockResolvedValue(0);

    const result = await getSavedPosts('user1', 1, 20);

    expect(result.posts).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });
});

describe('checkBookmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true on Redis hit', async () => {
    mockRedisSIsMember.mockResolvedValue(true);

    const result = await checkBookmark('user1', 'post1');

    expect(result).toBe(true);
    expect(mockRedisSIsMember).toHaveBeenCalledWith('bookmarks:user:user1', 'post1');
    expect(mockSavedPostFindOne).not.toHaveBeenCalled();
  });

  it('falls back to MongoDB on Redis miss and returns true if found in DB', async () => {
    mockRedisSIsMember.mockResolvedValue(false);
    mockSavedPostFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'sp1', user_id: 'user1', post_id: 'post1' }),
    });

    const result = await checkBookmark('user1', 'post1');

    expect(result).toBe(true);
    expect(mockRedisSIsMember).toHaveBeenCalledWith('bookmarks:user:user1', 'post1');
    expect(mockSavedPostFindOne).toHaveBeenCalledWith({ user_id: 'user1', post_id: 'post1' });
  });

  it('returns false when not bookmarked (Redis miss + DB miss)', async () => {
    mockRedisSIsMember.mockResolvedValue(false);
    mockSavedPostFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await checkBookmark('user1', 'post1');

    expect(result).toBe(false);
  });

  it('falls back to MongoDB when Redis throws an error', async () => {
    mockRedisSIsMember.mockRejectedValue(new Error('Redis connection refused'));
    mockSavedPostFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'sp1', user_id: 'user1', post_id: 'post1' }),
    });

    const result = await checkBookmark('user1', 'post1');

    expect(result).toBe(true);
    expect(mockSavedPostFindOne).toHaveBeenCalledWith({ user_id: 'user1', post_id: 'post1' });
  });

  it('returns false when Redis errors and DB also has no record', async () => {
    mockRedisSIsMember.mockRejectedValue(new Error('Redis connection refused'));
    mockSavedPostFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await checkBookmark('user1', 'post1');

    expect(result).toBe(false);
  });

  it('handles empty userId gracefully by checking DB only', async () => {
    mockRedisSIsMember.mockResolvedValue(false);
    mockSavedPostFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await checkBookmark('', 'post1');

    expect(result).toBe(false);
    expect(mockSavedPostFindOne).toHaveBeenCalledWith({ user_id: '', post_id: 'post1' });
  });

  it('handles invalid post_id gracefully', async () => {
    mockRedisSIsMember.mockResolvedValue(false);
    mockSavedPostFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await checkBookmark('user1', '');

    expect(result).toBe(false);
  });
});
