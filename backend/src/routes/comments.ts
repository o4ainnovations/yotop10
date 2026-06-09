/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Comment } from '../models/Comment';
import { Post } from '../models/Post';
import { SparkThreshold } from '../models/SparkThreshold';
import {
  getThresholds, computeSparkScore, computeParentSparkScore,
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
const BATCH_SIZE = parseInt(process.env.SPARK_SCORE_BATCH_SIZE || '500', 10);
const SPARK_WINDOW_HOURS = parseInt(process.env.SPARK_SCORE_WINDOW_HOURS || '72', 10);

const startSparkScoreCron = () => {
  if (cronInterval) return;

  const runOnce = async (): Promise<void> => {
    try {
      const cutoff = new Date(Date.now() - SPARK_WINDOW_HOURS * 60 * 60 * 1000);
      const thresholds = await getThresholds();

      // Find matching IDs first (lightweight)
      const commentIds = await Comment.find({
        created_at: { $gte: cutoff },
        spark_score: { $gt: 0.01 },
      }).select('_id').lean();

      if (commentIds.length === 0) return;

      let updated = 0;

      // Process in batches
      for (let offset = 0; offset < commentIds.length; offset += BATCH_SIZE) {
        const batchIds = commentIds.slice(offset, offset + BATCH_SIZE).map(c => c._id);

        const batchComments = await Comment.find({ _id: { $in: batchIds } })
          .select('fire_count reply_count created_at spark_score')
          .lean();

        const updates: Array<{ id: string; score: number }> = [];

        for (const comment of batchComments) {
          const newScore = computeSparkScore(
            { fireCount: comment.fire_count, replyCount: comment.reply_count, createdAt: comment.created_at },
            thresholds
          );
          if (newScore < 0.01 || Math.abs(newScore - (comment as any).spark_score) > 0.001) {
            updates.push({ id: comment._id.toString(), score: newScore });
          }
        }

        // Bulk update
        if (updates.length > 0) {
          await Promise.allSettled(
            updates.map(u => Comment.findByIdAndUpdate(u.id, { spark_score: u.score }))
          );
          updated += updates.length;
        }
      }

      if (updated > 0) {
        console.log(`[SparkEngine] Updated ${updated} comment scores (${commentIds.length} checked)`);
      }
    } catch (error) {
      console.error('[SparkEngine] Cron error:', error);
    }
  };

  // Run immediately on start
  runOnce();
  
  // Then every 20 minutes
  cronInterval = setInterval(runOnce, 20 * 60 * 1000);
  
  console.log(`[SparkEngine] Cron job started (every 20 minutes, batch size: ${BATCH_SIZE})`);
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

    // Count total comments in window first
    const totalComments = await Comment.countDocuments({
      created_at: { $gte: thirtyDaysAgo },
    });

    if (totalComments === 0) {
      console.log('[SparkEngine] No comments in last 30 days to calculate thresholds');
      return;
    }

    // Build percentile array via batched aggregation
    // Uses MongoDB $project + $sort + $group to compute base scores server-side
    const pipeline = [
      { $match: { created_at: { $gte: thirtyDaysAgo } } },
      {
        $project: {
          baseScore: {
            $add: [
              { $multiply: ['$reply_count', 2.0] },
              { $multiply: ['$fire_count', 0.5] },
              3,
            ],
          },
        },
      },
      { $sort: { baseScore: 1 as 1 | -1 } },
      {
        $group: {
          _id: null,
          scores: { $push: '$baseScore' },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await Comment.aggregate(pipeline).allowDiskUse(true);
    if (results.length === 0) return;

    const scores = results[0].scores as number[];
    const count = results[0].count as number;

    const getP = (pct: number): number => {
      const idx = Math.ceil((pct / 100) * count) - 1;
      return scores[Math.max(0, Math.min(idx, scores.length - 1))];
    };

    const percentile_99 = getP(99);
    const percentile_95 = getP(95);
    const percentile_85 = getP(85);
    const percentile_70 = getP(70);

    // Store thresholds
    await SparkThreshold.create({
      percentile_99,
      percentile_95,
      percentile_85,
      percentile_70,
      calculated_at: new Date(),
    });

    console.log(`[SparkEngine] Thresholds (${count} comments): 99th=${percentile_99.toFixed(2)}, 95th=${percentile_95.toFixed(2)}, 85th=${percentile_85.toFixed(2)}, 70th=${percentile_70.toFixed(2)}`);
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

const stopThresholdCron = () => {
  if (thresholdCronInterval) {
    clearInterval(thresholdCronInterval);
    thresholdCronInterval = null;
  }
};

// PATCH /api/comments/:id - Edit comment (within 2hr window)
router.patch('/:id', 
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
router.delete('/:id', async (req, res) => {
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
router.post('/:id/spark', async (req, res) => {
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

export { router, updateSparkScore, updateParentSparkScore, startSparkScoreCron, startThresholdCron, stopSparkScoreCron, stopThresholdCron };
export default router;
