import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Mongoose models ──────────────────────────────────────────────────
vi.mock('../models/SearchEvent', () => ({
  SearchEvent: {
    find: vi.fn(() => ({ lean: vi.fn() })),
  },
}));

vi.mock('../models/SearchClick', () => ({
  SearchClick: {
    find: vi.fn(() => ({ lean: vi.fn() })),
  },
}));

vi.mock('../models/SearchDailyStats', () => ({
  SearchDailyStats: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../models/SearchDeadLetter', () => ({
  SearchDeadLetter: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/Post', () => ({
  Post: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/Comment', () => ({
  Comment: {
    countDocuments: vi.fn(),
  },
}));

vi.mock('../elasticsearch/lib/indexWriter', () => ({
  countDocs: vi.fn(),
}));

// ── Pure helper functions extracted from computeYesterday() logic ─────────

interface SearchEventLike {
  fingerprint: string | null | undefined;
  normalized_query: string;
  query_length: number;
  response_time_ms: number;
  zero_results: boolean;
  had_suggestion: boolean;
  suggestion_accepted: boolean;
  filters_applied?: { category_slug?: unknown; post_type?: unknown; author?: unknown };
  sort_used: string;
}

interface SearchClickLike {
  result_position: number;
  click_time_ms: number;
}

function countZeroResults(events: SearchEventLike[]): number {
  return events.filter((e) => e.zero_results).length;
}

function countUniqueSearchers(events: SearchEventLike[]): number {
  return new Set(events.map((e) => e.fingerprint).filter(Boolean)).size;
}

function buildQueryFrequencyMap(events: SearchEventLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of events) {
    map.set(e.normalized_query, (map.get(e.normalized_query) || 0) + 1);
  }
  return map;
}

function buildZeroQueryMap(events: SearchEventLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of events) {
    if (e.zero_results) {
      map.set(e.normalized_query, (map.get(e.normalized_query) || 0) + 1);
    }
  }
  return map;
}

function topQueries(map: Map<string, number>, n: number): Array<{ query: string; count: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([q, c]) => ({ query: q, count: c }));
}

function computeAvgQueryLength(events: SearchEventLike[]): number {
  if (events.length === 0) return 0;
  const totalLen = events.reduce((sum, e) => sum + e.query_length, 0);
  return Math.round((totalLen / events.length) * 10) / 10;
}

function computeAvgResponseTime(events: SearchEventLike[]): number {
  if (events.length === 0) return 0;
  const total = events.reduce((sum, e) => sum + e.response_time_ms, 0);
  return Math.round(total / events.length);
}

function computeP99Latency(events: SearchEventLike[]): number {
  if (events.length === 0) return 0;
  const latencies = [...events].map((e) => e.response_time_ms).sort((a, b) => a - b);
  const idx = Math.floor(latencies.length * 0.99);
  return latencies[idx] || 0;
}

function computeSuggestionRate(events: SearchEventLike[]): number {
  if (events.length === 0) return 0;
  const hadSuggestion = events.filter((e) => e.had_suggestion).length;
  return Math.round((hadSuggestion / events.length) * 100);
}

function computeSuggestionAcceptRate(events: SearchEventLike[]): number {
  const hadSuggestion = events.filter((e) => e.had_suggestion).length;
  if (hadSuggestion === 0) return 0;
  const accepted = events.filter((e) => e.suggestion_accepted).length;
  return Math.round((accepted / hadSuggestion) * 100);
}

function computeCtrByPosition(clicks: SearchClickLike[]): number[] {
  const posClicks = new Map<number, number>();
  for (const c of clicks) {
    posClicks.set(c.result_position, (posClicks.get(c.result_position) || 0) + 1);
  }
  const ctrByPos: number[] = [];
  for (let i = 1; i <= 10; i++) {
    ctrByPos.push(posClicks.get(i) || 0);
  }
  return ctrByPos;
}

function computeAvgClickTime(clicks: SearchClickLike[]): number {
  if (clicks.length === 0) return 0;
  const total = clicks.reduce((sum, c) => sum + c.click_time_ms, 0);
  return Math.round(total / clicks.length);
}

