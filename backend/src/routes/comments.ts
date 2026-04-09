import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { SparkThreshold, getFloorMultiplier, FLOOR_MULTIPLIERS } from '../models/SparkThreshold';
import { createClient } from 'redis';

const router: Router = Router();

let cronInterval: NodeJS.Timeout | null = null;
let thresholdCronInterval: NodeJS.Timeout | null = null;

// Initialize Redis client for rate limiting
const getRedisClient = async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = createClient({ url: redisUrl });
  await client.connect();
  return client;
};

// Get current thresholds or defaults
const getThresholds = async () => {
  const threshold = await SparkThreshold.findOne().sort({ calculated_at: -1 });
  if (threshold) return threshold;
  
  // Return default thresholds if none exist
  const defaultThreshold = new SparkThreshold({
    percentile_99: 50,
    percentile_95: 30,
    percentile_85: 15,
    percentile_70: 8,
    calculated_at: new Date(),
  });
  return defaultThreshold;
};

// Calculate percentile from sorted array
const getPercentileValue = (sortedArr: number[], percentile: number): number => {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
};

// Calculate Spark Score for a comment
// Final_Rank = max(Current_Decay_Rank, Base_Score × f)
// Current_Decay_Rank = Base_Score / (Age_In_Hours + 1)^γ
// Base_Score = (Replies × 2.0) + (Fires × 0.5) + 3.0
// f = Floor Multiplier based on percentile rank
const calculateSparkScore = async (fireCount: number, replyCount: number, createdAt: Date, _lastEngagedAt: Date): Promise<number> => {
  const now = new Date();
  const ageInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  // Calculate base score
  const baseScore = (replyCount * 2.0) + (fireCount * 0.5) + 3;
  
  // Calculate gravity based on reply-to-fire ratio
  const denominator = replyCount + fireCount + 1;
  const ratio = replyCount / denominator;
  const gamma = Math.max(1.1, 2.0 - ratio);
  
  // Calculate current decay rank
  const currentDecayRank = baseScore / Math.pow(ageInHours + 1, gamma);
  
  // Get floor multiplier based on percentile
  const thresholds = await getThresholds();
  const floorMultiplier = getFloorMultiplier(baseScore, thresholds);
  const floorValue = baseScore * floorMultiplier;
  
  // Final rank is max of decay rank and floor
  const finalRank = Math.max(currentDecayRank, floorValue);
  
  return Math.max(0, finalRank);
};

// Calculate Spark Score for parent comment with weighted child contributions
// Final_Rank = max(Current_Decay_Rank, Base_Score × f)
// Total_Score = Parent_Base_Score + (SUM(All_Child_Fires) * 0.25) + (SUM(All_Child_Replies) * 1.0)
// Parent_Base_Score = (Parent_Replies * 2) + (Parent_Fires * 0.5) + 3
const calculateParentSparkScore = async (commentId: string): Promise<number> => {
  const comment = await Comment.findById(commentId);
  if (!comment) return 0;
  
  const now = new Date();
  const ageInHours = (now.getTime() - comment.created_at.getTime()) / (1000 * 60 * 60);
  
  // Get all direct children of this comment
  const children = await Comment.find({ parent_comment_id: commentId });
  
  // Sum up children's fires and replies
  let childFires = 0;
  let childReplies = 0;
  for (const child of children) {
    childFires += child.fire_count || 0;
    childReplies += child.reply_count || 0;
  }
  
  // Parent base score
  const parentBase = (comment.reply_count * 2.0) + (comment.fire_count * 0.5) + 3;
  
  // Weighted child contributions
  const childContribution = (childFires * 0.25) + (childReplies * 1.0);
  
  // Total numerator before decay
  const numerator = parentBase + childContribution;
  
  // Calculate gravity
  const totalReplies = comment.reply_count + childReplies;
  const totalFires = comment.fire_count + childFires;
  const denominator = totalReplies + totalFires + 1;
  const ratio = totalReplies / denominator;
  const gamma = Math.max(1.1, 2.0 - ratio);
  
  // Calculate current decay rank
  const currentDecayRank = numerator / Math.pow(ageInHours + 1, gamma);
  
  // Get floor multiplier based on base score
  const thresholds = await getThresholds();
  const floorMultiplier = getFloorMultiplier(parentBase, thresholds);
  const floorValue = parentBase * floorMultiplier;
  
  // Final rank is max of decay rank and floor
  const finalRank = Math.max(currentDecayRank, floorValue);
  
  return Math.max(0, finalRank);
};

