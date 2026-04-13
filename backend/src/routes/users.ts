import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { isUsernameAvailable, recordUsernameChange } from '../lib/usernameService';

const router: Router = Router();

/**
 * M11.A: GET /api/users/me
 * Returns current user context for authenticated fingerprint
 */
router.get('/me', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    // Count posts with status breakdown
    const userPosts = await Post.aggregate([
      { $match: { author_id: req.user.user_id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Count total comments
    const commentCount = await Comment.countDocuments({ author_id: req.user.user_id });

    // Process post counts
    const postCounts = userPosts.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const postsApproved = postCounts.approved || 0;
    const postsRejected = postCounts.rejected || 0;
    const postCount = postsApproved + postsRejected + (postCounts.pending_review || 0);

    // Determine trust level
    let trustLevel: 'troll' | 'neutral' | 'scholar';
    if (req.user.trust_score < 0.5) {
      trustLevel = 'troll';
    } else if (req.user.trust_score >= 1.8) {
      trustLevel = 'scholar';
    } else {
      trustLevel = 'neutral';
    }

    // Return full user context
    res.json({
      user_id: req.user.user_id,
      username: (req.user as any).custom_display_name || req.user.username,
      custom_display_name: (req.user as any).custom_display_name || null,
      trust_score: req.user.trust_score,
      trust_level: trustLevel,
      post_count: postCount,
      comment_count: commentCount,
      posts_approved: postsApproved,
      posts_rejected: postsRejected,
      created_at: (req.user as any).created_at,
      first_seen_at: (req.user as any).created_at,
    });

  } catch (error) {
    console.error('GET /users/me error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

/**
 * M11.B: PATCH /api/users/me
 * Update user display name
 */
const validateDisplayName = [
  body('display_name')
    .trim()
    .notEmpty()
    .withMessage('Display name is required')
    .isLength({ min: 3, max: 32 })
    .withMessage('Display name must be between 3 and 32 characters')
    .matches(/^[a-z0-9_]+$/i)
    .withMessage('Display name may only contain alphanumeric characters and underscores'),
];

router.patch('/me', validateDisplayName, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let displayName = req.body.display_name.trim().toLowerCase();

    // Enforce a_ prefix for non-scholar users
    if (req.user.trust_score < 1.8 && !displayName.startsWith('a_')) {
      displayName = `a_${displayName}`;
    }

    // Check availability
    const availability = await isUsernameAvailable(displayName, req.user.user_id);
    
    if (!availability.available) {
      return res.status(409).json({ error: 'Display name already taken' });
    }

    // Update user
    const currentUser = await User.findOne({ user_id: req.user.user_id });
    const oldUsername = currentUser?.custom_display_name || currentUser?.username || null;
    
    await User.findOneAndUpdate(
      { user_id: req.user.user_id },
      { custom_display_name: displayName }
    );
    
    // Record the change in history
    await recordUsernameChange(req.user.user_id, displayName, oldUsername);

    // Return updated user
    res.json({
      success: true,
      username: displayName,
      message: 'Display name updated successfully'
    });

  } catch (error) {
    console.error('PATCH /users/me error:', error);
    res.status(500).json({ error: 'Failed to update display name' });
  }
});

/**
 * M11.E: GET /api/users/:username
 * Public user profile endpoint
 */
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    console.log(`[USER PROFILE] Requested: ${username} - User from middleware: ${req.user ? req.user.username : 'NO USER'}`);
    
    // Find user by user_id (full or partial), username, or custom_display_name
    const cleanUsername = username.replace(/^a_/, '');
    
    console.log(`[USER PROFILE] Search variations: ${username}, ${cleanUsername}, a_${cleanUsername}`);
    
    let user = await User.findOne({ 
      $or: [
        { user_id: username },
        { user_id: { $regex: `^${username}` } },
        { user_id: cleanUsername },
        { user_id: { $regex: `^${cleanUsername}` } },
        { username },
        { username: `a_${cleanUsername}` },
        { custom_display_name: username },
        { custom_display_name: `a_${cleanUsername}` }
      ]
    });


    
    console.log(`[USER PROFILE] Query result: ${user ? 'FOUND' : 'NOT FOUND'} - ${user ? user.username : 'none'}`);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine trust level
    let trustLevel: 'troll' | 'neutral' | 'scholar';
    if (user.trust_score < 0.5) {
      trustLevel = 'troll';
    } else if (user.trust_score >= 1.8) {
      trustLevel = 'scholar';
    } else {
      trustLevel = 'neutral';
    }

    // Check if this is the user viewing their own profile
    const isOwnProfile = req.user && req.user.user_id === user.user_id;

    // Query posts with privacy rules
    const postQuery: any = { author_id: user.user_id };
    
    // Only show pending/rejected posts to user themselves
    if (!isOwnProfile) {
      postQuery.status = 'approved';
    }

    const userPosts = await Post.find(postQuery)
      .sort({ created_at: -1 })
      .select('title slug status post_type fire_count comment_count created_at category_id')
      .populate('category_id', 'name slug');

    // Count posts with status breakdown
    const postCounts = await Post.aggregate([
      { $match: { author_id: user.user_id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = postCounts.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const postsApproved = countMap.approved || 0;
    const postsRejected = countMap.rejected || 0;
    const postCount = postsApproved + postsRejected + (countMap.pending_review || 0);
    const approvalRate = postCount > 0 ? postsApproved / postCount : 0;

    // Get user comments
    const userComments = await Comment.find({ author_id: user.user_id })
      .sort({ created_at: -1 })
      .limit(100)
      .select('content post_id fire_count reply_count created_at');

    // Canonical URL logic - NO REDIRECTS
    const accessedUsername = req.params.username;
    const currentUsername = (user as any).custom_display_name || user.username;
    const cleanCurrentUsername = currentUsername.replace(/^a_/, '');
    
    // Return public profile data
    res.json({
      username: currentUsername,
      canonical_url: `/a/${cleanCurrentUsername}`,
      trust_score: isOwnProfile ? user.trust_score : undefined,
      trust_level: trustLevel,
      created_at: user.created_at,
      stats: {
        member_since: user.created_at,
        total_posts: isOwnProfile ? postCount : postsApproved,
        total_comments: userComments.length,
        approval_rate: Math.round(approvalRate * 100),
      },
      posts: userPosts.map((post: any) => ({
        id: post._id,
        title: post.title,
        slug: post.slug,
        status: isOwnProfile ? post.status : 'approved',
        post_type: post.post_type,
        comment_count: post.comment_count,
        created_at: post.created_at,
        category: post.category_id ? {
          name: post.category_id.name,
          slug: post.category_id.slug
        } : null,
      })),
      comments: userComments.map((comment: any) => ({
        id: comment._id,
        content: comment.content,
        post_id: comment.post_id,
        fire_count: comment.fire_count,
        reply_count: comment.reply_count,
        created_at: comment.created_at,
      })),
      is_own_profile: isOwnProfile,
    });

  } catch (error) {
    console.error('GET /users/:username error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

router.get('/', (req: Request, res: Response) => res.json({ message: 'Users endpoint' }));
router.put('/:id', (req: Request, res: Response) => res.json({ message: 'Update user' }));
router.delete('/:id', (req: Request, res: Response) => res.json({ message: 'Delete user' }));

/**
 * GET /api/users/me/history
 * Get username history for current user
 */
router.get('/me/history', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const { UsernameHistory } = await import('../models/UsernameHistory');
    const history = await UsernameHistory.find({ 
      user_id: req.user.user_id 
    }).sort({ created_at: -1 });

    res.json({ history });
  } catch (error) {
    console.error('GET /users/me/history error:', error);
    res.status(500).json({ error: 'Failed to fetch username history' });
  }
});

export default router;
