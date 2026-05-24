'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Icon, type LucideIconName } from '@/components/icons/Icon';
import { formatDate, formatTime } from '@/lib/dates';

interface PanelState { loading: boolean; data: unknown; error?: string; open: boolean }

function n(v: unknown): string { if (v === null || v === undefined) return 'N/A'; return String(v); }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }

const H3 = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 text-base2 border-b border-white/10 pb-1.5 text-white">{children}</h3>;

export default function StatisticsDashboardClient() {
  const [panels, setPanels] = useState<Record<string, PanelState>>({
    overview: { loading: false, data: null, open: true },
    health: { loading: false, data: null, open: false },
    content: { loading: false, data: null, open: false },
    community: { loading: false, data: null, open: false },
    moderation: { loading: false, data: null, open: false },
    categories: { loading: false, data: null, open: false },
    trends: { loading: false, data: null, open: false },
    quality: { loading: false, data: null, open: false },
    traffic: { loading: false, data: null, open: false },
    submissions: { loading: false, data: null, open: false },
    lifecycle: { loading: false, data: null, open: false },
    lurkers: { loading: false, data: null, open: false },
    conversion: { loading: false, data: null, open: false },
    reengagement: { loading: false, data: null, open: false },
    alerts: { loading: false, data: null, open: false },
    notifications: { loading: false, data: null, open: false },
    'search/overview': { loading: false, data: null, open: false },
    'search/queries': { loading: false, data: null, open: false },
    'search/relevance': { loading: false, data: null, open: false },
    'search/trends': { loading: false, data: null, open: false },
    'search/infrastructure': { loading: false, data: null, open: false },
    'search/behavior': { loading: false, data: null, open: false },
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchPanel = useCallback(async (scope: string) => {
    setPanels(prev => ({ ...prev, [scope]: { ...prev[scope], loading: true } }));
    try {
      const url = scope === 'lifecycle' ? '/admin/stats/users/lifecycle'
        : scope === 'lurkers' ? '/admin/stats/traffic/lurkers'
        : scope === 'conversion' ? '/admin/stats/traffic/conversion'
        : scope === 'reengagement' ? '/admin/stats/users/reengagement'
        : `/admin/stats/${scope}`;
      const data = await apiFetch(url);
      setPanels(prev => ({ ...prev, [scope]: { ...prev[scope], loading: false, data, open: true } }));
    } catch {
      setPanels(prev => ({ ...prev, [scope]: { ...prev[scope], loading: false, error: 'Failed' } }));
    }
  }, []);

  useEffect(() => { fetchPanel('overview'); }, [fetchPanel]);

  const toggle = (scope: string) => setPanels(prev => {
    const c = prev[scope];
    const isOpening = !c.open;
    if (isOpening && !c.data) fetchPanel(scope);

    if (isOpening && isMobile) {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key !== scope && next[key].open) {
          next[key] = { ...next[key], open: false };
        }
      }
      next[scope] = { ...c, open: true };
      return next;
    }

    return { ...prev, [scope]: { ...c, open: !c.open } };
  });

  const Panel = ({ scope, title, titleIcon, children }: { scope: string; title: string; titleIcon?: LucideIconName; children: React.ReactNode }) => {
    const p = panels[scope];
    const overview = panels.overview.data as Record<string, unknown> | null;
    let hint = '';
    if (!p.open && overview && scope !== 'overview') {
      const ov = overview as Record<string, unknown>;
      if (scope === 'health') hint = ` ▸ ${n((ov.services as Record<string, unknown>)?.mongodb)}`;
      else if (scope === 'content') hint = ` ▸ ${n((ov.posts as Record<string, number>)?.total)} posts`;
      else if (scope === 'community') hint = ` ▸ ${n((ov.users as Record<string, number>)?.total)} users`;
      else if (scope === 'moderation') hint = ` ▸ ${n(ov.pending)} pending`;
    }
    return (
      <div className="bg-white/5 border border-white/5 rounded-2xl mb-3 overflow-hidden">
        <button onClick={() => toggle(scope)} className="w-full text-left px-4 py-3.5 bg-transparent border-none cursor-pointer text-base2 font-bold flex justify-between items-center text-white min-h-11 hover:bg-white/5 transition-colors">
          <span className="truncate">{titleIcon && <><Icon name={titleIcon} size={16} color="var(--color-orange-400)" />{' '}</>}{title}{hint}</span>
          <span className="text-white/40 flex-shrink-0 ml-2">{p.open ? '\u25BE' : '\u25B8'}</span>
        </button>
        {p.open && <div className="p-4 sm:p-5">{p.loading ? <p className="text-white/40">Loading...</p> : p.error ? <p className="text-red-500">{p.error}</p> : children}</div>}
      </div>
    );
  };

  const statCard = (label: string, value: unknown) => (
    <div className="bg-white/5 border border-white/5 rounded-xl p-3 sm:p-4 text-center flex-1 min-w-[90px]">
      <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{String(value ?? '\u2014')}</div>
      <div className="text-3xs text-white/40 mt-1">{label}</div>
    </div>
  );

  const L = ({ children }: { children: React.ReactNode }) => <div className="mb-1 text-sm2 leading-relaxed text-white/60">{children}</div>;

  const overview = panels.overview.data as Record<string, unknown> | null;
  const op = overview?.posts as Record<string, number> | undefined;
  const oc = overview?.comments as Record<string, number> | undefined;
  const ou = overview?.users as Record<string, number> | undefined;

  return (
    <div className="max-w-[900px] space-y-3 sm:space-y-4">
      <h2 className="flex items-center gap-2 text-white text-xl font-bold">
        <Icon name="ChartBar" size={22} color="var(--color-orange-400)" /> Platform Statistics
      </h2>

      <Panel scope="overview" titleIcon="TrendingUp" title="Overview">
        {overview && <>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
            {statCard('Posts', op?.total)}{statCard('Comments', oc?.total)}{statCard('Users', ou?.total)}{statCard('Pending', overview.pending)}{statCard('Approved', op?.approved)}{statCard('Rejected', op?.rejected)}
          </div>
          <L><span className="text-white font-bold">{n(op?.total)}</span> total posts. <span className="text-white font-bold">{n(op?.submitted)}</span> submitted, <span className="text-white font-bold">{n(op?.approved)}</span> approved, <span className="text-white font-bold">{n(op?.rejected)}</span> rejected. <span className="text-white font-bold">{n(overview.pending)}</span> pending review.</L>
          <L><span className="text-white font-bold">{n(oc?.total)}</span> total comments, <span className="text-white font-bold">{n(oc?.today)}</span> today.</L>
          <L><span className="text-white font-bold">{n(ou?.total)}</span> anonymous users, <span className="text-white font-bold">{n(ou?.today)}</span> new today. <span className="text-white font-bold">{n((overview.trust as Record<string, number>)?.scholars)}</span> Scholars · <span className="text-white font-bold">{n((overview.trust as Record<string, number>)?.neutrals)}</span> Neutrals · <span className="text-white font-bold">{n((overview.trust as Record<string, number>)?.trolls)}</span> Trolls.</L>
          {((overview.trolls_active as number) || 0) > 0 && <L><Icon name="TriangleAlert" size={14} color="#e65100" /> <span className="text-white font-bold">{n(overview.trolls_active)}</span> trolls active in last 24 hours.</L>}
          {((overview as Record<string, unknown>).orphans_72h_no_guidance as number) > 0 && <L><Icon name="Circle" size={14} color="#f57c00" fill="#f57c00" /> <span className="text-white font-bold">{n((overview as Record<string, unknown>).orphans_72h_no_guidance)}</span> posts stuck pending over 72h without admin guidance.</L>}
          <L>Peak submission hour: <span className="text-white font-bold">{n((overview as Record<string, unknown>).peak_submission_hour)}:00</span> ({n((overview as Record<string, unknown>).peak_submission_hour_count)} submissions).</L>
        </>}
      </Panel>

      <Panel scope="health" titleIcon="HeartPulse" title="Platform Health">
        {panels.health.data ? ((): React.ReactNode => { const d = panels.health.data as Record<string, unknown>; const s = d.services as Record<string, unknown>; const mem = d.memory as Record<string, number>; const crons = d.crons as Record<string, Record<string, string>>;
          const ups = Number(d.uptime_seconds) || 0;
          const uptimeHrs = Math.floor(ups / 3600); const uptimeMin = Math.floor((ups % 3600) / 60);
          const leak = mem?.rss_mb > (mem?.heap_mb * 3) ? <><Icon name="TriangleAlert" size={14} color="#e65100" /> Possible memory leak (RSS 3x heap)</> : <><Icon name="Check" size={14} color="#2e7d32" /> Normal</>;
          return <>
            <L>Uptime: <span className="text-white font-bold">{uptimeHrs}h {uptimeMin}m</span>. Memory: <span className="text-white font-bold">{n(mem?.heap_mb)}</span> MB heap / <span className="text-white font-bold">{n(mem?.rss_mb)}</span> MB RSS \u2014 {leak}.</L>
            <L>MongoDB: <span className="text-white font-bold">{n(s?.mongodb)}</span> at <span className="text-white font-bold">{n(s?.mongodb_latency_ms)}ms</span>. Redis: <span className="text-white font-bold">{n(s?.redis)}</span> {s?.redis_memory_pct !== null && s?.redis_memory_pct !== undefined ? `at ${n(s?.redis_memory_pct)}% memory (${n(s?.redis_memory_mb)} MB)` : ''}. Elasticsearch: <span className="text-white font-bold">{n(s?.elasticsearch)}</span>.</L>
            <L>Cron Health:</L>
            {crons && Object.entries(crons).map(([k,v]) => { const hb = v as Record<string, string>; const status = hb.last_success ? <Icon name="Check" size={14} color="#2e7d32" /> : hb.last_error ? <Icon name="X" size={14} color="#c62828" /> : <Icon name="Hourglass" size={14} />; const last = hb.last_success ? ` (${formatTime(hb.last_success)})` : ''; return <L key={k}>  {status} <span className="text-white font-bold">{k}</span>{last}{hb.last_error ? ` \u2014 ${hb.last_error}` : ''}</L>; })}
            {d.affected_features && (d.affected_features as unknown[]).length > 0 && <>
              <L><Icon name="Circle" size={14} color="#d32f2f" fill="#d32f2f" /> <span className="text-white font-bold">{n(d.affected_features_count)}</span> features degraded due to service outages:</L>
              {(arr(d.affected_features) as Array<{ feature: string; degradation: string; depends_on: string[] }>).map(f => <L key={f.feature}>  \u2014 <span className="text-white font-bold">{f.feature}</span>: {f.degradation} (needs {f.depends_on.join(', ')})</L>)}
            </>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="content" titleIcon="Folders" title="Content Pipeline + Age Distribution">
        {panels.content.data ? ((): React.ReactNode => { const d = panels.content.data as Record<string, unknown>; const p = d.posts as Record<string, number>; const ag = d.approval_gap as Record<string, number>; const age = d.age_distribution as Record<string, number>; const tp = arr(d.throughput_7d) as Array<{ day: number; count: number }>;
          const gapContext = ag?.avg_hours ? (ag.avg_hours < 1 ? 'Same-day moderation (excellent).' : ag.avg_hours < 24 ? 'Within 24 hours (good).' : ag.avg_hours < 72 ? '2-3 days (acceptable).' : 'Over 3 days (backlog risk).') : '';
          return <>
            <H3>Posts</H3>
            <L>Total: <span className="text-white font-bold">{n(p?.total)}</span>. Submitted: <span className="text-white font-bold">{n(p?.submitted)}</span>. Approved: <span className="text-white font-bold">{n(p?.approved)}</span>. Rejected: <span className="text-white font-bold">{n(p?.rejected)}</span>. In revision: <span className="text-white font-bold">{n(p?.in_revision)}</span>.</L>
            <L>Throughput (7d): {tp.map(t => <span key={t.day}>Day {t.day}: <span className="text-white font-bold">{t.count}</span> · </span>)}</L>
            <L>Approval gap: avg <span className="text-white font-bold">{n(ag?.avg_hours)}h</span>, max <span className="text-white font-bold">{n(ag?.max_hours)}h</span>, min <span className="text-white font-bold">{n(ag?.min_hours)}h</span>. {gapContext}</L>
            <L>Comments: <span className="text-white font-bold">{n((d.comments as Record<string, number>)?.total)}</span> total, <span className="text-white font-bold">{n((d.comments as Record<string, number>)?.today)}</span> today, <span className="text-white font-bold">{n((d.comments as Record<string, number>)?.this_week)}</span> this week.</L>
            <H3>Age Distribution</H3>
            {age && Object.entries(age).map(([k,v]) => <L key={k}>{k}: <span className="text-white font-bold">{v}</span> posts</L>)}
            {(!age || Object.keys(age).length === 0) && <L>No age data yet.</L>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="community" titleIcon="Users" title="Community + Fan-Out">
        {panels.community.data ? ((): React.ReactNode => { const d = panels.community.data as Record<string, unknown>; const u = d.users as Record<string, number>; const tr = d.trust as Record<string, number>; const ti = d.user_tiers as Record<string, number>;
          return <>
            <L>Total users: <span className="text-white font-bold">{n(u?.total)}</span>. New today: <span className="text-white font-bold">{n(u?.new_today)}</span>. New this week: <span className="text-white font-bold">{n(u?.new_this_week)}</span>.</L>
            <L>Active (30d): <span className="text-white font-bold">{n(u?.active_30d)}</span> ({n(d.active_pct)}%). Lurkers: <span className="text-white font-bold">{n(d.lurkers)}</span> ({n(d.lurker_pct)}%).</L>
            <L>Scholars: <span className="text-white font-bold">{n(tr?.scholars)}</span>. Neutrals: <span className="text-white font-bold">{n(tr?.neutrals)}</span>. Trolls: <span className="text-white font-bold">{n(tr?.trolls)}</span>. Trolls active 24h: <span className="text-white font-bold">{n(d.trolls_active_24h)}</span>.</L>
            <L>Churn: <span className="text-white font-bold">{n(d.churn_pct)}%</span>. Maturity: <span className="text-white font-bold">{n(d.maturity_pct)}%</span>. New user conversion (24h): <span className="text-white font-bold">{n(d.new_user_conversion_24h_pct)}%</span>.</L>
            <L>Fan-out: <span className="text-white font-bold">{n(d.fan_out)}</span> posts/active user. Pareto: <span className="text-white font-bold">{n(d.pareto_pct)}%</span> posts from top 5 users.</L>
            {ti && <L>Tiers: <span className="text-white font-bold">{n(ti?.casual)}</span> casual (1-2 posts) · <span className="text-white font-bold">{n(ti?.regular)}</span> regular (3-9) · <span className="text-white font-bold">{n(ti?.power)}</span> power (10+).</L>}
            <L>Retained creators: <span className="text-white font-bold">{n(d.retained_creators)}</span>. Deep lurkers (10+ visits, 0 posts): <span className="text-white font-bold">{n(d.lurker_depth_10plus)}</span>.</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="moderation" titleIcon="Clock" title="Moderation + Velocity">
        {panels.moderation.data ? ((): React.ReactNode => { const d = panels.moderation.data as Record<string, unknown>; const pq = d.pending_queue as Record<string, number>; const qv = d.queue_velocity as Record<string, number>; const wv = d.weekend_vs_weekday as Record<string, number>; const rbd = arr(d.reviews_by_day_of_week) as Array<{ day: number; count: number }>;
          const dayNames: Record<string, string> = { '1': 'Sun', '2': 'Mon', '3': 'Tue', '4': 'Wed', '5': 'Thu', '6': 'Fri', '7': 'Sat' };
          const vContext = qv?.days_to_clear ? (qv.days_to_clear <= 1 ? 'Queue will clear within a day.' : qv.days_to_clear <= 3 ? 'Manageable \u2014 clears within 3 days.' : 'Backlog \u2014 may take over 3 days.') : '';
          const flipContext = (d.decision_flips as number) > 0 ? <><Icon name="TriangleAlert" size={14} color="#e65100" /> {n(d.decision_flips)} posts changed from approved to rejected. Review these.</> : <><Icon name="Check" size={14} color="#2e7d32" /> No approval reversals.</>;
          return <>
            <L>Pending: <span className="text-white font-bold">{n(pq?.total)}</span> posts. Oldest: <span className="text-white font-bold">{n(pq?.oldest_age_hours)}h</span> old.</L>
            <L>Today: <span className="text-white font-bold">{n(d.reviews_today)}</span> reviews \u2014 <span className="text-white font-bold">{n(d.approved_today)}</span> approved, <span className="text-white font-bold">{n(d.rejected_today)}</span> rejected, <span className="text-white font-bold">{n(d.retry_today)}</span> revision requests sent.</L>
            <L>Velocity: avg <span className="text-white font-bold">{n(qv?.avg_reviews_per_day)}</span> reviews per day. {vContext}</L>
            <L>Peak moderation hour: <span className="text-white font-bold">{d.peak_moderation_hour !== null && d.peak_moderation_hour !== undefined ? `${d.peak_moderation_hour}:00 UTC` : 'N/A'}</span>.</L>
            {rbd.length > 0 && <><H3>Reviews by Day of Week</H3>{rbd.map(d => <L key={d.day}><span className="text-white font-bold">{dayNames[String(d.day)] || d.day}</span>: {d.count} reviews</L>)}</>}
            {wv && <L>Weekend share: <span className="text-white font-bold">{n(wv?.weekend)}</span> reviews ({n(wv?.weekend_pct)}%) vs weekday <span className="text-white font-bold">{n(wv?.weekday)}</span>.</L>}
            <L>{flipContext}</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="categories" titleIcon="Folder" title="Category Heatmap">
        {panels.categories.data ? ((): React.ReactNode => { const d = panels.categories.data as Record<string, unknown>; const top = arr(d.top_by_posts) as Array<{ slug: string; post_count: number }>; const eng = arr(d.per_category_engagement) as Array<{ slug: string; post_count: number; avg_comments: number; avg_views: number }>;
          return <>
            <L>Utilization: <span className="text-white font-bold">{n(d.utilization_pct)}%</span>. Empty children: <span className="text-white font-bold">{n(d.empty_children)}</span>.</L>
            <H3>Top Categories</H3>
            {top.slice(0, 10).map(c => <L key={c.slug}><span className="text-white font-bold">{c.slug}</span>: {c.post_count} posts</L>)}
            <H3>Engagement Per Category</H3>
            {eng.slice(0, 10).map(c => <L key={c.slug}><span className="text-white font-bold">{c.slug}</span>: {c.post_count} posts, avg {Math.round(c.avg_comments)} comments, avg {Math.round(c.avg_views)} views</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="trends" titleIcon="TrendingDown" title="Trends with Deltas">
        {panels.trends.data ? ((): React.ReactNode => { const d = panels.trends.data as Record<string, unknown>; const weeks = arr(d.weeks) as Array<Record<string, unknown>>;
          const arrow = (dir: string) => dir === 'up' ? '\u2191' : dir === 'down' ? '\u2193' : '\u2192';
          const c = (col: string) => col === 'green' ? 'text-green-500' : col === 'red' ? 'text-red-500' : 'text-white/40';
          return <>
            {weeks.map(w => { const del = w.deltas as Record<string, { delta_pct: number; direction: string; color: string }> | undefined;
              return <L key={w.date as string}>
                <span className="text-white font-bold">{w.date as string}</span>
                {del && <span className="text-xs ml-2.5">
                  Posts <span className={c(del.posts_total?.color || 'grey')}>{arrow(del.posts_total?.direction || 'flat')}{del.posts_total?.delta_pct || 0}%</span> ·
                  Submitted <span className={c(del.posts_submitted?.color || 'grey')}>{arrow(del.posts_submitted?.direction || 'flat')}{del.posts_submitted?.delta_pct || 0}%</span> ·
                  Comments <span className={c(del.comments_total?.color || 'grey')}>{arrow(del.comments_total?.direction || 'flat')}{del.comments_total?.delta_pct || 0}%</span> ·
                  Users <span className={c(del.users_total?.color || 'grey')}>{arrow(del.users_total?.direction || 'flat')}{del.users_total?.delta_pct || 0}%</span> ·
                  Pending <span className={c(del.pending?.color || 'grey')}>{arrow(del.pending?.direction || 'flat')}{del.pending?.delta_pct || 0}%</span>
                </span>}
              </L>;
            })}
          </>;
        })() : null}
      </Panel>

      <Panel scope="quality" titleIcon="Check" title="Quality + Correlations">
        {panels.quality.data ? ((): React.ReactNode => { const d = panels.quality.data as Record<string, unknown>; const corr = arr(d.intro_length_correlation) as Array<{ bucket: string; count: number; avg_comments: number; avg_fire: number }>;
          return <>
            <L>Revision rate: <span className="text-white font-bold">{n(d.revision_rate)}%</span> of submissions requested revision.</L>
            <H3>Intro Length \u2192 Comments/Fire</H3>
            {corr.map(c => <L key={c.bucket}><span className="text-white font-bold">{c.bucket}</span>: {c.count} posts, avg {c.avg_comments} comments, avg {c.avg_fire} fire</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="traffic" titleIcon="Globe" title="Traffic Analytics">
        {panels.traffic.data ? ((): React.ReactNode => { const d = panels.traffic.data as Record<string, unknown>; const refs = arr(d.top_referrers) as Array<{ domain: string; count: number }>; const peaks = arr(d.peak_hours) as Array<{ hour: number; count: number }>; const countries = arr(d.countries) as Array<{ code: string; count: number; population: number; visits_per_million: number }>; const engaged = arr(d.top_engaged) as Array<{ slug: string; title: string; ratio: number }>; const items = arr(d.top_engaged_items) as Array<{ title: string; rank: number; comment_count: number }>; const newUser = arr(d.new_users_by_referrer) as Array<{ source: string; count: number }>; const paths = arr(d.top_paths) as Array<{ path: string; count: number }>;
          const browserStr = d.browsers ? Object.entries(d.browsers as Record<string, number>).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'N/A';
          const osStr = d.os ? Object.entries(d.os as Record<string, number>).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'N/A';
          const topCountry = countries[0]; const topCountryContext = topCountry && topCountry.visits_per_million ? `Highest per-capita: ${topCountry.code} at ${topCountry.visits_per_million} visits/million.` : '';
          return <>
            <L>Visits today: <span className="text-white font-bold">{n(d.visits_today)}</span>. Unique visitors: <span className="text-white font-bold">{n(d.unique_today)}</span>.</L>
            <L>Browsers: {browserStr}</L>
            <L>OS: {osStr}</L>
            {paths.length > 0 && <><H3>Top Pages</H3>{paths.map(p => <L key={p.path}><span className="text-white font-bold">{p.path}</span>: {p.count} visits</L>)}</>}
            {refs.length > 0 && <><H3>Top Referrers</H3>{refs.map(r => <L key={r.domain}><span className="text-white font-bold">{r.domain}</span>: {r.count} visits</L>)}</>}
            {countries.length > 0 && <><H3>Countries</H3>
              <L>{topCountryContext}</L>
              {countries.map(c => <L key={c.code}><span className="text-white font-bold">{c.code}</span>: {c.count} visits, pop {c.population ? (c.population / 1000000).toFixed(1) + 'M' : 'N/A'}, {c.visits_per_million !== null ? c.visits_per_million + '/M' : 'N/A'}</L>)}
            </>}
            {peaks.length > 0 && <><H3>Peak Hours (7d)</H3>{peaks.map(p => <L key={p.hour}><span className="text-white font-bold">{p.hour}:00 UTC</span>: {p.count} visits</L>)}</>}
            {engaged.length > 0 && <><H3>Top Engaged Posts</H3>{engaged.map(e => <L key={e.slug}><span className="text-white font-bold">{e.title}</span>: {e.ratio}% engagement</L>)}</>}
            {items.length > 0 && <><H3>Top Debated Items</H3>{items.map(i => <L key={`${i.rank}-${i.title}`}><span className="text-white font-bold">#{i.rank} {i.title}</span>: {i.comment_count} item-anchored comments</L>)}</>}
            {newUser.length > 0 && <><H3>New Users by Source</H3>{newUser.map(r => <L key={r.source}><span className="text-white font-bold">{r.source}</span>: {r.count} new users</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="submissions" titleIcon="PenLine" title="Submission Patterns">
        {panels.submissions.data ? ((): React.ReactNode => { const d = panels.submissions.data as Record<string, unknown>; const hr = arr(d.by_hour) as Array<{ hour: number; count: number }>; const tp = arr(d.by_type) as Array<{ type: string; count: number }>; const tm = d.type_migration as Record<string, unknown>;
          return <>
            <L>Avg items per post: <span className="text-white font-bold">{n(d.avg_items_per_post)}</span>.</L>
            {tp.length > 0 && <><H3>By Post Type</H3>{tp.map(t => <L key={t.type}><span className="text-white font-bold">{t.type}</span>: {t.count} posts</L>)}</>}
            {hr.length > 0 && <><H3>By Hour (7d)</H3>{hr.map(h => <L key={h.hour}><span className="text-white font-bold">{h.hour}:00</span>: {h.count} submissions</L>)}</>}
            {tm && <><H3>Type Migration</H3>
              <L>Multi-type users: <span className="text-white font-bold">{n(tm.multi_type_users)}</span>. Switched types: <span className="text-white font-bold">{n(tm.switched_types)}</span>.</L>
              {(arr(tm.paths) as Array<{ from: string; to: string; count: number }>).map(p => <L key={`${p.from}-${p.to}`}><span className="text-white font-bold">{p.from}</span> \u2192 <span className="text-white font-bold">{p.to}</span>: {p.count} users</L>)}
            </>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="lifecycle" titleIcon="RefreshCw" title="User Lifecycle">
        {panels.lifecycle.data ? ((): React.ReactNode => { const d = panels.lifecycle.data as Record<string, unknown>; const lc = arr(d.lifecycle) as Array<{ bucket: string; count: number }>; const drop = arr(d.drop_off_distribution) as Array<{ posts_made: number; users: number }>;
          return <>
            <L>Total posters: <span className="text-white font-bold">{n(d.total_posters)}</span>. Avg lifetime posts: <span className="text-white font-bold">{n(d.avg_lifetime_posts)}</span>.</L>
            <L>Activation gap (creation \u2192 first post): <span className="text-white font-bold">{n(d.activation_gap_hours)}h</span>. Converted within 24h: <span className="text-white font-bold">{n(d.converted_within_24h)}</span>.</L>
            <L>One-and-done rate: <span className="text-white font-bold">{n(d.one_and_done_pct)}%</span> (posted once, never returned).</L>
            {lc.length > 0 && <><H3>Time to Second Post</H3>{lc.map(b => <L key={b.bucket}><span className="text-white font-bold">{b.bucket}</span>: {b.count} users</L>)}</>}
            {drop.length > 0 && <><H3>Drop-off Distribution</H3>{drop.map(b => <L key={b.posts_made}>{b.posts_made} post(s): {b.users} users</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="lurkers" titleIcon="EyeOff" title="Lurker Analysis">
        {panels.lurkers.data ? ((): React.ReactNode => {
          const d = panels.lurkers.data as Record<string, unknown>;
          return <>
            <L>Total lurkers: <span className="text-white font-bold">{n(d.total_lurkers)}</span>.</L>
            <L>Ghosts (1 visit, never returned): <span className="text-white font-bold">{n(d.ghosts)}</span> ({n(d.ghosts_pct)}%).</L>
            <L>Repeat lurkers (2-10 visits): <span className="text-white font-bold">{n(d.repeat_lurkers)}</span> ({n(d.repeat_pct)}%).</L>
            <L>Deep lurkers (10+ visits, 0 posts): <span className="text-white font-bold">{n(d.deep_lurkers)}</span> ({n(d.deep_pct)}%).</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="conversion" titleIcon="RefreshCw" title="Lurker \u2192 Poster Conversion">
        {panels.conversion.data ? ((): React.ReactNode => { const d = panels.conversion.data as Record<string, unknown>; const paths = arr(d.converting_paths) as Array<{ path: string; count: number }>;
          return <>
            {paths.length === 0 ? <L>No conversion data yet \u2014 needs page visit traffic and user events.</L>
              : paths.map(p => <L key={p.path}><span className="text-white font-bold">{p.path}</span> converted {p.count} lurker(s) into posters</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="reengagement" titleIcon="Repeat" title="Re-Engagement Triggers">
        {panels.reengagement.data ? ((): React.ReactNode => { const d = panels.reengagement.data as Record<string, unknown>; const triggers = arr(d.triggers) as Array<{ path: string; count: number }>;
          return <>
            <L>Re-engaged users (30+ day gap): <span className="text-white font-bold">{n(d.reengaged_users)}</span>.</L>
            {triggers.map(t => <L key={t.path}><span className="text-white font-bold">{t.path}</span> triggered {t.count} re-engagement(s)</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="alerts" titleIcon="BellDot" title="Alerts">
        {panels.alerts.data ? ((): React.ReactNode => { const d = panels.alerts.data as Record<string, unknown>; const th = arr(d.thresholds) as Array<{ metric: string; threshold: number; operator: string; severity: string; enabled: boolean }>; const active = arr(d.active) as Array<{ metric: string; severity: string; value: number; threshold: number }>; const hist = arr(d.history) as Array<{ metric: string; severity: string; triggered_at: string; resolved_at: string | null }>;
          return <>
            {active.length > 0 && <><L><Icon name="Circle" size={14} color="#d32f2f" fill="#d32f2f" /> <span className="text-white font-bold">{active.length}</span> active alerts:</L>
              {active.map(a => <L key={a.metric}><Icon name="TriangleAlert" size={14} color="#e65100" /> <span className="text-white font-bold">{a.metric}</span>: {a.value} (threshold {a.threshold})</L>)}</>}
            {active.length === 0 && <L><Icon name="Check" size={14} color="#2e7d32" /> No active alerts.</L>}
            <H3>Thresholds</H3>
            {th.map(t => <L key={t.metric}><span className="text-white font-bold">{t.metric}</span>: {t.operator} {t.threshold} [{t.severity}] {t.enabled ? <Icon name="Check" size={14} color="#2e7d32" /> : <span className="text-white/40">(paused)</span>}</L>)}
            {hist.length > 0 && <><H3>Recent History</H3>{hist.slice(0, 5).map(h => <L key={`${h.metric}-${h.triggered_at}`}><span className="text-white font-bold">{h.metric}</span>: triggered <span suppressHydrationWarning>{formatDate(h.triggered_at)} {formatTime(h.triggered_at)}</span> {h.resolved_at ? <><Icon name="Check" size={12} color="#2e7d32" /> resolved</> : <><Icon name="Circle" size={12} color="#d32f2f" fill="#d32f2f" /> unresolved</>}</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="notifications" titleIcon="Bell" title="Notification Analytics">
        {panels.notifications.data ? ((): React.ReactNode => { const d = panels.notifications.data as Record<string, unknown>; const bt = arr(d.by_type) as Array<{ type: string; sent: number; delivered: number; clicked: number }>;
          return <>
            <L>Total sent: <span className="text-white font-bold">{n(d.total_sent)}</span>. Delivered: <span className="text-white font-bold">{n(d.total_delivered)}</span> ({n(d.delivery_rate)}%). Clicked: <span className="text-white font-bold">{n(d.total_clicked)}</span> ({n(d.click_rate)}%).</L>
            {bt.map(b => <L key={b.type}><span className="text-white font-bold">{b.type}</span>: {b.sent} sent, {b.delivered} delivered, {b.clicked} clicked</L>)}
          </>;
        })() : null}
      </Panel>

      {/* Search Analytics */}
      <Panel scope="search/overview" titleIcon="Search" title="Search Overview">
        {panels['search/overview'].data ? ((): React.ReactNode => {
          const d = panels['search/overview'].data as Record<string, unknown>;
          return <>
            <L>Today: <span className="text-white font-bold">{n(d.searches_today)}</span> searches by <span className="text-white font-bold">{n(d.unique_searchers_today)}</span> users. Zero results: <span className="text-white font-bold">{n(d.zero_result_today)}</span> ({n(d.zero_result_pct)}%).</L>
            {d.rollup && (() => { const r = d.rollup as Record<string, unknown>; return <>
              <H3>Yesterday&apos;s Rollup</H3>
              <L>Searches: <span className="text-white font-bold">{n(r.total_searches)}</span> · Unique: <span className="text-white font-bold">{n(r.unique_searchers)}</span> · Zero: <span className="text-white font-bold">{n(r.zero_result_searches)}</span> ({n(r.zero_result_pct)}%)</L>
              <L>Avg latency: <span className="text-white font-bold">{n(r.avg_response_time_ms)}ms</span> · P99: <span className="text-white font-bold">{n(r.p99_response_time_ms)}ms</span></L>
              <L>Avg query length: <span className="text-white font-bold">{n(r.query_length_avg)}</span> chars · CTR by top position: {(arr(r.ctr_by_position) as number[]).slice(0,5).join(', ')}</L>
              <L>Suggestion rate: <span className="text-white font-bold">{n(r.suggestion_rate)}%</span> · Accept rate: <span className="text-white font-bold">{n(r.suggestion_accept_rate)}%</span></L>
            </>; })()}
          </>;
        })() : null}
      </Panel>

      <Panel scope="search/queries" titleIcon="ChartBar" title="Top Queries">
        {panels['search/queries'].data ? ((): React.ReactNode => {
          const d = panels['search/queries'].data as Record<string, unknown>;
          const top = arr(d.top_queries) as Array<{ query: string; count: number; zero_result_pct: number }>;
          const zero = arr(d.zero_result_queries) as Array<{ query: string; count: number }>;
          return <>
            <L><span className="text-white font-bold">{n(d.total_searches)}</span> searches over <span className="text-white font-bold">{n(d.period_days)}</span> days.</L>
            <H3>Top Queries</H3>
            {top.slice(0, 10).map(q => <L key={q.query}><span className="text-white font-bold">{q.query}</span>: {q.count}x · {q.zero_result_pct}% zero</L>)}
            {zero.length > 0 && <><H3>Zero-Result Queries</H3>
            {zero.slice(0, 5).map(q => <L key={q.query}><span className="text-white font-bold">{q.query}</span>: {q.count}x</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="search/relevance" titleIcon="Target" title="Relevance">
        {panels['search/relevance'].data ? ((): React.ReactNode => {
          const d = panels['search/relevance'].data as Record<string, unknown>;
          const ctr = arr(d.ctr_by_position) as number[];
          const avg = d.avg_results as Record<string, number> | undefined;
          return <>
            <L><span className="text-white font-bold">{n(d.total_clicks)}</span> clicks from <span className="text-white font-bold">{n(d.total_searches)}</span> searches \u2192 <span className="text-white font-bold">{n(d.ctr)}%</span> CTR over <span className="text-white font-bold">{n(d.period_days)}</span> days.</L>
            <L>Avg results: <span className="text-white font-bold">{n(avg?.avg_posts)}</span> posts, <span className="text-white font-bold">{n(avg?.avg_comments)}</span> comments per search.</L>
            <H3>CTR by Position</H3>
            {ctr.slice(0, 5).map((c, i) => <L key={i}>Position <span className="text-white font-bold">#{i + 1}</span>: <span className="text-white font-bold">{c}</span> clicks</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="search/trends" titleIcon="TrendingUp" title="Search Trends">
        {panels['search/trends'].data ? ((): React.ReactNode => {
          const d = panels['search/trends'].data as Record<string, unknown>;
          const vol = arr(d.volume) as Array<{ date: string; count: number }>;
          const zr = arr(d.zero_result_rate) as Array<{ date: string; rate: number }>;
          return <>
            <L>Daily volume over <span className="text-white font-bold">{n(d.period_days)}</span> days:</L>
            <L>{vol.slice(0, 10).map(v => `${v.date}: ${v.count}`).join(' · ')}</L>
            <L>Zero-result rate trend: {zr.slice(0, 10).map(z => `${z.date}: ${z.rate}%`).join(' · ')}</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="search/infrastructure" titleIcon="Settings" title="Search Infrastructure">
        {panels['search/infrastructure'].data ? ((): React.ReactNode => {
          const d = panels['search/infrastructure'].data as Record<string, unknown>;
          const gap = arr(d.index_gap_trend) as Array<{ date: string; gap_pct: number; dlq: number }>;
          return <>
            <L>Avg latency: <span className="text-white font-bold">{n(d.avg_latency_ms)}ms</span> · P99: <span className="text-white font-bold">{n(d.p99_latency_ms)}ms</span></L>
            <L>Dead letter queue: <span className="text-white font-bold">{n(d.dead_letter_queue)}</span> documents awaiting retry</L>
            {gap.length > 0 && <><H3>Index Gap Trend</H3>
            {gap.slice(0, 10).map(g => <L key={g.date}>{g.date}: gap <span className="text-white font-bold">{g.gap_pct}%</span> · DLQ <span className="text-white font-bold">{g.dlq}</span></L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="search/behavior" titleIcon="User" title="Search Behavior">
        {panels['search/behavior'].data ? ((): React.ReactNode => {
          const d = panels['search/behavior'].data as Record<string, unknown>;
          return <>
            <L><span className="text-white font-bold">{n(d.search_sessions)}</span> search sessions over <span className="text-white font-bold">{n(d.period_days)}</span> days.</L>
            <L>Search-to-post ratio: <span className="text-white font-bold">{n(d.search_and_post_ratio)}%</span> of users who posted also searched.</L>
            <L>Total clicks from search: <span className="text-white font-bold">{n(d.total_clicks_from_search)}</span></L>
          </>;
        })() : null}
      </Panel>
    </div>
  );
}