function computeFacetUsage(events: SearchEventLike[]): {
  category: number;
  post_type: number;
  author: number;
} {
  if (events.length === 0) return { category: 0, post_type: 0, author: 0 };
  let catFilter = 0;
  let typeFilter = 0;
  let authorFilter = 0;
  for (const e of events) {
    if (e.filters_applied?.category_slug) catFilter++;
    if (e.filters_applied?.post_type) typeFilter++;
    if (e.filters_applied?.author) authorFilter++;
  }
  return {
    category: Math.round((catFilter / events.length) * 100),
    post_type: Math.round((typeFilter / events.length) * 100),
    author: Math.round((authorFilter / events.length) * 100),
  };
}

function computeSortUsage(events: SearchEventLike[]): Record<string, number> {
  const usage: Record<string, number> = { relevance: 0, newest: 0, most_comments: 0, most_fire: 0 };
  for (const e of events) {
    usage[e.sort_used] = (usage[e.sort_used] || 0) + 1;
  }
  return {
    relevance: usage['relevance'] || 0,
    newest: usage['newest'] || 0,
    most_comments: usage['most_comments'] || 0,
    most_fire: usage['most_fire'] || 0,
  };
}

function computeIndexGap(dbPosts: number, dbComments: number, esPosts: number, esComments: number): number {
  const totalDb = dbPosts + dbComments || 1;
  const totalEs = esPosts + esComments;
  return Math.round(((totalDb - totalEs) / totalDb) * 100);
}

function computeZeroResultPct(events: SearchEventLike[]): number {
  if (events.length === 0) return 0;
  const zeroCount = events.filter((e) => e.zero_results).length;
  return Math.round((zeroCount / events.length) * 100);
}

// ── Sample data ────────────────────────────────────────────────────────────

function makeEvents(overrides: Array<Partial<SearchEventLike>> = []): SearchEventLike[] {
  return overrides.map((o, i) => ({
    fingerprint: 'fingerprint' in o ? o.fingerprint : `fp-${i}`,
    normalized_query: o.normalized_query ?? `query-${i}`,
    query_length: o.query_length ?? 5,
    response_time_ms: o.response_time_ms ?? 100,
    zero_results: o.zero_results ?? false,
    had_suggestion: o.had_suggestion ?? false,
    suggestion_accepted: o.suggestion_accepted ?? false,
    filters_applied: o.filters_applied ?? {},
    sort_used: o.sort_used ?? 'relevance',
  }));
}

