import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { createClient } from 'redis';

const router: Router = Router();

// Initialize Redis client for rate limiting
const getRedisClient = async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = createClient({ url: redisUrl });
  await client.connect();
  return client;
};

// Generate unique random username (fully anonymous)
const generateRandomUsername = async (): Promise<string> => {
  let isUnique = false;
  let username = '';
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    const randomPart = crypto.randomBytes(2).toString('hex');
    username = `any_${randomPart}`;
    
    const existingUser = await User.findOne({ username });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    const counter = Date.now() % 10000;
    username = `any_${crypto.randomBytes(2).toString('hex')}${counter}`;
  }

  return username;
};

// Generate unique user ID
const generateUserId = (): string => {
  return crypto.randomBytes(4).toString('hex');
};

// Check rate limit for comments (50 per hour per fingerprint)
const checkCommentRateLimit = async (fingerprint: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
  try {
    const redis = await getRedisClient();
    const key = `rate_limit:comments:${fingerprint}`;
    const windowMs = 60 * 60 * 1000; // 1 hour
    const limit = 50; // 50 comments per hour

    const current = await redis.get(key);
    const now = Date.now();
    let count = 0;
    let windowStart = now;

    if (current) {
      const data = JSON.parse(current);
      if (now - data.windowStart < windowMs) {
        count = data.count;
        windowStart = data.windowStart;
      }
    }

    const remaining = Math.max(0, limit - count);
    const resetTime = windowStart + windowMs;

    return {
      allowed: count < limit,
      remaining,
      resetTime,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: 50, resetTime: Date.now() + 3600000 };
  }
};

// Get or create anonymous user by device fingerprint
const getOrCreateUser = async (deviceFingerprint: string): Promise<{ user_id: string; username: string; display_name: string }> => {
  let user = await User.findOne({ device_fingerprint: deviceFingerprint });
  
  if (!user) {
    const username = await generateRandomUsername();
    user = await User.create({
      user_id: generateUserId(),
      username,
      device_fingerprint: deviceFingerprint,
      is_admin: false,
    });
  }

  return {
    user_id: user.user_id,
    username: user.username,
    display_name: user.custom_display_name || user.username,
  };
};

// Validation middleware
const validateComment = [
  body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 2000 }).withMessage('Content must be less than 2000 characters'),
  body('list_item_id').optional().isMongoId().withMessage('Invalid list item ID'),
  body('parent_comment_id').optional().isMongoId().withMessage('Invalid parent comment ID'),
];

