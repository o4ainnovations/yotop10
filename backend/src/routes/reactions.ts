import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Reaction } from '../models/Reaction';
import { Comment } from '../models/Comment';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';

const router: Router = Router();

// Validation middleware
const validateReaction = [
  body('target_type').isIn(['post', 'list_item', 'comment']).withMessage('Invalid target type'),
  body('target_id').isMongoId().withMessage('Invalid target ID'),
  body('device_fingerprint').notEmpty().withMessage('Device fingerprint is required'),
];

// Helper to get fingerprint from request
const getFingerprint = (req: Request): string => {
  return req.headers['x-device-fingerprint'] as string || req.body.device_fingerprint || 'unknown';
};

// POST /api/reactions - Toggle fire reaction
router.post('/', validateReaction, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { target_type, target_id } = req.body;
    const device_fingerprint = getFingerprint(req);

    // Verify target exists and get current fire count
    let target;
    let targetModel: 'Comment' | 'Post' | 'ListItem' = 'Comment';
    
    switch (target_type) {
      case 'comment':
        target = await Comment.findById(target_id);
        targetModel = 'Comment';
        break;
      case 'post':
        target = await Post.findById(target_id);
        targetModel = 'Post';
        break;
      case 'list_item':
        target = await ListItem.findById(target_id);
        targetModel = 'ListItem';
        break;
      default:
        return res.status(400).json({ error: 'Invalid target type' });
    }

    if (!target) {
      return res.status(404).json({ error: `${target_type} not found` });
    }

    // Check if user already reacted
    const existingReaction = await Reaction.findOne({
      user_device_fingerprint: device_fingerprint,
      target_type,
      target_id,
    });

    let action: 'added' | 'removed';
    let currentFireCount = target.fire_count || 0;

    if (existingReaction) {
      // Remove reaction (toggle off)
      await Reaction.findByIdAndDelete(existingReaction._id);
      currentFireCount = Math.max(0, currentFireCount - 1);
      action = 'removed';
    } else {
      // Add reaction (toggle on)
      await Reaction.create({
        user_device_fingerprint: device_fingerprint,
        target_type,
        target_id,
        reaction_type: 'fire',
      });
      currentFireCount += 1;
      action = 'added';
    }

    // Update fire_count on the target and recalculate spark_score for comments
    const now = new Date();
    switch (targetModel) {
      case 'Comment': {
        await Comment.findByIdAndUpdate(target_id, { 
          fire_count: currentFireCount,
          last_engaged_at: now,
        });
        // Recalculate spark score
        const comment = await Comment.findById(target_id);
        if (comment) {
          const ageInHours = (now.getTime() - comment.created_at.getTime()) / (1000 * 60 * 60);
          const denominator = comment.reply_count + currentFireCount + 1;
          const ratio = comment.reply_count / denominator;
          const gamma = Math.max(1.1, 2.0 - ratio);
          const numerator = (comment.reply_count * 2.0) + (currentFireCount * 0.5) + 3;
          const sparkScore = Math.max(0, numerator / Math.pow(ageInHours + 1, gamma));
          await Comment.findByIdAndUpdate(target_id, { spark_score: sparkScore });
        }
        break;
      }
      case 'Post':
        await Post.findByIdAndUpdate(target_id, { fire_count: currentFireCount });
        break;
      case 'ListItem':
        await ListItem.findByIdAndUpdate(target_id, { fire_count: currentFireCount });
        break;
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
router.get('/state', async (req: Request, res: Response) => {
  try {
    const { targets } = req.query;
    const device_fingerprint = getFingerprint(req);

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
router.get('/:targetType/:targetId', async (req: Request, res: Response) => {
  try {
    const { targetType, targetId } = req.params;
    const device_fingerprint = getFingerprint(req);

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