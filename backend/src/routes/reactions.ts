import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Reaction } from '../models/Reaction';
import { Comment } from '../models/Comment';
import { grantBoost, BoostType } from '../lib/ladderSystem';
import { getThresholds, computeSparkScore, computeParentSparkScore } from '../lib/sparkScore';

const router: Router = Router();

const validateReaction = [
  body('target_type').isIn(['comment']).withMessage('Invalid target type'),
  body('target_id').isMongoId().withMessage('Invalid target ID'),
];

const getFingerprint = (req: Request): string | undefined => {
  const fp = req.user?.device_fingerprint || req.fingerprint;
  if (!fp || fp === 'unknown') return undefined;
  return fp;
};

// POST /api/reactions - Toggle fire reaction
router.post("/", ...validateReaction, async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { target_type, target_id } = req.body;
    const device_fingerprint = req.user?.device_fingerprint || req.fingerprint;
    if (!device_fingerprint || device_fingerprint === 'unknown') {
      return res.status(401).json({ error: 'Device identity required for reactions' });
    }

    // Only allow comments
    if (target_type !== 'comment') {
      return res.status(400).json({ error: 'Invalid target type - reactions are only allowed on comments' });
    }
    
    // Verify target exists and get current fire count
    const target = await Comment.findById(target_id);
    if (!target) {
      return res.status(404).json({ error: `${target_type} not found` });
    }

    // Atomic delete-first: prevents TOCTOU race via unique compound index
    const removed = await Reaction.findOneAndDelete({
      user_device_fingerprint: device_fingerprint,
      target_type,
      target_id,
    });

    let action: 'added' | 'removed';

    if (removed) {
      action = 'removed';
    } else {
      try {
        await Reaction.create({
          user_device_fingerprint: device_fingerprint,
          target_type,
          target_id,
          reaction_type: 'fire',
        });
        action = 'added';
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('duplicate key')) {
          return res.status(409).json({ error: 'Already reacted' });
        }
        throw err;
      }
    }

    // Atomically increment/decrement fire_count
    const now = new Date();
    const updated = await Comment.findByIdAndUpdate(target_id, {
      $inc: { fire_count: action === 'added' ? 1 : -1 },
      last_engaged_at: now,
    }, { new: true });

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const currentFireCount = updated.fire_count;
    
    // Grant boost if comment reaches exactly 3 fires
    if (currentFireCount === 3 && action === 'added') {
      const comment = await Comment.findById(target_id);
      if (comment) {
        await grantBoost(comment.author_id.toString(), BoostType.COMMENT_THREE_FIRES);
      }
    }
    
    // Calculate new spark score for this comment
    const comment = await Comment.findById(target_id);
    if (comment) {
      const thresholds = await getThresholds();
      const sparkScore = computeSparkScore(
        { fireCount: currentFireCount, replyCount: comment.reply_count, createdAt: comment.created_at },
        thresholds
      );

      await Comment.findByIdAndUpdate(target_id, { spark_score: sparkScore });

      // Propagate engagement to ancestors
      if (comment.parent_comment_id) {
        let currentParentId = comment.parent_comment_id.toString();
        const visited = new Set<string>();

        while (currentParentId && !visited.has(currentParentId)) {
          visited.add(currentParentId);

          const parent = await Comment.findById(currentParentId);
          if (!parent) break;

          const parentNow = new Date();
          const children = await Comment.find({ parent_comment_id: currentParentId });
          let childFires = 0;
          let childReplies = 0;
          for (const child of children) {
            childFires += child.fire_count || 0;
            childReplies += child.reply_count || 0;
          }

          const parentSparkScore = computeParentSparkScore(
            { fireCount: parent.fire_count, replyCount: parent.reply_count, createdAt: parent.created_at, childFires, childReplies },
            thresholds
          );

          await Comment.findByIdAndUpdate(currentParentId, {
            spark_score: parentSparkScore,
            last_engaged_at: parentNow
          });

          if (!parent.parent_comment_id) break;
          currentParentId = parent.parent_comment_id.toString();
        }
      }
    }

    res.json({
      success: true,
      action,
      target_type,
      target_id,
      fire_count: currentFireCount,
      user_reacted: action === 'added',
    });
  } catch (error) {
    console.error('Toggle reaction error:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// GET /api/reactions/state - Check reaction status for multiple targets
router.get('/state', async (req, res) => {
  try {
    const { targets } = req.query;
    const device_fingerprint = getFingerprint(req as any);

    if (!targets) {
      return res.status(400).json({ error: 'No targets provided' });
    }

    let parsedTargets: Array<{ type: string; id: string }>;
    try {
      parsedTargets = JSON.parse(targets as string);
    } catch {
      return res.status(400).json({ error: 'Invalid targets format' });
    }

    if (parsedTargets.length === 0) {
      return res.json({ targets: [] });
    }

    const targetIds = parsedTargets.map(t => new mongoose.Types.ObjectId(t.id));
    
    const userReactions = await Reaction.find({
      user_device_fingerprint: device_fingerprint,
      target_id: { $in: targetIds },
    });

    const reactedMap = new Map<string, boolean>();
    userReactions.forEach(r => {
      reactedMap.set(r.target_id.toString(), true);
    });

    const results = parsedTargets.map(t => ({
      type: t.type,
      id: t.id,
      user_reacted: reactedMap.has(t.id) || false,
    }));

    res.json({ targets: results });
  } catch (error) {
    console.error('Get reaction state error:', error);
    res.status(500).json({ error: 'Failed to get reaction state' });
  }
});

// GET /api/reactions/:targetType/:targetId - Get reaction count and user status
router.get('/:targetType/:targetId', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const device_fingerprint = getFingerprint(req as any);

    // Only allow comments
    if (targetType !== 'comment') {
      return res.status(400).json({ error: 'Invalid target type - reactions are only allowed on comments' });
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: 'Invalid target ID' });
    }

    // Get target and its fire count
    const target = await Comment.findById(targetId).select('fire_count');

    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }

    // Check if user has reacted
    const userReaction = await Reaction.findOne({
      user_device_fingerprint: device_fingerprint,
      target_type: targetType,
      target_id: targetId,
    });

    res.json({
      target_type: targetType,
      target_id: targetId,
      fire_count: target.fire_count || 0,
      user_reacted: !!userReaction,
    });
  } catch (error) {
    console.error('Get reaction error:', error);
    res.status(500).json({ error: 'Failed to get reaction' });
  }
});

export default router;