// Update spark score for a comment
const updateSparkScore = async (commentId: string) => {
  const comment = await Comment.findById(commentId);
  if (!comment) return;
  
  const sparkScore = await calculateSparkScore(
    comment.fire_count,
    comment.reply_count,
    comment.created_at,
    comment.last_engaged_at
  );
  
  await Comment.findByIdAndUpdate(commentId, { spark_score: sparkScore });
  return sparkScore;
};

// Update parent's spark score with weighted child contributions and engagement pulse
const updateParentSparkScore = async (parentId: string) => {
  const now = new Date();
  const sparkScore = await calculateParentSparkScore(parentId);
  await Comment.findByIdAndUpdate(parentId, { 
    spark_score: sparkScore,
    last_engaged_at: now
  });
  return sparkScore;
};

// Propagate engagement pulse to all ancestors
const propagateEngagementToAncestors = async (commentId: string) => {
  const comment = await Comment.findById(commentId);
  if (!comment || !comment.parent_comment_id) return;
  
  let currentParentId = comment.parent_comment_id.toString();
  const visited = new Set<string>();
  
  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    await updateParentSparkScore(currentParentId);
    
    const parent = await Comment.findById(currentParentId);
    if (!parent || !parent.parent_comment_id) break;
    currentParentId = parent.parent_comment_id.toString();
  }
};

// Start cron job for time-decay updates
const startSparkScoreCron = () => {
  if (cronInterval) return;
  
  // Run every 20 minutes
  cronInterval = setInterval(async () => {
    try {
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      
      // Get comments from last 72 hours with spark_score > 0.01
      const comments = await Comment.find({
        created_at: { $gte: seventyTwoHoursAgo },
        spark_score: { $gt: 0.01 },
      });
      
      let updated = 0;
      for (const comment of comments) {
        const newScore = await calculateSparkScore(
          comment.fire_count,
          comment.reply_count,
          comment.created_at,
          comment.last_engaged_at
        );
        
        // Stop recalculating if score is very low and below floor
        if (newScore < 0.01) {
          await Comment.findByIdAndUpdate(comment._id, { spark_score: newScore });
          updated++;
        } else if (Math.abs(newScore - comment.spark_score) > 0.001) {
          await Comment.findByIdAndUpdate(comment._id, { spark_score: newScore });
          updated++;
        }
      }
      
      if (updated > 0) {
        console.log(`[SparkEngine] Updated ${updated} comment scores`);
      }
    } catch (error) {
      console.error('[SparkEngine] Cron error:', error);
    }
  }, 20 * 60 * 1000);
  
  console.log('[SparkEngine] Cron job started (every 20 minutes)');
};

// Stop cron job
const stopSparkScoreCron = () => {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[SparkEngine] Cron job stopped');
  }
  if (thresholdCronInterval) {
    clearInterval(thresholdCronInterval);
    thresholdCronInterval = null;
    console.log('[SparkEngine] Threshold cron job stopped');
  }
};

