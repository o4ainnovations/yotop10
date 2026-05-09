import { SearchEvent } from '../models/SearchEvent';
import { SearchClick } from '../models/SearchClick';
import { SearchDailyStats } from '../models/SearchDailyStats';
import { SearchDeadLetter } from '../models/SearchDeadLetter';
import { countDocs } from '../elasticsearch/lib/indexWriter';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';

async function computeYesterday(): Promise<void> {
  const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
  const yesterdayStart = new Date(yesterday + 'T00:00:00.000Z');
  const todayStart = new Date(new Date().toISOString().substring(0, 10) + 'T00:00:00.000Z');

  const exists = await SearchDailyStats.findOne({ date: yesterday });
  if (exists) return; // already computed

  try {
    const events = await SearchEvent.find({
      timestamp: { $gte: yesterdayStart, $lt: todayStart },
    }).lean();

    const clicks = await SearchClick.find({
      timestamp: { $gte: yesterdayStart, $lt: todayStart },
    }).lean();

    if (events.length === 0) return;

    const total = events.length;
    const zeroResult = events.filter((e) => e.zero_results).length;
    const uniqueSearchers = new Set(events.map((e) => e.fingerprint).filter(Boolean)).size;

    // Top queries
    const queryMap = new Map<string, number>();
    const zeroQueryMap = new Map<string, number>();
    let totalLen = 0;
    let totalLatency = 0;
    let hadSuggestion = 0;
    let acceptedSuggestion = 0;

    for (const e of events) {
      queryMap.set(e.normalized_query, (queryMap.get(e.normalized_query) || 0) + 1);
      if (e.zero_results) zeroQueryMap.set(e.normalized_query, (zeroQueryMap.get(e.normalized_query) || 0) + 1);
      totalLen += e.query_length;
      totalLatency += e.response_time_ms;
      if (e.had_suggestion) hadSuggestion++;
      if (e.suggestion_accepted) acceptedSuggestion++;
    }

    const topQueries = [...queryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100).map(([q, c]) => ({ query: q, count: c }));
    const topZeroQueries = [...zeroQueryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([q, c]) => ({ query: q, count: c }));

    // CTR by position
    const posClicks = new Map<number, number>();
    let totalClicks = 0;
    let totalClickTime = 0;
    for (const c of clicks) {
      posClicks.set(c.result_position, (posClicks.get(c.result_position) || 0) + 1);
      totalClicks++;
      totalClickTime += c.click_time_ms;
    }
    const ctrByPos: number[] = [];
    for (let i = 1; i <= 10; i++) ctrByPos.push(posClicks.get(i) || 0);

    // Facet/sort usage
    let catFilter = 0, typeFilter = 0, authorFilter = 0;
    const sortUsage: Record<string, number> = { relevance: 0, newest: 0, most_comments: 0, most_fire: 0 };
    for (const e of events) {
      if (e.filters_applied?.category_slug) catFilter++;
      if (e.filters_applied?.post_type) typeFilter++;
      if (e.filters_applied?.author) authorFilter++;
      sortUsage[e.sort_used] = (sortUsage[e.sort_used] || 0) + 1;
    }

    // Latency P99
    const latencies = events.map((e) => e.response_time_ms).sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    // Index gap
    const [dbPosts, dbComments] = await Promise.all([
      Post.countDocuments({ deleted: false }),
      Comment.countDocuments({ deleted: false, hidden: false }),
    ]);
    const [esPosts, esComments] = await Promise.all([countDocs('posts'), countDocs('comments')]);
    const totalDb = dbPosts + dbComments || 1;
    const totalEs = esPosts + esComments;
    const gapPct = Math.round(((totalDb - totalEs) / totalDb) * 100);

    const dlqCount = await SearchDeadLetter.countDocuments({});

    await SearchDailyStats.findOneAndUpdate(
      { date: yesterday },
      {
        date: yesterday,
        total_searches: total,
        unique_searchers: uniqueSearchers,
        zero_result_searches: zeroResult,
        zero_result_pct: Math.round((zeroResult / total) * 100),
        top_queries: topQueries,
        top_zero_queries: topZeroQueries,
        query_length_avg: Math.round((totalLen / total) * 10) / 10,
        avg_response_time_ms: Math.round(totalLatency / total),
        p99_response_time_ms: p99,
        suggestion_rate: Math.round((hadSuggestion / total) * 100),
        suggestion_accept_rate: hadSuggestion > 0 ? Math.round((acceptedSuggestion / hadSuggestion) * 100) : 0,
        ctr_by_position: ctrByPos,
        avg_click_time_ms: totalClicks > 0 ? Math.round(totalClickTime / totalClicks) : 0,
        facet_usage: {
          category: Math.round((catFilter / total) * 100),
          post_type: Math.round((typeFilter / total) * 100),
          author: Math.round((authorFilter / total) * 100),
        },
        sort_usage: {
          relevance: sortUsage['relevance'] || 0,
          newest: sortUsage['newest'] || 0,
          most_comments: sortUsage['most_comments'] || 0,
          most_fire: sortUsage['most_fire'] || 0,
        },
        index_gap_pct: gapPct,
        dead_letter_count: dlqCount,
      },
      { upsert: true }
    );
  } catch (err) { /* best-effort */ }
}

let cronHandle: NodeJS.Timeout | null = null;

export function startSearchAnalyticsCron(): void {
  if (cronHandle) return;
  computeYesterday();
  cronHandle = setInterval(computeYesterday, 60 * 60 * 1000); // every hour (idempotent)
  console.log('[SearchAnalytics] Cron started (every 60min, idempotent)');
}

export function stopSearchAnalyticsCron(): void {
  if (cronHandle) { clearInterval(cronHandle); cronHandle = null; }
}
