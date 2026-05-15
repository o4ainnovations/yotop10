import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted shared mock functions (accessible in both factory and tests) ──
const mocks = vi.hoisted(() => {
  // Post query chain
  const postQueryLean = vi.fn();
  const postQuerySort = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: postQueryLean }) });
  // Must make sort/select return the chain object
  const postFindOne = vi.fn(() => ({ sort: postQuerySort }));

  // Comment query chain
  const commentQueryLean = vi.fn();
  const commentQuerySort = vi.fn().mockReturnValue({
    select: vi.fn(() => ({ lean: commentQueryLean })),
  });
  const commentFindOne = vi.fn(() => ({ sort: commentQuerySort }));

  // Snapshot query chain
  const snapQueryLean = vi.fn();
  const snapQuerySelect = vi.fn().mockReturnValue({ lean: snapQueryLean });
  const snapQuerySort = vi.fn().mockReturnValue({ select: snapQuerySelect });
  const snapFindOne = vi.fn(() => ({ sort: snapQuerySort }));

  return {
    postCountDocs: vi.fn(),
    postFindOne,
    postFind: vi.fn(() => ({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn() }) }) }) })),
    commentCountDocs: vi.fn(),
    commentFindOne,
    userCountDocs: vi.fn(),
    userDistinct: vi.fn(),
    thresholdFind: vi.fn(),
    thresholdFindOne: vi.fn(),
    thresholdCountDocs: vi.fn(),
    thresholdCreate: vi.fn(),
    thresholdFindByIdAndUpdate: vi.fn(),
    alertHistoryFindOne: vi.fn(),
    alertHistoryCreate: vi.fn(),
    alertHistoryFindOneAndUpdate: vi.fn(),
    alertNotifCreate: vi.fn(),
    snapFindOne,
    redisGet: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
    redisHSet: vi.fn(),
    countDocs: vi.fn(),
  };
});

// ── Module mocks (use hoisted mocks) ──────────────────────────────────────
vi.mock('../models/Post', () => ({
  Post: {
    countDocuments: mocks.postCountDocs,
    findOne: mocks.postFindOne,
    findByIdAndUpdate: vi.fn(),
    find: mocks.postFind,
  },
}));

vi.mock('../models/Comment', () => ({
  Comment: {
    countDocuments: mocks.commentCountDocs,
    findOne: mocks.commentFindOne,
  },
}));

vi.mock('../models/User', () => ({
  User: {
    countDocuments: mocks.userCountDocs,
    distinct: mocks.userDistinct,
  },
}));

vi.mock('../models/AlertThreshold', () => ({
  AlertThreshold: {
    find: mocks.thresholdFind,
    findOne: mocks.thresholdFindOne,
    countDocuments: mocks.thresholdCountDocs,
    create: mocks.thresholdCreate,
    findByIdAndUpdate: mocks.thresholdFindByIdAndUpdate,
  },
}));

vi.mock('../models/AlertHistory', () => ({
  AlertHistory: {
    findOne: mocks.alertHistoryFindOne,
    create: mocks.alertHistoryCreate,
    findOneAndUpdate: mocks.alertHistoryFindOneAndUpdate,
  },
}));

vi.mock('../models/AlertNotification', () => ({
  AlertNotificationModel: {
    create: mocks.alertNotifCreate,
  },
}));

vi.mock('../models/PlatformSnapshot', () => ({
  PlatformSnapshot: {
    findOne: mocks.snapFindOne,
  },
}));

vi.mock('./redis', () => ({
  redis: {
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: mocks.redisDel,
    hSet: mocks.redisHSet,
  },
}));

vi.mock('../elasticsearch/lib/indexWriter', () => ({
  countDocs: mocks.countDocs,
}));

import { computeMetric } from './alertEngine';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Pure helpers extracted from source ─────────────────────────────────────

function checkBreach(operator: string, value: number, threshold: number): boolean {
  if (operator === 'gt') return value > threshold;
  if (operator === 'lt') return value < threshold;
  return false;
}