// Calculate and store percentile thresholds
const calculateThresholds = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Get all comments from last 30 days
    const comments = await Comment.find({
      created_at: { $gte: thirtyDaysAgo }
    });
    
    if (comments.length === 0) {
      console.log('[SparkEngine] No comments in last 30 days to calculate thresholds');
      return;
    }
    
    // Calculate base scores for all comments
    const baseScores: number[] = [];
    for (const comment of comments) {
      const baseScore = (comment.reply_count * 2.0) + (comment.fire_count * 0.5) + 3;
      baseScores.push(baseScore);
    }
    
    // Sort for percentile calculation
    const sortedScores = [...baseScores].sort((a, b) => a - b);
    
    // Calculate percentiles
    const percentile_99 = getPercentileValue(sortedScores, 99);
    const percentile_95 = getPercentileValue(sortedScores, 95);
    const percentile_85 = getPercentileValue(sortedScores, 85);
    const percentile_70 = getPercentileValue(sortedScores, 70);
    
    // Store thresholds
    await SparkThreshold.create({
      percentile_99,
      percentile_95,
      percentile_85,
      percentile_70,
      calculated_at: new Date(),
    });
    
    console.log(`[SparkEngine] Thresholds updated: 99th=${percentile_99.toFixed(2)}, 95th=${percentile_95.toFixed(2)}, 85th=${percentile_85.toFixed(2)}, 70th=${percentile_70.toFixed(2)}`);
  } catch (error) {
    console.error('[SparkEngine] Threshold calculation error:', error);
  }
};

// Start threshold calculation cron (every 6 hours)
const startThresholdCron = () => {
  if (thresholdCronInterval) return;
  
  // Run immediately on start
  calculateThresholds();
  
  // Then every 6 hours
  thresholdCronInterval = setInterval(calculateThresholds, 6 * 60 * 60 * 1000);
  console.log('[SparkEngine] Threshold cron started (every 6 hours)');
};



// Check rate limit for comments (50 per hour per fingerprint)
const checkCommentRateLimit = async (fingerprint: string, trustScore: number = 1.0): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
  try {
    const redis = await getRedisClient();
    const key = `rate_limit:comments:${fingerprint}`;
    const windowMs = 60 * 60 * 1000; // 1 hour
    const baseLimit = 50; // 50 comments per hour base
    const limit = Math.floor(baseLimit * trustScore);

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
    return { allowed: true, remaining: Math.floor(50 * trustScore), resetTime: Date.now() + 3600000 };
  }
};



// Start cron on module load
startSparkScoreCron();
startThresholdCron();

// Validation middleware
const validateComment = [
  body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 2000 }).withMessage('Content must be less than 2000 characters'),
  body('list_item_id').optional().isMongoId().withMessage('Invalid list item ID'),
  body('parent_comment_id').optional().isMongoId().withMessage('Invalid parent comment ID'),
];

