import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Reaction } from '../models/Reaction';
import { Comment } from '../models/Comment';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { SparkThreshold, getFloorMultiplier } from '../models/SparkThreshold';

const router: Router = Router();

// Get thresholds helper
const getThresholds = async () => {
  const threshold = await SparkThreshold.findOne().sort({ calculated_at: -1 });
  if (threshold) return threshold;
  
  const defaultThreshold = new SparkThreshold({
    percentile_99: 50,
    percentile_95: 30,
    percentile_85: 15,
    percentile_70: 8,
    calculated_at: new Date(),
  });
  return defaultThreshold;
};

// Validation middleware
const validateReaction = [
  body('target_type').isIn(['post', 'list_item', 'comment']).withMessage('Invalid target type'),
  body('target_id').isMongoId().withMessage('Invalid target ID'),
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
    const device_fingerprint = req.user?.device_fingerprint || 'unknown';

    // Only allow comments
    if (target_type !== 'comment') {
      return res.status(400).json({ error: 'Invalid target type - reactions are only allowed on comments' });
    }
    
    // Verify target exists and get current fire count
    const target = await Comment.findById(target_id);
    const targetModel = 'Comment';

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
    await Comment.findByIdAndUpdate(target_id, { 
      fire_count: currentFireCount,
      last_engaged_at: now,
    });
    
    // Calculate new spark score for this comment
    const comment = await Comment.findById(target_id);
    if (comment) {
      // Calculate base score
      const baseScore = (comment.reply_count * 2.0) + (currentFireCount * 0.5) + 3;
      const ageInHours = (now.getTime() - comment.created_at.getTime()) / (1000 * 60 * 60);
      const denominator = comment.reply_count + currentFireCount + 1;
      const ratio = comment.reply_count / denominator;
      const gamma = Math.max(1.1, 2.0 - ratio);
      const currentDecayRank = baseScore / Math.pow(ageInHours + 1, gamma);
      
      // Apply floor
      const thresholds = await getThresholds();
      const floorMultiplier = getFloorMultiplier(baseScore, thresholds);
      const floorValue = baseScore * floorMultiplier;
      const sparkScore = Math.max(currentDecayRank, floorValue);
      
      await Comment.findByIdAndUpdate(target_id, { spark_score: sparkScore });
      
      // Propagate engagement to ancestors
      if (comment.parent_comment_id) {
        let currentParentId = comment.parent_comment_id.toString();
        const visited = new Set<string>();
        
        while (currentParentId && !visited.has(currentParentId)) {
          visited.add(currentParentId);
          
          // Update parent with engagement pulse
          const parent = await Comment.findById(currentParentId);
          if (!parent) break;
          
          const parentNow = new Date();
          const parentAgeInHours = (parentNow.getTime() - parent.created_at.getTime()) / (1000 * 60 * 60);
          
          // Get children's totals
          const children = await Comment.find({ parent_comment_id: currentParentId });
          let childFires = 0;
          let childReplies = 0;
          for (const child of children) {
            childFires += child.fire_count || 0;
            childReplies += child.reply_count || 0;
          }
          
          // Parent base + child contributions
          const parentBase = (parent.reply_count * 2.0) + (parent.fire_count * 0.5) + 3;
          const childContribution = (childFires * 0.25) + (childReplies * 1.0);
          const parentNumerator = parentBase + childContribution;
          
          const totalReplies = parent.reply_count + childReplies;
          const totalFires = parent.fire_count + childFires;
          const parentDenominator = totalReplies + totalFires + 1;
          const parentRatio = totalReplies / parentDenominator;
          const parentGamma = Math.max(1.1, 2.0 - parentRatio);
          
          const parentCurrentDecay = parentNumerator / Math.pow(parentAgeInHours + 1, parentGamma);
          
          // Apply floor to parent
          const parentFloorMultiplier = getFloorMultiplier(parentBase, thresholds);
          const parentFloorValue = parentBase * parentFloorMultiplier;
          const parentSparkScore = Math.max(parentCurrentDecay, parentFloorValue);
          
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