// GET /api/posts/:id/comments - Get comments for a post
router.get('/posts/:id/comments', async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const { list_item_id } = req.query;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    // Build query
    const query: any = { post_id: postId };
    if (list_item_id && mongoose.Types.ObjectId.isValid(list_item_id as string)) {
      query.list_item_id = list_item_id;
    }

    // Get comments, sorted by creation date
    const comments = await Comment.find(query)
      .sort({ created_at: 1 })
      .lean();

    // Transform comments into nested structure
    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];

    // First pass: create map and transform _id to id
    comments.forEach((comment: any) => {
      commentMap.set(comment._id.toString(), {
        ...comment,
        id: comment._id.toString(),
        replies: [],
      });
    });

    // Second pass: build tree
    comments.forEach((comment: any) => {
      const commentWithReplies = commentMap.get(comment._id.toString());
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id.toString());
        if (parent) {
          parent.replies.push(commentWithReplies);
          parent.reply_count = parent.replies.length;
        } else {
          rootComments.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    res.json({ comments: rootComments, total: comments.length });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/posts/:id/comments - Add comment (anonymous)
router.post('/posts/:id/comments', validateComment, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const postId = req.params.id;
    const { content, list_item_id, parent_comment_id } = req.body;
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string || req.body.device_fingerprint || 'unknown';

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check rate limit
    const rateLimit = await checkCommentRateLimit(deviceFingerprint);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: 'You can only post 50 comments per hour',
        remaining: 0,
        resetTime: rateLimit.resetTime,
      });
    }

    // Get or create user
    const user = await getOrCreateUser(deviceFingerprint);

    // Determine depth
    let depth = 0;
    if (parent_comment_id) {
      if (!mongoose.Types.ObjectId.isValid(parent_comment_id)) {
        return res.status(400).json({ error: 'Invalid parent comment ID' });
      }
      const parentComment = await Comment.findById(parent_comment_id);
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      if (parentComment.depth >= 3) {
        return res.status(400).json({ error: 'Maximum reply depth is 3 levels' });
      }
      depth = parentComment.depth + 1;
    }

    // If list_item_id provided, verify it exists and belongs to post
    if (list_item_id) {
      if (!mongoose.Types.ObjectId.isValid(list_item_id)) {
        return res.status(400).json({ error: 'Invalid list item ID' });
      }
      const listItem = await ListItem.findById(list_item_id);
      if (!listItem || listItem.post_id.toString() !== postId) {
        return res.status(400).json({ error: 'List item not found or does not belong to this post' });
      }
    }

    // Create comment
    const comment = await Comment.create({
      post_id: postId,
      list_item_id: list_item_id || undefined,
      parent_comment_id: parent_comment_id || undefined,
      depth,
      author_id: user.user_id,
      author_username: user.username,
      author_display_name: user.display_name,
      content,
      fire_count: 0,
      reply_count: 0,
    });

    // Update parent's reply_count if this is a reply
    if (parent_comment_id) {
      await Comment.findByIdAndUpdate(parent_comment_id, { $inc: { reply_count: 1 } });
    }

    // Update post's comment_count
    await Post.findByIdAndUpdate(postId, { $inc: { comment_count: 1 } });

    // Increment rate limit counter
    try {
      const redis = await getRedisClient();
      const key = `rate_limit:comments:${deviceFingerprint}`;
      const current = await redis.get(key);
      const now = Date.now();
      let count = 1;
      let windowStart = now;

      if (current) {
        const data = JSON.parse(current);
        if (now - data.windowStart < 3600000) {
          count = data.count + 1;
          windowStart = data.windowStart;
        }
      }

      await redis.set(key, JSON.stringify({ count, windowStart }), { EX: 3600 });
    } catch (redisError) {
      console.error('Redis error:', redisError);
    }

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PATCH /api/comments/:id - Edit comment (within 2hr window)
router.patch('/comments/:id', 
  body('content').trim().notEmpty().isLength({ max: 2000 }),
  async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const commentId = req.params.id;
    const { content, device_fingerprint } = req.body;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Verify ownership via device fingerprint
    const user = await User.findOne({ device_fingerprint: device_fingerprint || 'unknown' });
    if (!user || comment.author_id !== user.user_id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    // Check 2-hour edit window
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const timeSinceCreation = Date.now() - comment.created_at.getTime();
    if (timeSinceCreation > twoHoursMs) {
      return res.status(403).json({ error: 'Comments can only be edited within 2 hours of posting' });
    }

    // Update comment
    comment.content = content;
    await comment.save();

    res.json({ comment });
  } catch (error) {
    console.error('Edit comment error:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// DELETE /api/comments/:id - Delete own comment
router.delete('/comments/:id', async (req: Request, res: Response) => {
  try {
    const commentId = req.params.id;
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string || req.body.device_fingerprint || 'unknown';

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Verify ownership
    const user = await User.findOne({ device_fingerprint: deviceFingerprint });
    if (!user || comment.author_id !== user.user_id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // Update parent's reply_count if this is a reply
    if (comment.parent_comment_id) {
      await Comment.findByIdAndUpdate(comment.parent_comment_id, { $inc: { reply_count: -1 } });
    }

    // Update post's comment_count
    await Post.findByIdAndUpdate(comment.post_id, { $inc: { comment_count: -1 } });

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);

    // Also delete all replies to this comment
    await Comment.deleteMany({ parent_comment_id: commentId });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;