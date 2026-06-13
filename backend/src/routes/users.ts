/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { Post } from '../models/Post';
import { Article } from '../models/Article';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { AdminMessage } from '../models/AdminMessage';
import { isUsernameAvailable, recordUsernameChange } from '../lib/usernameService';
import { calculateEffectivePostLimit, calculateEffectiveCommentLimit, RateLimitStatus, getRateLimitKey } from '../lib/rateLimit';
import { getCategoryNameMap } from '../lib/categoryCache';
import { checkAndPromoteUser } from '../lib/trustScore';
import { redis } from '../lib/redis';

const router: Router = Router();

/**
 * M11.A: GET /api/users/me
 * Returns current user context for authenticated fingerprint
 */
router.get('/me', async (req, res) => {
  if (!req.user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    // Check and promote/demote user based on age/activity
    await checkAndPromoteUser(req.user.user_id).catch(() => {});
    // Fetch user for profile_image_url
    const userDoc = await User.findOne({ user_id: req.user.user_id }).select('profile_image_url').lean();

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
    const postCounts = userPosts.reduce((acc: Record<string, number>, item: { _id: string; count: number }) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const postsApproved = postCounts.approved || 0;
    const postsRejected = postCounts.rejected || 0;
    const postCount = postsApproved + postsRejected + (postCounts.pending_review || 0);

    // Determine trust level (stored on user, computed with hysteresis)
    const trustLevel: 'troll' | 'neutral' | 'scholar' = (req.user as unknown as Record<string, unknown>).trust_level as 'troll' | 'neutral' | 'scholar' || 'neutral';

    // Return full user context
    res.json({
      user_id: req.user.user_id,
      username: req.user.custom_display_name || req.user.username,
      custom_display_name: req.user.custom_display_name || null,
      profile_image_url: userDoc?.profile_image_url || null,
      trust_score: req.user.trust_score,
      trust_level: trustLevel,
      post_count: postCount,
      comment_count: commentCount,
      posts_approved: postsApproved,
      posts_rejected: postsRejected,
      created_at: req.user.created_at,
      first_seen_at: req.user.created_at,
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

router.patch('/me', ...validateDisplayName as any[], async (req, res) => {
  if (!req.user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    // Profile image update (no display_name validation needed)
    if (req.body.profile_image_url && !req.body.display_name) {
      const updated = await User.findOneAndUpdate(
        { user_id: req.user.user_id },
        { profile_image_url: req.body.profile_image_url },
        { new: true }
      ).select('profile_image_url user_id').lean();
      if (!updated) return res.status(404).json({ error: 'User not found' });
      return res.json({ success: true, profile_image_url: updated.profile_image_url });
    }

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

    const oldUsername = req.user.custom_display_name || req.user.username || null;

    const updatedUser = await User.findOneAndUpdate(
      {
        user_id: req.user.user_id,
        $or: [
          { custom_display_name: oldUsername },
          { custom_display_name: { $exists: false }, username: oldUsername },
        ],
      },
      { custom_display_name: displayName },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(409).json({ error: 'Display name was changed by another request. Please try again.' });
    }

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
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Check and promote/demote user when viewing own profile
    if (req.user) {
      await checkAndPromoteUser(req.user.user_id).catch(() => {});
    }
    
    console.log(`[USER PROFILE] Requested: ${username} - User from middleware: ${req.user ? req.user.username : 'NO USER'}`);
    
    // Find user by user_id (full or partial), username, or custom_display_name
    const cleanUsername = username.replace(/^a_/, '');
    
    console.log(`[USER PROFILE] Search variations: ${username}, ${cleanUsername}, a_${cleanUsername}`);
    
    const user = await User.findOne({
      $or: [
        { user_id: username },
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

    // Determine trust level (stored on user, computed with hysteresis)
    const trustLevel: 'troll' | 'neutral' | 'scholar' = (user as unknown as Record<string, unknown>).trust_level as 'troll' | 'neutral' | 'scholar' || 'neutral';

    // Check if this is the user viewing their own profile
    const isOwnProfile = req.user && req.user.user_id === user.user_id;

    // Query posts with privacy rules
    const postQuery: Record<string, unknown> = { author_id: user.user_id };
    
    // Only show pending/rejected posts to user themselves
    if (!isOwnProfile) {
      postQuery.status = 'approved';
    }

    const userPosts = await Post.find(postQuery)
      .sort({ created_at: -1 })
      .select('title slug status post_type view_count comment_count created_at category_slug rejection_reason revision_guidance')
      .lean();

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

    const countMap = postCounts.reduce((acc: Record<string, number>, item: { _id: string; count: number }) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const postsApproved = countMap.approved || 0;
    const postsRejected = countMap.rejected || 0;
    const decidedCount = postsApproved + postsRejected;
    const postCount = decidedCount + (countMap.pending_review || 0);
    const approvalRate = decidedCount > 0 ? postsApproved / decidedCount : -1;

    const currentUsername = user.custom_display_name || user.username;
    const cleanCurrentUsername = currentUsername.replace(/^a_/, '');

    // Get user comments
    const userComments = await Comment.find({ author_id: user.user_id })
      .sort({ created_at: -1 })
      .limit(100)
      .select('content post_id fire_count reply_count created_at');

    // Aggregate total view_count across all posts and articles
    const [postViewAgg, articleViewAgg] = await Promise.all([
      Post.aggregate([
        { $match: { author_id: user.user_id } },
        { $group: { _id: null, total_views: { $sum: '$view_count' } } },
      ]),
      Article.aggregate([
        { $match: { author_id: user.user_id } },
        { $group: { _id: null, total_views: { $sum: '$view_count' } } },
      ]),
    ]);
    const totalViews = (postViewAgg[0]?.total_views || 0) + (articleViewAgg[0]?.total_views || 0);

    // Category name map for resolving post categories
    const catNameMap = await getCategoryNameMap();

    // Return public profile data
    res.json({
      username: currentUsername,
      canonical_url: `/a/${cleanCurrentUsername}`,
      profile_image_url: user.profile_image_url || null,
      trust_score: isOwnProfile ? user.trust_score : undefined,
      trust_level: trustLevel,
      created_at: user.created_at,
      stats: {
        member_since: user.created_at,
        total_posts: isOwnProfile ? postCount : postsApproved,
        total_comments: userComments.length,
        approval_rate: approvalRate >= 0 ? Math.round(approvalRate * 100) : null,
        total_views: totalViews,
        verified: postsApproved >= 3,
      },
      posts: userPosts.map((post: any) => ({
        id: post._id,
        title: post.title,
        slug: post.slug,
        status: isOwnProfile ? post.status : 'approved',
        post_type: post.post_type,
        view_count: post.view_count || 0,
        comment_count: post.comment_count,
        created_at: post.created_at,
        category: post.category_slug ? { slug: post.category_slug, name: catNameMap.get(post.category_slug) || null } : null,
        rejection_reason: isOwnProfile ? post.rejection_reason || undefined : undefined,
        revision_guidance: isOwnProfile ? post.revision_guidance || undefined : undefined,
      })),
      comments: userComments.map((comment) => ({
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

router.get('/', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.put('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.delete('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented' }));

/**
 * GET /api/users/me/history
 * Get username history for current user
 */
router.get('/me/history', async (req, res) => {
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

/**
 * GET /api/users/me/rate-limits
 * Get current user rate limit status
 */
router.get('/me/rate-limits', async (req, res) => {
  if (!req.user) {
    // Return 425 instead of 404 during initialization
    return res.status(425).json({ 
      error: 'User identity still initializing', 
      retry_after: 0.5 
    });
  }

  try {
    const windowMs = 60 * 60 * 1000;
    const now = Date.now();

    // Calculate total limits
    const theTrustLevel = (req.user as any).trust_level;
    let postLimit = calculateEffectivePostLimit(req.user.trust_score, undefined, theTrustLevel);
    let commentLimit = calculateEffectiveCommentLimit(req.user.trust_score, theTrustLevel);
    
    // Add active boost if available
    const { getActiveBoost } = await import('../lib/ladderSystem');
    const activeBoost = await getActiveBoost(req.user.user_id);
    if (activeBoost) {
      if (Number.isFinite(activeBoost.posts)) postLimit += activeBoost.posts;
      if (Number.isFinite(activeBoost.comments)) commentLimit += activeBoost.comments;
    }

    // Get current counts
    const postKey = getRateLimitKey('posts', req.user.device_fingerprint);
    const commentKey = getRateLimitKey('comments', req.user.device_fingerprint);

    const windowStart = now - windowMs;
    
    const [postEntries, commentEntries] = await Promise.all([
      redis.zRangeByScore(postKey, windowStart.toString(), now.toString()),
      redis.zRangeByScore(commentKey, windowStart.toString(), now.toString()),
    ]);

    // Add null safety for new users with zero history
    const postCount = (postEntries || []).length || 0;
    const commentCount = (commentEntries || []).length || 0;

    // Determine tier
    const tl = (req.user as any).trust_level;
    let currentTier: 'ghost' | 'newbie' | 'troll' | 'neutral' | 'scholar';
    if (tl === 'ghost' || tl === 'newbie') {
      currentTier = tl;
    } else if (req.user.trust_score < 0.5) {
      currentTier = 'troll';
    } else if (req.user.trust_score >= 1.8) {
      currentTier = 'scholar';
    } else {
      currentTier = 'neutral';
    }

    // Calculate reset times (next hour boundary)
    const nextHour = Math.ceil(now / windowMs) * windowMs;
    const resetInSeconds = Math.ceil((nextHour - now) / 1000);

    const result: RateLimitStatus & { server_time: number } = {
      trust_score: req.user.trust_score,
      current_tier: currentTier,
      server_time: now,
      limits: {
        posts: {
          total: postLimit,
          remaining: Math.max(0, postLimit - postCount),
          reset_in_seconds: resetInSeconds,
        },
        comments: {
          total: commentLimit,
          remaining: Math.max(0, commentLimit - commentCount),
          reset_in_seconds: resetInSeconds,
        },
        counter_lists: {
          total: 'Unlimited',
          remaining: 'Unlimited',
          reset_in_seconds: null,
        },
      },
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching rate limit status:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit status' });
  }
});

// GET /api/users/me/notifications — Get merged feed (system + admin messages)
// Query: ?unread=true returns only unread system notifications (for bell)
router.get('/me/notifications', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const uid = req.user.user_id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const unreadOnly = req.query.unread === 'true';
    const now = new Date();

    const sysQuery: Record<string, unknown> = { user_id: uid };
    if (unreadOnly) sysQuery.read = false;

    // Admin messages: exclude dismissed only for bell modal (?unread=true)
    const adminQuery: Record<string, unknown> = {
      $or: [
        { type: 'individual', recipient_id: uid, expires_at: { $gt: now } },
        { type: 'broadcast', dismissed_by: unreadOnly ? { $nin: [uid] } : { $exists: true }, expires_at: { $gt: now } },
      ],
    };

    const [sysNotifs, adminMsgs] = await Promise.all([
      Notification.find(sysQuery).sort({ created_at: -1 }).limit(limit).lean(),
      AdminMessage.find(adminQuery).sort({ created_at: -1 }).limit(20).lean(),
    ]);

    const unreadCount = await Notification.countDocuments({ user_id: uid, read: false });

    const adminItems = adminMsgs.map((m) => ({
      _id: m._id,
      type: 'admin_message' as const,
      title: m.title,
      body: m.body,
      priority: m.priority,
      created_by: m.created_by,
      message_type: m.type,
      dismissed: m.dismissed_by.includes(uid),
      read: false,
      created_at: m.created_at,
    }));

    const merged = [...sysNotifs.map((n: Record<string, unknown>) => ({ ...n, is_admin: false })), ...adminItems.map((a) => ({ ...a, is_admin: true }))]
      .sort((a, b) => new Date((b as any).created_at as string).getTime() - new Date((a as any).created_at as string).getTime())
      .slice(0, limit);

    res.json({ notifications: merged, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/users/me/notifications/unread-count — Quick badge count (system + admin messages)
router.get('/me/notifications/unread-count', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const uid = req.user.user_id;
    const now = new Date();
    let sysCount = 0;
    let msgCount = 0;

    try { sysCount = await Notification.countDocuments({ user_id: uid, read: false }); } catch (err) { console.error('[Notifications] Failed to count system notifications:', (err as Error).message); }

    try {
      msgCount = await AdminMessage.countDocuments({
        $or: [
          { type: 'individual', recipient_id: uid, expires_at: { $gt: now } },
          { type: 'broadcast', dismissed_by: { $nin: [uid] }, expires_at: { $gt: now } },
        ],
      });
    } catch (err) { console.error('[Notifications] Failed to count admin messages:', (err as Error).message); }

    res.json({ count: sysCount + msgCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// GET /api/users/me/notifications/:id — Single notification (must be after unread-count to avoid route collision)
router.get('/me/notifications/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const uid = req.user.user_id;
    let notification: Record<string, unknown> | null = null;

    const sysNotif = await Notification.findOne({ _id: req.params.id, user_id: uid }).lean();
    if (sysNotif) {
      notification = { ...sysNotif, is_admin: false };
    } else {
      const adminMsg = await AdminMessage.findOne({
        _id: req.params.id,
        $or: [
          { type: 'individual', recipient_id: uid },
          { type: 'broadcast' },
        ],
      }).lean();
      if (adminMsg) {
        const dismissed = adminMsg.dismissed_by.includes(uid);
        notification = {
          _id: adminMsg._id,
          type: 'admin_message',
          title: adminMsg.title,
          body: adminMsg.body,
          priority: adminMsg.priority,
          created_by: adminMsg.created_by,
          message_type: adminMsg.type,
          expires_at: adminMsg.expires_at,
          dismissed,
          read: false,
          is_admin: true,
          created_at: adminMsg.created_at,
        };
      }
    }

    if (!notification) return res.status(404).json({ code: 'NOT_FOUND', error: 'Notification not found' });
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PATCH /api/users/me/notifications/:id/read — Mark single notification as read
router.patch('/me/notifications/:id/read', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.user_id },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PATCH /api/users/me/notifications/read-all — Mark all as read (system + dismiss admin messages)
router.patch('/me/notifications/read-all', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const uid = req.user.user_id;
    await Notification.updateMany(
      { user_id: uid, read: false },
      { read: true }
    );
    await AdminMessage.updateMany(
      { type: 'broadcast', dismissed_by: { $nin: [uid] } },
      { $addToSet: { dismissed_by: uid } }
    );
    await AdminMessage.updateMany(
      { type: 'individual', recipient_id: uid, dismissed_by: { $nin: [uid] } },
      { $addToSet: { dismissed_by: uid } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Get merged feed: personal messages + active broadcasts not dismissed
router.get('/me/messages', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const userId = req.user.user_id;
    const now = new Date();

    const [personal, broadcasts] = await Promise.all([
      AdminMessage.find({
        type: 'individual',
        recipient_id: userId,
        expires_at: { $gt: now },
      }).sort({ created_at: -1 }).limit(50).lean(),
      AdminMessage.find({
        type: 'broadcast',
        dismissed_by: { $nin: [userId] },
        expires_at: { $gt: now },
      }).sort({ created_at: -1 }).limit(20).lean(),
    ]);

    const merged = [...personal, ...broadcasts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json({ messages: merged });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Dismiss a broadcast (add user to dismissed_by)
router.patch('/me/messages/:id/dismiss', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    await AdminMessage.findByIdAndUpdate(req.params.id, {
      $addToSet: { dismissed_by: req.user.user_id },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to dismiss message' });
  }
});

export default router;