// GET /api/posts/:id/comments - Get comments for a post
router.get('/posts/:id/comments', async (req: Request, res: Response) => {
  try {
    const idOrSlug = req.params.id;
    const { list_item_id } = req.query;

    // Resolve post - try both ObjectID and slug
    let postId: string | null = null;
    
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      const post = await Post.findOne({ _id: idOrSlug, status: 'approved' });
      if (post) postId = post._id.toString();
    }
    
    if (!postId) {
      const post = await Post.findOne({ slug: idOrSlug, status: 'approved' });
      if (post) postId = post._id.toString();
    }

    if (!postId) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Build query
    const query: Record<string, unknown> = { post_id: postId };
    if (list_item_id && mongoose.Types.ObjectId.isValid(list_item_id as string)) {
      query.list_item_id = list_item_id;
    }

    // Get root comments (depth 0), sorted by spark_score descending
    const comments = await Comment.find(query)
      .sort({ spark_score: -1, created_at: 1 })
      .lean();

    // Transform comments into nested structure
    const commentMap = new Map<string, Record<string, unknown>>();
    const rootComments: Record<string, unknown>[] = [];

    // First pass: create map and transform _id to id
    comments.forEach((comment: Record<string, unknown>) => {
      commentMap.set((comment._id as mongoose.Types.ObjectId).toString(), {
        ...comment,
        id: (comment._id as mongoose.Types.ObjectId).toString(),
        replies: [],
      });
    });

    // Second pass: build tree
    comments.forEach((comment: Record<string, unknown>) => {
      const commentWithReplies = commentMap.get((comment._id as mongoose.Types.ObjectId).toString());
      if (!commentWithReplies) return;
      
      if (comment.parent_comment_id) {
        const parent = commentMap.get((comment.parent_comment_id as mongoose.Types.ObjectId).toString());
        if (parent) {
          (parent.replies as unknown[]).push(commentWithReplies);
          (parent as Record<string, unknown>).reply_count = (parent.replies as unknown[]).length;
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

    const idOrSlug = req.params.id;
    const { content, list_item_id, parent_comment_id } = req.body;
    // Use fingerprint from middleware user context
    const deviceFingerprint = req.user?.device_fingerprint || 'unknown';

    // Resolve post - try both ObjectID and slug
    let postId: string | null = null;
    let post: any = null;
    
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findOne({ _id: idOrSlug, status: 'approved' });
      if (post) postId = post._id.toString();
    }
    
    if (!postId) {
      post = await Post.findOne({ slug: idOrSlug, status: 'approved' });
      if (post) postId = post._id.toString();
    }

    if (!postId || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Apply per-user rate limit override if set
    let effectiveTrustScore = req.user?.trust_score || 1.0;
    
    // Check for admin override
    if (req.user?.rate_limit_override?.comments_per_hour) {
      effectiveTrustScore = req.user.rate_limit_override.comments_per_hour / 50;
    }
    
    // Check rate limit with trust score multiplier
    const rateLimit = await checkCommentRateLimit(deviceFingerprint, effectiveTrustScore);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: 'You can only post 50 comments per hour',
        remaining: 0,
        resetTime: rateLimit.resetTime,
      });
    }

    // Use user from middleware context
    const user = req.user!;

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
      if (parentComment.depth >= 10) {
        return res.status(400).json({ error: 'Maximum reply depth is 10 levels' });
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

    const now = new Date();
    const initialSparkScore = await calculateSparkScore(0, 0, now, now);

    // Create comment
    const comment = await Comment.create({
      post_id: postId,
      list_item_id: list_item_id || undefined,
      parent_comment_id: parent_comment_id || undefined,
      depth,
      author_id: user.user_id,
      author_username: user.username,
      author_display_name: user.username,
      content,
      fire_count: 0,
      reply_count: 0,
      spark_score: initialSparkScore,
      last_engaged_at: now,
    });

    // Update parent's reply_count, last_engaged_at, and spark_score with weighted children
    if (parent_comment_id) {
      await Comment.findByIdAndUpdate(
        parent_comment_id,
        { $inc: { reply_count: 1 } }
      );
      // Update parent with engagement pulse and weighted child calculation
      await updateParentSparkScore(parent_comment_id);
      // Propagate engagement to all ancestors
      await propagateEngagementToAncestors(comment._id.toString());
    }

    // Update post's comment_count
    await Post.findByIdAndUpdate(postId, { $inc: { comment_count: 1 } });

    // Increment rate limit counter
    try {
      const redis = await getRedisClient();
      const key = `rate_limit:comments:${deviceFingerprint}`;
      const current = await redis.get(key);
      const currentTime = Date.now();
      let count = 1;
      let windowStart = currentTime;

      if (current) {
        const data = JSON.parse(current);
        if (currentTime - data.windowStart < 3600000) {
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

    // Update parent's reply_count and spark_score if this is a reply
    if (comment.parent_comment_id) {
      await Comment.findByIdAndUpdate(
        comment.parent_comment_id,
        { $inc: { reply_count: -1 } }
      );
      await updateParentSparkScore(comment.parent_comment_id.toString());
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

// POST /api/comments/:id/spark - Recalculate spark score for a comment
router.post('/comments/:id/spark', async (req: Request, res: Response) => {
  try {
    const commentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const sparkScore = await updateSparkScore(commentId);

    res.json({ spark_score: sparkScore });
  } catch (error) {
    console.error('Update spark score error:', error);
    res.status(500).json({ error: 'Failed to update spark score' });
  }
});

export { router, updateSparkScore, startSparkScoreCron, stopSparkScoreCron };
export default router;