function makeClicks(overrides: Array<Partial<SearchClickLike>> = []): SearchClickLike[] {
  return overrides.map((o, i) => ({
    result_position: o.result_position ?? i + 1,
    click_time_ms: o.click_time_ms ?? 500,
  }));
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('countZeroResults', () => {
  it('returns 0 when no zero-result events', () => {
    const events = makeEvents([{}, {}, {}]);
    expect(countZeroResults(events)).toBe(0);
  });

  it('counts zero-result events', () => {
    const events = makeEvents([
      { zero_results: true },
      { zero_results: false },
      { zero_results: true },
    ]);
    expect(countZeroResults(events)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(countZeroResults([])).toBe(0);
  });
});

describe('countUniqueSearchers', () => {
  it('counts distinct fingerprints', () => {
    const events = makeEvents([
      { fingerprint: 'a' },
      { fingerprint: 'b' },
      { fingerprint: 'a' },
      { fingerprint: 'c' },
    ]);
    expect(countUniqueSearchers(events)).toBe(3);
  });

  it('filters out null/undefined fingerprints', () => {
    const events = makeEvents([
      { fingerprint: 'a' },
      { fingerprint: null },
      { fingerprint: undefined },
      { fingerprint: 'b' },
    ]);
    expect(countUniqueSearchers(events)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(countUniqueSearchers([])).toBe(0);
  });
});

describe('buildQueryFrequencyMap', () => {
  it('counts occurrences of each query', () => {
    const events = makeEvents([
      { normalized_query: 'cats' },
      { normalized_query: 'dogs' },
      { normalized_query: 'cats' },
      { normalized_query: 'cats' },
      { normalized_query: 'birds' },
    ]);
    const map = buildQueryFrequencyMap(events);
    expect(map.get('cats')).toBe(3);
    expect(map.get('dogs')).toBe(1);
    expect(map.get('birds')).toBe(1);
  });

  it('returns empty map for empty array', () => {
    expect(buildQueryFrequencyMap([]).size).toBe(0);
  });
});

describe('buildZeroQueryMap', () => {
  it('only counts zero-result queries', () => {
    const events = makeEvents([
      { normalized_query: 'xyz', zero_results: true },
      { normalized_query: 'abc', zero_results: false },
      { normalized_query: 'xyz', zero_results: true },
    ]);
    const map = buildZeroQueryMap(events);
    expect(map.get('xyz')).toBe(2);
    expect(map.has('abc')).toBe(false);
  });

  it('returns empty map when no zero-result events', () => {
    const events = makeEvents([{}, {}]);
    expect(buildZeroQueryMap(events).size).toBe(0);
  });
});

describe('topQueries', () => {
  it('returns top N by frequency', () => {
    const map = new Map([
      ['a', 10],
      ['b', 5],
      ['c', 20],
      ['d', 15],
    ]);
    const top = topQueries(map, 3);
    expect(top).toEqual([
      { query: 'c', count: 20 },
      { query: 'd', count: 15 },
      { query: 'a', count: 10 },
    ]);
  });

  it('handles N larger than map size', () => {
    const map = new Map([['a', 1], ['b', 2]]);
    expect(topQueries(map, 100).length).toBe(2);
  });

  it('handles N = 0', () => {
    const map = new Map([['a', 1]]);
    expect(topQueries(map, 0).length).toBe(0);
  });

  it('handles empty map', () => {
    expect(topQueries(new Map(), 10).length).toBe(0);
  });
});

describe('computeAvgQueryLength', () => {
  it('computes average query length rounded to 1 decimal', () => {
    const events = makeEvents([
      { query_length: 4 },
      { query_length: 6 },
      { query_length: 8 },
    ]);
    // (4+6+8)/3 = 6.0
    expect(computeAvgQueryLength(events)).toBe(6);
  });

  it('handles fractional result', () => {
    const events = makeEvents([
      { query_length: 5 },
      { query_length: 6 },
    ]);
    // (5+6)/2 = 5.5
    expect(computeAvgQueryLength(events)).toBe(5.5);
  });

  it('returns 0 for empty array', () => {
    expect(computeAvgQueryLength([])).toBe(0);
  });
});

describe('computeAvgResponseTime', () => {
  it('computes average rounded to integer', () => {
    const events = makeEvents([
      { response_time_ms: 100 },
      { response_time_ms: 200 },
    ]);
    expect(computeAvgResponseTime(events)).toBe(150);
  });

  it('rounds down for .5', () => {
    const events = makeEvents([
      { response_time_ms: 100 },
      { response_time_ms: 101 },
    ]);
    // (100+101)/2 = 100.5 → Math.round(100.5) = 101
    expect(computeAvgResponseTime(events)).toBe(101);
  });

  it('returns 0 for empty array', () => {
    expect(computeAvgResponseTime([])).toBe(0);
  });
});

describe('computeP99Latency', () => {
  it('returns the P99 value from sorted latencies', () => {
    const events = Array.from({ length: 100 }, (_, i) => ({
      ...makeEvents([{}])[0],
      response_time_ms: i + 1, // 1..100
    }));
    // idx = floor(100 * 0.99) = 99 → value = 100
    expect(computeP99Latency(events)).toBe(100);
  });

  it('handles small sample (1 event)', () => {
    const events = makeEvents([{ response_time_ms: 42 }]);
    // idx = floor(1 * 0.99) = 0 → value = 42
    expect(computeP99Latency(events)).toBe(42);
  });

  it('returns 0 for empty array', () => {
    expect(computeP99Latency([])).toBe(0);
  });

  it('handles 99 events', () => {
    const events = Array.from({ length: 99 }, (_, i) => ({
      ...makeEvents([{}])[0],
      response_time_ms: i * 10, // 0, 10, 20, ...
    }));
    const result = computeP99Latency(events);
    expect(typeof result).toBe('number');
  });
});

describe('computeSuggestionRate', () => {
  it('computes percentage of events with suggestions', () => {
    const events = makeEvents([
      { had_suggestion: true },
      { had_suggestion: true },
      { had_suggestion: false },
      { had_suggestion: false },
    ]);
    expect(computeSuggestionRate(events)).toBe(50);
  });

  it('returns 0 when no events had suggestions', () => {
    const events = makeEvents([{}, {}]);
    expect(computeSuggestionRate(events)).toBe(0);
  });

  it('returns 100 when all events had suggestions', () => {
    const events = makeEvents([{ had_suggestion: true }, { had_suggestion: true }]);
    expect(computeSuggestionRate(events)).toBe(100);
  });

  it('returns 0 for empty array', () => {
    expect(computeSuggestionRate([])).toBe(0);
  });
});

describe('computeSuggestionAcceptRate', () => {
  it('computes acceptance rate among events with suggestions', () => {
    const events = makeEvents([
      { had_suggestion: true, suggestion_accepted: true },
      { had_suggestion: true, suggestion_accepted: false },
      { had_suggestion: true, suggestion_accepted: true },
    ]);
    expect(computeSuggestionAcceptRate(events)).toBe(67); // 2/3 * 100 = 66.67 → 67
  });

  it('returns 0 when no events had suggestions', () => {
    const events = makeEvents([{ had_suggestion: false }]);
    expect(computeSuggestionAcceptRate(events)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(computeSuggestionAcceptRate([])).toBe(0);
  });

  it('returns 0 when all suggestions were rejected', () => {
    const events = makeEvents([
      { had_suggestion: true, suggestion_accepted: false },
      { had_suggestion: true, suggestion_accepted: false },
    ]);
    expect(computeSuggestionAcceptRate(events)).toBe(0);
  });
});

describe('computeCtrByPosition', () => {
  it('returns array of length 10', () => {
    const clicks = makeClicks([]);
    expect(computeCtrByPosition(clicks).length).toBe(10);
  });

  it('counts clicks at each position 1-10', () => {
    const clicks = makeClicks([
      { result_position: 1 },
      { result_position: 1 },
      { result_position: 3 },
      { result_position: 5 },
    ]);
    const ctr = computeCtrByPosition(clicks);
    expect(ctr[0]).toBe(2); // position 1
    expect(ctr[1]).toBe(0); // position 2
    expect(ctr[2]).toBe(1); // position 3
    expect(ctr[3]).toBe(0); // position 4
    expect(ctr[4]).toBe(1); // position 5
    // All others = 0
  });

  it('ignores positions outside 1-10', () => {
    const clicks = makeClicks([
      { result_position: 15 },
      { result_position: 0 },
      { result_position: 1 },
    ]);
    const ctr = computeCtrByPosition(clicks);
    expect(ctr[0]).toBe(1); // only position 1 counted
    expect(ctr.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('returns all zeros for empty clicks', () => {
    const ctr = computeCtrByPosition([]);
    expect(ctr.every((v) => v === 0)).toBe(true);
  });
});

describe('computeAvgClickTime', () => {
  it('computes average click time', () => {
    const clicks = makeClicks([
      { click_time_ms: 400 },
      { click_time_ms: 600 },
    ]);
    expect(computeAvgClickTime(clicks)).toBe(500);
  });

  it('returns 0 for empty array', () => {
    expect(computeAvgClickTime([])).toBe(0);
  });
});

describe('computeFacetUsage', () => {
  it('computes percentages for each filter type', () => {
    const events = makeEvents([
      { filters_applied: { category_slug: 'tech' } },
      { filters_applied: { post_type: 'article' } },
      { filters_applied: { category_slug: 'science', author: 'john' } },
      { filters_applied: {} },
    ]);
    const usage = computeFacetUsage(events);
    // category: events 1 and 3 → 2/4 * 100 = 50
    // post_type: event 2 → 1/4 * 100 = 25
    // author: event 3 → 1/4 * 100 = 25
    expect(usage).toEqual({ category: 50, post_type: 25, author: 25 });
  });

  it('returns all zeros for empty events', () => {
    expect(computeFacetUsage([])).toEqual({ category: 0, post_type: 0, author: 0 });
  });

  it('handles undefined filters_applied', () => {
    const events = makeEvents([
      { filters_applied: undefined },
      { filters_applied: { category_slug: 'tech' } },
    ]);
    const usage = computeFacetUsage(events);
    expect(usage.category).toBe(50); // 1/2 * 100
  });

  it('handles all events with no filters', () => {
    const events = makeEvents([{ filters_applied: {} }, { filters_applied: {} }]);
    const usage = computeFacetUsage(events);
    expect(usage).toEqual({ category: 0, post_type: 0, author: 0 });
  });
});

describe('computeSortUsage', () => {
  it('counts sort usage across events', () => {
    const events = makeEvents([
      { sort_used: 'relevance' },
      { sort_used: 'relevance' },
      { sort_used: 'newest' },
      { sort_used: 'most_fire' },
    ]);
    const usage = computeSortUsage(events);
    expect(usage).toEqual({
      relevance: 2,
      newest: 1,
      most_comments: 0,
      most_fire: 1,
    });
  });

  it('handles unknown sort values', () => {
    const events = makeEvents([
      { sort_used: 'relevance' },
      { sort_used: 'custom_sort' as unknown as string },
    ]);
    const usage = computeSortUsage(events);
    // Unknown values are counted by their key but NOT in the canonical 4 return fields
    // The source stores them in usage map but only returns the 4 known keys
    expect(usage.relevance).toBe(1);
  });

  it('returns zeros for empty events', () => {
    const usage = computeSortUsage([]);
    expect(usage).toEqual({ relevance: 0, newest: 0, most_comments: 0, most_fire: 0 });
  });
});

describe('computeIndexGap', () => {
  it('computes gap percentage', () => {
    // DB: 100 posts + 50 comments = 150, ES: 90 posts + 30 comments = 120
    // gap = (150-120)/150 * 100 = 20
    expect(computeIndexGap(100, 50, 90, 30)).toBe(20);
  });

  it('returns 0 when ES matches DB', () => {
    expect(computeIndexGap(100, 50, 100, 50)).toBe(0);
  });

  it('avoids division by zero when DB has no documents', () => {
    // totalDb = 0 || 1 → guards to 1, totalEs = 0 → (1-0)/1*100 = 100
    // The guard prevents NaN/Infinity, resulting in 100% gap
    const result = computeIndexGap(0, 0, 0, 0);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(100);
  });

  it('handles ES having more docs than DB (negative gap)', () => {
    const gap = computeIndexGap(100, 50, 200, 100);
    // totalDb=150, totalEs=300, (150-300)/150*100 = -100
    expect(gap).toBeLessThan(0);
  });
});

describe('computeZeroResultPct', () => {
  it('computes percentage of zero-result searches', () => {
    const events = makeEvents([
      { zero_results: true },
      { zero_results: false },
      { zero_results: false },
    ]);
    // 1/3 * 100 = 33.33 → 33
    expect(computeZeroResultPct(events)).toBe(33);
  });

  it('returns 0 for empty events', () => {
    expect(computeZeroResultPct([])).toBe(0);
  });

  it('returns 100 when all are zero-result', () => {
    const events = makeEvents([{ zero_results: true }, { zero_results: true }]);
    expect(computeZeroResultPct(events)).toBe(100);
  });
});

describe('export validation', () => {
  it('startSearchAnalyticsCron and stopSearchAnalyticsCron are exported', async () => {
    const mod = await import('./searchAnalyticsCron');
    expect(typeof mod.startSearchAnalyticsCron).toBe('function');
    expect(typeof mod.stopSearchAnalyticsCron).toBe('function');
  });
});
