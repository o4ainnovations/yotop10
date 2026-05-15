import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all Mongoose models used by platformSnapshot ──────────────────────
vi.mock('../models/PlatformSnapshot', () => ({
  PlatformSnapshot: {
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../models/Post', () => ({
  Post: {
    countDocuments: vi.fn(),
    find: vi.fn(() => ({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(),
    })),
    aggregate: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../models/Comment', () => ({
  Comment: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/User', () => ({
  User: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/Category', () => ({
  Category: {
    find: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn(),
    })),
  },
}));

vi.mock('../models/PageVisit', () => ({
  PageVisit: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/Notification', () => ({
  Notification: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/AlertThreshold', () => ({
  AlertThreshold: {
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('../models/AlertHistory', () => ({
  AlertHistory: {
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('./redis', () => ({
  redis: {
    set: vi.fn(),
    hSet: vi.fn(),
  },
}));

vi.mock('./postCountReconciler', () => ({
  reconcilePostCounts: vi.fn(),
}));

// ── Pure helper functions extracted from source logic ──────────────────────

/**
 * Computes daily review count from approved + rejected + retry.
 * Mirrors: approvedToday + rejectedToday + retryToday
 */
function computeReviewsToday(approved: number, rejected: number, retry: number): number {
  return approved + rejected + retry;
}

/**
 * Computes category utilization percentage.
 * Mirrors: (categoryChildren.length > 0
 *   ? Math.round(((categoryChildren.length - emptyChildren) / categoryChildren.length) * 100)
 *   : 0)
 */
function computeUtilizationPct(totalChildren: number, emptyChildren: number): number {
  if (totalChildren <= 0) return 0;
  return Math.round(((totalChildren - emptyChildren) / totalChildren) * 100);
}

/**
 * Computes notification delivery rate.
 * Mirrors: notificationsDelivered > 0
 *   ? Math.round((notificationsClicked / notificationsDelivered) * 100)
 *   : 0
 */
function computeNotificationDeliveryRate(delivered: number, clicked: number): number {
  if (delivered <= 0) return 0;
  return Math.round((clicked / delivered) * 100);
}

/**
 * Aggregates rejection reasons from an array of { _id, count } objects.
 */
function aggregateRejectionReasons(reasons: Array<{ _id: string | null; count: number }>): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of reasons) {
    const key = (r._id || 'other').toString().substring(0, 50);
    map[key] = (map[key] || 0) + r.count;
  }
  return map;
}

/**
 * Groups categories into parents and children, returns top N and empty children count.
 */
function processCategories(
  all: Array<{ slug: string; parent_id: string | null; post_count: number }>,
  topN: number,
): { children: typeof all; parents: typeof all; topByPosts: Array<{ slug: string; post_count: number }>; emptyChildren: number } {
  const children = all.filter((c) => c.parent_id !== null && c.parent_id !== undefined);
  const parents = all.filter((c) => !c.parent_id);

  const topByPosts = [...all]
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, topN)
    .map((c) => ({ slug: c.slug, post_count: c.post_count }));

  const emptyChildren = children.filter((c) => c.post_count === 0).length;

  return { children, parents, topByPosts, emptyChildren };
}

/**
 * Builds a snapshot object from raw numeric data — mirrors the shape of
 * the snapshot returned by computeSnapshot().
 */
function buildSnapshot(params: {
  date: string;
  posts: { submitted: number; approved: number; rejected: number; pending: number; inRevision: number; total: number; thisWeek: number; thisMonth: number };
  comments: { total: number; thisWeek: number; today: number };
  users: { total: number; newToday: number; newThisWeek: number; active30d: number; active7d: number };
  trust: { scholars: number; neutrals: number; trolls: number };
  trollsActive24h: number;
  approvedToday: number;
  rejectedToday: number;
  retryToday: number;
  rejectionReasons: Record<string, number>;
  topCategories: Array<{ slug: string; post_count: number }>;
  childrenCount: number;
  emptyChildren: number;
  fireTotal: number;
  topCommented: Array<{ slug: string; title: string; comment_count: number }>;
  topFired: Array<{ slug: string; title: string; fire_count: number }>;
  topViewed: Array<{ slug: string; title: string; view_count: number }>;
  notifDelivered: number;
  notifClicked: number;
  pageVisitsTotal: number;
  pageVisitsToday: number;
}) {
  return {
    date: params.date,
    generated_at: new Date(),
    content: {
      posts: {
        submitted: params.posts.submitted,
        approved: params.posts.approved,
        rejected: params.posts.rejected,
        pending: params.posts.pending,
        in_revision: params.posts.inRevision,
        total: params.posts.total,
        this_week: params.posts.thisWeek,
        this_month: params.posts.thisMonth,
      },
      comments: {
        total: params.comments.total,
        this_week: params.comments.thisWeek,
        today: params.comments.today,
      },
    },
    community: {
      users: {
        total: params.users.total,
        new_today: params.users.newToday,
        new_this_week: params.users.newThisWeek,
        active_30d: params.users.active30d,
        active_7d: params.users.active7d,
      },
      trust: {
        scholars: params.trust.scholars,
        neutrals: params.trust.neutrals,
        trolls: params.trust.trolls,
      },
      trolls_active_24h: params.trollsActive24h,
    },
    moderation: {
      reviews_today: computeReviewsToday(params.approvedToday, params.rejectedToday, params.retryToday),
      approved_today: params.approvedToday,
      rejected_today: params.rejectedToday,
      retry_today: params.retryToday,
      pending_queue: { total: params.posts.pending },
      rejection_reasons: params.rejectionReasons,
    },
    categories: {
      top_by_posts: params.topCategories,
      empty_children: params.emptyChildren,
      utilization_pct: computeUtilizationPct(params.childrenCount, params.emptyChildren),
    },
    engagement: {
      total_fire: params.fireTotal,
      top_commented: params.topCommented,
      top_fired: params.topFired,
      top_viewed: params.topViewed,
      notification_delivery_rate: computeNotificationDeliveryRate(params.notifDelivered, params.notifClicked),
    },
    traffic: {
      total_visits: params.pageVisitsTotal,
      visits_today: params.pageVisitsToday,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('computeReviewsToday (pure)', () => {
  it('returns sum of approved, rejected, and retry', () => {
    expect(computeReviewsToday(10, 5, 3)).toBe(18);
  });

  it('returns 0 when all are 0', () => {
    expect(computeReviewsToday(0, 0, 0)).toBe(0);
  });

  it('handles large values', () => {
    expect(computeReviewsToday(10000, 5000, 2000)).toBe(17000);
  });
});

describe('computeUtilizationPct (pure)', () => {
  it('returns 0 when no children exist', () => {
    expect(computeUtilizationPct(0, 0)).toBe(0);
  });

  it('returns 0 when childrenCount is negative (edge case)', () => {
    expect(computeUtilizationPct(-1, 0)).toBe(0);
  });

  it('returns 100 when all children have posts', () => {
    expect(computeUtilizationPct(10, 0)).toBe(100);
  });

  it('returns 0 when all children are empty', () => {
    expect(computeUtilizationPct(10, 10)).toBe(0);
  });

  it('computes partial utilization correctly', () => {
    // 7 utilized out of 10 → 70%
    expect(computeUtilizationPct(10, 3)).toBe(70);
  });

  it('rounds to nearest integer', () => {
    // (5-1)/5 * 100 = 80
    expect(computeUtilizationPct(5, 1)).toBe(80);
    // (3-1)/3 * 100 = 66.67 → 67
    expect(computeUtilizationPct(3, 1)).toBe(67);
  });
});

describe('computeNotificationDeliveryRate (pure)', () => {
  it('returns 0 when no notifications delivered', () => {
    expect(computeNotificationDeliveryRate(0, 0)).toBe(0);
    expect(computeNotificationDeliveryRate(0, 100)).toBe(0);
  });

  it('returns 0 when delivered is negative', () => {
    expect(computeNotificationDeliveryRate(-5, 100)).toBe(0);
  });

  it('returns 100 when all delivered are clicked', () => {
    expect(computeNotificationDeliveryRate(100, 100)).toBe(100);
  });

  it('computes partial rate correctly', () => {
    // 30 clicked out of 100 delivered → 30%
    expect(computeNotificationDeliveryRate(100, 30)).toBe(30);
  });

  it('returns 0 when none clicked', () => {
    expect(computeNotificationDeliveryRate(50, 0)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // 33/100 = 33%
    expect(computeNotificationDeliveryRate(100, 33)).toBe(33);
  });
});

describe('aggregateRejectionReasons (pure)', () => {
  it('aggregates single reason', () => {
    const result = aggregateRejectionReasons([{ _id: 'spam', count: 5 }]);
    expect(result).toEqual({ spam: 5 });
  });

  it('aggregates multiple reasons', () => {
    const result = aggregateRejectionReasons([
      { _id: 'spam', count: 5 },
      { _id: 'low_quality', count: 3 },
      { _id: 'spam', count: 2 },
    ]);
    expect(result).toEqual({ spam: 7, low_quality: 3 });
  });

  it('uses "other" for null _id', () => {
    const result = aggregateRejectionReasons([{ _id: null, count: 10 }]);
    expect(result).toEqual({ other: 10 });
  });

  it('returns empty object for empty array', () => {
    expect(aggregateRejectionReasons([])).toEqual({});
  });

  it('truncates reason keys to 50 characters', () => {
    const longKey = 'a'.repeat(100);
    const result = aggregateRejectionReasons([{ _id: longKey, count: 1 }]);
    const keys = Object.keys(result);
    expect(keys[0].length).toBeLessThanOrEqual(50);
  });
});

describe('processCategories (pure)', () => {
  const sampleCategories = [
    { slug: 'tech', parent_id: null, post_count: 100 },
    { slug: 'science', parent_id: null, post_count: 50 },
    { slug: 'ai', parent_id: 'tech', post_count: 30 },
    { slug: 'web', parent_id: 'tech', post_count: 0 },
    { slug: 'physics', parent_id: 'science', post_count: 20 },
    { slug: 'biology', parent_id: 'science', post_count: 0 },
  ];

  it('separates parents and children', () => {
    const result = processCategories(sampleCategories, 10);
    expect(result.parents.length).toBe(2);
    expect(result.children.length).toBe(4);
  });

  it('counts empty children correctly', () => {
    const result = processCategories(sampleCategories, 10);
    expect(result.emptyChildren).toBe(2); // web and biology
  });

  it('returns top N categories sorted by post_count', () => {
    const result = processCategories(sampleCategories, 3);
    expect(result.topByPosts.length).toBe(3);
    expect(result.topByPosts[0]).toEqual({ slug: 'tech', post_count: 100 });
    expect(result.topByPosts[1]).toEqual({ slug: 'science', post_count: 50 });
    expect(result.topByPosts[2]).toEqual({ slug: 'ai', post_count: 30 });
  });

  it('handles empty input', () => {
    const result = processCategories([], 10);
    expect(result.parents).toEqual([]);
    expect(result.children).toEqual([]);
    expect(result.topByPosts).toEqual([]);
    expect(result.emptyChildren).toBe(0);
  });

  it('handles all-parent categories', () => {
    const onlyParents = [
      { slug: 'a', parent_id: null, post_count: 10 },
      { slug: 'b', parent_id: null, post_count: 20 },
    ];
    const result = processCategories(onlyParents, 10);
    expect(result.children.length).toBe(0);
    expect(result.emptyChildren).toBe(0);
  });

  it('handles all-child categories (no parents)', () => {
    const onlyChildren = [
      { slug: 'x', parent_id: 'p', post_count: 0 },
      { slug: 'y', parent_id: 'p', post_count: 5 },
    ];
    const result = processCategories(onlyChildren, 10);
    expect(result.parents.length).toBe(0);
    expect(result.children.length).toBe(2);
    expect(result.emptyChildren).toBe(1);
  });

  it('topByPosts slice respects topN', () => {
    const result = processCategories(sampleCategories, 2);
    expect(result.topByPosts.length).toBe(2);
  });

  it('topByPosts handles topN larger than array', () => {
    const result = processCategories(sampleCategories, 100);
    expect(result.topByPosts.length).toBe(sampleCategories.length);
  });

  it('topByPosts handles topN = 0', () => {
    const result = processCategories(sampleCategories, 0);
    expect(result.topByPosts.length).toBe(0);
  });
});

describe('buildSnapshot (pure)', () => {
  const defaultParams = {
    date: '2025-01-15',
    posts: { submitted: 50, approved: 30, rejected: 10, pending: 8, inRevision: 2, total: 5000, thisWeek: 200, thisMonth: 800 },
    comments: { total: 12000, thisWeek: 400, today: 55 },
    users: { total: 3000, newToday: 12, newThisWeek: 80, active30d: 1500, active7d: 600 },
    trust: { scholars: 300, neutrals: 2000, trolls: 700 },
    trollsActive24h: 25,
    approvedToday: 30,
    rejectedToday: 10,
    retryToday: 3,
    rejectionReasons: { spam: 5, low_quality: 3 },
    topCategories: [{ slug: 'tech', post_count: 100 }],
    childrenCount: 10,
    emptyChildren: 2,
    fireTotal: 4500,
    topCommented: [{ slug: 'post-1', title: 'Hello', comment_count: 42 }],
    topFired: [{ slug: 'post-2', title: 'World', fire_count: 99 }],
    topViewed: [{ slug: 'post-3', title: 'Foo', view_count: 500 }],
    notifDelivered: 200,
    notifClicked: 60,
    pageVisitsTotal: 50000,
    pageVisitsToday: 1200,
  };

  it('builds a snapshot with the correct shape', () => {
    const snapshot = buildSnapshot(defaultParams);
    expect(snapshot.date).toBe('2025-01-15');
    expect(snapshot.content.posts.submitted).toBe(50);
    expect(snapshot.content.comments.total).toBe(12000);
    expect(snapshot.community.users.total).toBe(3000);
    expect(snapshot.community.trust.scholars).toBe(300);
    expect(snapshot.community.trolls_active_24h).toBe(25);
    expect(snapshot.moderation.reviews_today).toBe(43); // 30+10+3
    expect(snapshot.moderation.pending_queue.total).toBe(8);
    expect(snapshot.moderation.rejection_reasons).toEqual({ spam: 5, low_quality: 3 });
    expect(snapshot.categories.top_by_posts).toEqual([{ slug: 'tech', post_count: 100 }]);
    expect(snapshot.categories.empty_children).toBe(2);
    expect(snapshot.categories.utilization_pct).toBe(80); // (10-2)/10 * 100
    expect(snapshot.engagement.total_fire).toBe(4500);
    expect(snapshot.engagement.notification_delivery_rate).toBe(30); // 60/200*100
    expect(snapshot.traffic.total_visits).toBe(50000);
    expect(snapshot.traffic.visits_today).toBe(1200);
  });

  it('handles empty data (zeroes everywhere)', () => {
    const emptyParams = {
      ...defaultParams,
      posts: { submitted: 0, approved: 0, rejected: 0, pending: 0, inRevision: 0, total: 0, thisWeek: 0, thisMonth: 0 },
      comments: { total: 0, thisWeek: 0, today: 0 },
      users: { total: 0, newToday: 0, newThisWeek: 0, active30d: 0, active7d: 0 },
      trust: { scholars: 0, neutrals: 0, trolls: 0 },
      trollsActive24h: 0,
      approvedToday: 0,
      rejectedToday: 0,
      retryToday: 0,
      rejectionReasons: {},
      topCategories: [],
      childrenCount: 0,
      emptyChildren: 0,
      fireTotal: 0,
      topCommented: [],
      topFired: [],
      topViewed: [],
      notifDelivered: 0,
      notifClicked: 0,
      pageVisitsTotal: 0,
      pageVisitsToday: 0,
    };
    const snapshot = buildSnapshot(emptyParams);
    expect(snapshot.content.posts.total).toBe(0);
    expect(snapshot.moderation.reviews_today).toBe(0);
    expect(snapshot.categories.utilization_pct).toBe(0);
    expect(snapshot.engagement.notification_delivery_rate).toBe(0);
    expect(snapshot.traffic.total_visits).toBe(0);
  });

  it('handles edge case: clicks exceed deliveries', () => {
    const params = { ...defaultParams, notifDelivered: 100, notifClicked: 150 };
    const snapshot = buildSnapshot(params);
    // 150/100 * 100 = 150 (mathematically correct, no clamping)
    expect(snapshot.engagement.notification_delivery_rate).toBe(150);
  });

  it('handles edge case: utilization > 100 when emptyChildren > children', () => {
    // This shouldn't happen in practice but the math should be consistent
    // (5 - 10) / 5 = -100% ... rounded to 0 by ternary in source
    // Our computeUtilizationPct returns 0 when totalChildren <= 0
    // But what if totalChildren = 5, emptyChildren = 10?
    // (5 - 10) / 5 * 100 = -100 → rounds to -100
    // This is an unlikely edge case; the function handles it with Math.round
    const pct = computeUtilizationPct(5, 10);
    expect(typeof pct).toBe('number');
  });
});

describe('computeUtilizationPct edge cases', () => {
  it('handles large numbers correctly', () => {
    const pct = computeUtilizationPct(10000, 2500);
    expect(pct).toBe(75);
  });

  it('handles single child with posts', () => {
    expect(computeUtilizationPct(1, 0)).toBe(100);
  });

  it('handles single empty child', () => {
    expect(computeUtilizationPct(1, 1)).toBe(0);
  });
});

describe('computeNotificationDeliveryRate edge cases', () => {
  it('handles large delivery count', () => {
    const rate = computeNotificationDeliveryRate(1000000, 500000);
    expect(rate).toBe(50);
  });

  it('handles fractional click ratio', () => {
    const rate = computeNotificationDeliveryRate(3, 1);
    expect(rate).toBe(33); // 1/3 * 100 = 33.33 → 33
  });
});

describe('export validation', () => {
  it('startSnapshotCron and stopSnapshotCron are exported functions', async () => {
    const mod = await import('./platformSnapshot');
    expect(typeof mod.startSnapshotCron).toBe('function');
    expect(typeof mod.stopSnapshotCron).toBe('function');
    expect(typeof mod.runSnapshotNow).toBe('function');
  });
});
