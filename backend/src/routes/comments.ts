import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Comment } from '../models/Comment';
import { Post } from '../models/Post';
import { SparkThreshold } from '../models/SparkThreshold';
import {
  getPercentileValue, getThresholds,
  computeSparkScore, computeParentSparkScore,
} from '../lib/sparkScore';
import { indexComment, removeComment } from '../elasticsearch/lib/indexWriter';

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

// PATCH /api/comments/:id - Edit comment (within 2hr window)
router.patch('/comments/:id', 
  body('content').trim().notEmpty().isLength({ max: 2000 }),
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const commentId = req.params?.id;
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

    indexComment(comment as unknown as Record<string, unknown>);

    res.json({ comment });
  } catch (error) {
    console.error('Edit comment error:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// DELETE /api/comments/:id - Delete own comment
router.delete('/comments/:id', async (req, res) => {
  try {
    const commentId = req.params?.id;
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
        const childId = (child._id as { toString(): string }).toString();
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

    // Remove from ES
    removeComment(commentId);
    for (const id of descendantIds) removeComment(id);

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
router.post('/comments/:id/spark', async (req, res) => {
  try {
    const commentId = req.params?.id;

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

export { router, updateSparkScore, updateParentSparkScore, startSparkScoreCron, startThresholdCron, stopSparkScoreCron };
export default router;
