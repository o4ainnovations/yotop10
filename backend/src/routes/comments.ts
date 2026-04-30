import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Comment } from '../models/Comment';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { SparkThreshold } from '../models/SparkThreshold';
import { atomicCheckRateLimit } from '../lib/redis';
import { calculateEffectiveCommentLimit } from '../lib/rateLimit';
import { getActiveBoost, grantBoost, BoostType } from '../lib/ladderSystem';
import {
  getPercentileValue, getThresholds,
  computeSparkScore, computeParentSparkScore,
} from '../lib/sparkScore';

const router: Router = Router();

let cronInterval: NodeJS.Timeout | null = null;
let thresholdCronInterval: NodeJS.Timeout | null = null;

const updateSparkScore = async (commentId: string) => {
  const comment = await Comment.findById(commentId);
  if (!comment) return;

  const thresholds = await getThresholds();
  const sparkScore = computeSparkScore(
    { fireCount: comment.fire_count, replyCount: comment.reply_count, createdAt: comment.created_at },
    thresholds
  );

  await Comment.findByIdAndUpdate(commentId, { spark_score: sparkScore });
  return sparkScore;
};

const updateParentSparkScore = async (parentId: string) => {
  const now = new Date();
  const comment = await Comment.findById(parentId);
  if (!comment) return 0;

  const children = await Comment.find({ parent_comment_id: parentId });
  let childFires = 0;
  let childReplies = 0;
  for (const child of children) {
    childFires += child.fire_count || 0;
    childReplies += child.reply_count || 0;
  }

  const thresholds = await getThresholds();
  const sparkScore = computeParentSparkScore(
    { fireCount: comment.fire_count, replyCount: comment.reply_count, createdAt: comment.created_at, childFires, childReplies },
    thresholds
  );

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
        const thresholds = await getThresholds();
        const newScore = computeSparkScore(
          { fireCount: comment.fire_count, replyCount: comment.reply_count, createdAt: comment.created_at },
          thresholds
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



// Check rate limit for comments (20 per hour per fingerprint)
const checkCommentRateLimit = async (fingerprint: string, trustScore: number = 1.0, userId?: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
  try {
    const key = `rate_limit:comments:${fingerprint}`;
    const windowMs = 60 * 60 * 1000;

    let limit = calculateEffectiveCommentLimit(trustScore);

    if (userId) {
      const activeBoost = await getActiveBoost(userId);
      if (activeBoost) {
        limit += activeBoost.comments;
      }
    }

    const { allowed, remaining } = await atomicCheckRateLimit(key, windowMs, limit);
    const now = Date.now();

    return {
      allowed,
      remaining,
      resetTime: now + windowMs,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: false, remaining: 0, resetTime: Date.now() + 3600000 };
  }
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
    // Use fingerprint from middleware user context — never trust request body/header
    const deviceFingerprint = req.user?.device_fingerprint;
    if (!deviceFingerprint || deviceFingerprint === 'unknown') {
      return res.status(401).json({ error: 'Device identity required' });
    }

    // Resolve post - try both ObjectID and slug
    let postId: string | null = null;
    let post: { _id: { toString(): string }; author_id?: string } | null = null;
    
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
    const rateLimit = await checkCommentRateLimit(deviceFingerprint, effectiveTrustScore, req.user?.user_id);
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
    const thresholds = await getThresholds();
    const initialSparkScore = computeSparkScore(
      { fireCount: 0, replyCount: 0, createdAt: now },
      thresholds
    );

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
      const updatedParent = await Comment.findByIdAndUpdate(
        parent_comment_id,
        { $inc: { reply_count: 1 } },
        { new: true }
      );
      
      // Grant boost if parent comment reaches exactly 2 replies
      if (updatedParent && updatedParent.reply_count === 2) {
        await grantBoost(updatedParent.author_id.toString(), BoostType.COMMENT_TWO_REPLIES);
      }
      
      // Update parent with engagement pulse and weighted child calculation
      await updateParentSparkScore(parent_comment_id);
      // Propagate engagement to all ancestors
      await propagateEngagementToAncestors(comment._id.toString());
    }

    // Update post's comment_count
    await Post.findByIdAndUpdate(postId, { $inc: { comment_count: 1 } });

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
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Verify ownership via middleware context
    if (!req.user || comment.author_id !== req.user.user_id) {
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
    const deviceFingerprint = req.user?.device_fingerprint;
    if (!deviceFingerprint || deviceFingerprint === 'unknown') {
      return res.status(401).json({ error: 'Device identity required' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Verify ownership via middleware context
    if (!req.user || comment.author_id !== req.user.user_id) {
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

    // Recursively collect all descendant comment IDs
    const collectDescendantIds = async (parentId: string): Promise<string[]> => {
      const children = await Comment.find({ parent_comment_id: parentId }, '_id');
      const ids: string[] = [];
      for (const child of children) {
        const childId = child._id.toString();
        ids.push(childId);
        const grandChildren = await collectDescendantIds(childId);
        ids.push(...grandChildren);
      }
      return ids;
    };

    const descendantIds = await collectDescendantIds(commentId);

    // Delete all descendants
    if (descendantIds.length > 0) {
      await Comment.deleteMany({ _id: { $in: descendantIds } });
    }

    // Delete the comment itself
    await Comment.findByIdAndDelete(commentId);

    // Decrement post's comment_count by total removed (comment + all descendants)
    const totalRemoved = 1 + descendantIds.length;
    await Post.findByIdAndUpdate(comment.post_id, { $inc: { comment_count: -totalRemoved } });

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

export { router, updateSparkScore, startSparkScoreCron, startThresholdCron, stopSparkScoreCron };
export default router;