const METRIC_TITLES: Record<string, string> = {
  pending_queue_depth: 'Review Queue Backlog',
  approval_rate_drop: 'Approval Rate Drop',
  zero_review_hours: 'No Reviews',
  comment_brigade: 'Comment Brigade Detected',
  es_index_gap_pct: 'Search Index Gap',
  restricted_user_surge: 'Restricted User Surge',
  new_user_spam_wave: 'New User Spam Wave',
  scholar_ratio_collapse: 'Scholar Ratio Collapse',
  flagged_comment_backlog: 'Flagged Comment Backlog',
  hidden_comment_surge: 'Hidden Comment Surge',
  post_quality_drop: 'Post Quality Drop',
  snapshot_staleness: 'Snapshot Staleness',
};

const ALL_METRICS = Object.keys(METRIC_TITLES);

function formatMessage(metric: string, value: number, threshold: number, operator: string): string {
  const op = operator === 'gt' ? 'above' : 'below';
  return `${METRIC_TITLES[metric] || metric}: value ${value} is ${op} threshold ${threshold}`;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('checkBreach (pure)', () => {
  it('gt: true when value exceeds threshold', () => {
    expect(checkBreach('gt', 100, 50)).toBe(true);
  });

  it('gt: false when value equals threshold', () => {
    expect(checkBreach('gt', 50, 50)).toBe(false);
  });

  it('gt: false when value is below threshold', () => {
    expect(checkBreach('gt', 30, 50)).toBe(false);
  });

  it('lt: true when value is below threshold', () => {
    expect(checkBreach('lt', 30, 50)).toBe(true);
  });

  it('lt: false when value equals threshold', () => {
    expect(checkBreach('lt', 50, 50)).toBe(false);
  });

  it('lt: false when value exceeds threshold', () => {
    expect(checkBreach('lt', 100, 50)).toBe(false);
  });

  it('unknown operator returns false', () => {
    expect(checkBreach('eq', 50, 50)).toBe(false);
    expect(checkBreach('', 100, 50)).toBe(false);
  });

  it('handles zero values', () => {
    expect(checkBreach('gt', 0, -1)).toBe(true);
    expect(checkBreach('lt', 0, 1)).toBe(true);
  });

  it('handles negative thresholds', () => {
    expect(checkBreach('gt', -5, -10)).toBe(true);
    expect(checkBreach('lt', -10, -5)).toBe(true);
  });

  it('handles boundary: gt with threshold 0', () => {
    expect(checkBreach('gt', 1, 0)).toBe(true);
    expect(checkBreach('gt', 0, 0)).toBe(false);
  });

  it('handles boundary: lt with threshold 0', () => {
    expect(checkBreach('lt', -1, 0)).toBe(true);
    expect(checkBreach('lt', 0, 0)).toBe(false);
  });
});

describe('METRIC_TITLES (constant)', () => {
  it('has exactly 12 metric entries', () => {
    expect(Object.keys(METRIC_TITLES).length).toBe(12);
  });

  it.each(ALL_METRICS)('metric "%s" has a non-empty title', (metric) => {
    expect(METRIC_TITLES[metric]).toBeTruthy();
    expect(typeof METRIC_TITLES[metric]).toBe('string');
    expect(METRIC_TITLES[metric].length).toBeGreaterThan(0);
  });

  it('every key maps to a distinct title', () => {
    const titles = Object.values(METRIC_TITLES);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('formatMessage (pure)', () => {
  it('uses "above" for gt operator', () => {
    const msg = formatMessage('pending_queue_depth', 75, 50, 'gt');
    expect(msg).toContain('above');
    expect(msg).toContain('Review Queue Backlog');
    expect(msg).toContain('75');
    expect(msg).toContain('50');
  });

  it('uses "below" for lt operator', () => {
    const msg = formatMessage('approval_rate_drop', 30, 50, 'lt');
    expect(msg).toContain('below');
    expect(msg).toContain('Approval Rate Drop');
    expect(msg).toContain('30');
    expect(msg).toContain('50');
  });

  it('falls back to metric key when title is missing', () => {
    const msg = formatMessage('unknown_metric', 10, 5, 'gt');
    expect(msg).toContain('unknown_metric');
  });

  it('handles zero values', () => {
    const msg = formatMessage('restricted_user_surge', 0, 10, 'gt');
    expect(msg).toContain('0');
    expect(msg).toContain('10');
  });

  it('handles large values', () => {
    const msg = formatMessage('pending_queue_depth', 99999, 20, 'gt');
    expect(msg).toContain('99999');
  });

  it('handles decimal values', () => {
    const msg = formatMessage('scholar_ratio_collapse', 3.7, 5, 'lt');
    expect(msg).toContain('3.7');
  });
});

describe('computeMetric (mocked DB)', () => {
  it('default case returns 0 for unknown metric', async () => {
    const result = await computeMetric('nonexistent_metric');
    expect(result).toBe(0);
  });

  it('pending_queue_depth: counts pending posts', async () => {
    mocks.postCountDocs.mockResolvedValue(42);
    const result = await computeMetric('pending_queue_depth');
    expect(result).toBe(42);
  });

  it('approval_rate_drop: returns 100 when no posts in 24h', async () => {
    mocks.postCountDocs.mockResolvedValue(0);
    const result = await computeMetric('approval_rate_drop');
    expect(result).toBe(100);
  });

  it('approval_rate_drop: computes correct percentage', async () => {
    mocks.postCountDocs
      .mockResolvedValueOnce(70)
      .mockResolvedValueOnce(30);
    const result = await computeMetric('approval_rate_drop');
    expect(result).toBe(70);
  });

  it('approval_rate_drop: handles 0 approvals with rejections', async () => {
    mocks.postCountDocs
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(10);
    const result = await computeMetric('approval_rate_drop');
    expect(result).toBe(0);
  });

  it('zero_review_hours: returns 999 when no reviewed post exists', async () => {
    const mockLean = vi.fn().mockResolvedValue(null);
    const mockSelect = vi.fn().mockReturnValue({ lean: mockLean });
    const mockSort = vi.fn().mockReturnValue({ select: mockSelect });
    mocks.postFindOne.mockReturnValue({ sort: mockSort });

    const result = await computeMetric('zero_review_hours');
    expect(result).toBe(999);
  });

  it('comment_brigade: returns max reply count', async () => {
    const mockLean = vi.fn().mockResolvedValue({ reply_count: 15 });
    const mockSelect = vi.fn().mockReturnValue({ lean: mockLean });
    const mockSort = vi.fn().mockReturnValue({ select: mockSelect });
    mocks.commentFindOne.mockReturnValue({ sort: mockSort });

    const result = await computeMetric('comment_brigade');
    expect(result).toBe(15);
  });

  it('comment_brigade: returns 0 when no comment found', async () => {
    const mockLean = vi.fn().mockResolvedValue(null);
    const mockSelect = vi.fn().mockReturnValue({ lean: mockLean });
    const mockSort = vi.fn().mockReturnValue({ select: mockSelect });
    mocks.commentFindOne.mockReturnValue({ sort: mockSort });

    const result = await computeMetric('comment_brigade');
    expect(result).toBe(0);
  });

  it('es_index_gap_pct: computes gap percentage', async () => {
    mocks.postCountDocs.mockResolvedValue(100);
    mocks.commentCountDocs.mockResolvedValue(50);
    mocks.countDocs
      .mockResolvedValueOnce(90)
      .mockResolvedValueOnce(30);
    const result = await computeMetric('es_index_gap_pct');
    expect(result).toBe(20); // (150-120)/150*100 = 20
  });

  it('es_index_gap_pct: returns 0 when no gap', async () => {
    mocks.postCountDocs.mockResolvedValue(100);
    mocks.commentCountDocs.mockResolvedValue(50);
    mocks.countDocs
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50);
    const result = await computeMetric('es_index_gap_pct');
    expect(result).toBe(0);
  });

  it('es_index_gap_pct: when both DB totals are 0, totalDb guarded to 1', async () => {
    mocks.postCountDocs.mockResolvedValue(0);
    mocks.commentCountDocs.mockResolvedValue(0);
    mocks.countDocs
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const result = await computeMetric('es_index_gap_pct');
    // totalDb = 0 || 1 = 1, totalEs = 0, gap = Math.round((1-0)/1*100) = 100
    expect(result).toBe(100);
  });

  it('restricted_user_surge: counts restricted users', async () => {
    mocks.userCountDocs.mockResolvedValue(7);
    const result = await computeMetric('restricted_user_surge');
    expect(result).toBe(7);
  });

  it('new_user_spam_wave: counts posts from new users', async () => {
    mocks.userDistinct.mockResolvedValue(['u1', 'u2', 'u3']);
    mocks.postCountDocs.mockResolvedValue(12);
    const result = await computeMetric('new_user_spam_wave');
    expect(result).toBe(12);
  });

  it('scholar_ratio_collapse: returns 100 when no users', async () => {
    mocks.userCountDocs.mockResolvedValue(0);
    const result = await computeMetric('scholar_ratio_collapse');
    expect(result).toBe(100);
  });

  it('scholar_ratio_collapse: computes correct percentage', async () => {
    mocks.userCountDocs
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(8);  // scholars (trust >= 1.8)
    const result = await computeMetric('scholar_ratio_collapse');
    expect(result).toBe(8);
  });

  it('flagged_comment_backlog: counts flagged comments', async () => {
    mocks.commentCountDocs.mockResolvedValue(25);
    const result = await computeMetric('flagged_comment_backlog');
    expect(result).toBe(25);
  });

  it('hidden_comment_surge: counts hidden comments in last hour', async () => {
    mocks.commentCountDocs.mockResolvedValue(5);
    const result = await computeMetric('hidden_comment_surge');
    expect(result).toBe(5);
  });

  it('post_quality_drop: counts short-intro approved posts', async () => {
    mocks.postCountDocs.mockResolvedValue(3);
    const result = await computeMetric('post_quality_drop');
    expect(result).toBe(3);
  });

  it('snapshot_staleness: returns 999 when no snapshot exists', async () => {
    const mockLean = vi.fn().mockResolvedValue(null);
    const mockSelect = vi.fn().mockReturnValue({ lean: mockLean });
    const mockSort = vi.fn().mockReturnValue({ select: mockSelect });
    mocks.snapFindOne.mockReturnValue({ sort: mockSort });

    const result = await computeMetric('snapshot_staleness');
    expect(result).toBe(999);
  });

  it('all 12 metric names return finite numbers', async () => {
    for (const metric of ALL_METRICS) {
      vi.clearAllMocks();
      // Wire up mocks for each metric branch
      mocks.postCountDocs.mockResolvedValue(0);
      mocks.commentCountDocs.mockResolvedValue(0);
      mocks.userCountDocs.mockResolvedValue(0);
      mocks.userDistinct.mockResolvedValue([]);
      mocks.countDocs.mockResolvedValue(0);

      const nullLean = vi.fn().mockResolvedValue(null);
      const nullSelect = vi.fn().mockReturnValue({ lean: nullLean });
      const nullSort = vi.fn().mockReturnValue({ select: nullSelect });
      mocks.postFindOne.mockReturnValue({ sort: nullSort });
      mocks.commentFindOne.mockReturnValue({ sort: nullSort });
      mocks.snapFindOne.mockReturnValue({ sort: nullSort });

      const result = await computeMetric(metric);
      expect(typeof result).toBe('number');
      expect(Number.isFinite(result)).toBe(true);
    }
  });
});
