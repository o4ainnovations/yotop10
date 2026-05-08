'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface PanelState { loading: boolean; data: unknown; error?: string; open: boolean }

function n(v: unknown): string { if (v === null || v === undefined) return 'N/A'; return String(v); }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }

const L = ({ children }: { children: React.ReactNode }) => <div style={{ marginBottom: '4px', fontSize: '13px', lineHeight: '1.6' }}>{children}</div>;
const B = ({ children }: { children: React.ReactNode }) => <strong>{children}</strong>;
const T = ({ children }: { children: React.ReactNode }) => <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>{children}</h3>;

export default function StatisticsDashboard() {
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
  });

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
    if (!c.open && !c.data) fetchPanel(scope);
    return { ...prev, [scope]: { ...c, open: !c.open } };
  });

  const Panel = ({ scope, title, children }: { scope: string; title: string; children: React.ReactNode }) => {
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
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
        <button onClick={() => toggle(scope)} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: '#f5f5f5', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>{title}{hint}</span><span>{p.open ? '▾' : '▸'}</span>
        </button>
        {p.open && <div style={{ padding: '16px' }}>{p.loading ? <p>Loading...</p> : p.error ? <p style={{ color: 'red' }}>{p.error}</p> : children}</div>}
      </div>
    );
  };

  const card = (label: string, value: unknown) => (
    <div style={{ background: '#f9f9f9', padding: '14px', borderRadius: '8px', textAlign: 'center', flex: 1, minWidth: '90px' }}>
      <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{String(value ?? '—')}</div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{label}</div>
    </div>
  );

  const overview = panels.overview.data as Record<string, unknown> | null;
  const op = overview?.posts as Record<string, number> | undefined;
  const oc = overview?.comments as Record<string, number> | undefined;
  const ou = overview?.users as Record<string, number> | undefined;
  const ot = overview?.trust as Record<string, number> | undefined;

  return (<>
    <div style={{ maxWidth: '900px' }}>
      <h2>📊 Platform Statistics</h2>

      <Panel scope="overview" title="📈 Overview">
        {overview && <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {card('Posts', op?.total)}{card('Comments', oc?.total)}{card('Users', ou?.total)}{card('Pending', overview.pending)}{card('Approved', op?.approved)}{card('Rejected', op?.rejected)}
          </div>
          <L>📝 <B>{n(op?.total)}</B> total posts. <B>{n(op?.submitted)}</B> submitted, <B>{n(op?.approved)}</B> approved, <B>{n(op?.rejected)}</B> rejected. <B>{n(overview.pending)}</B> pending review.</L>
          <L>💬 <B>{n(oc?.total)}</B> total comments, <B>{n(oc?.today)}</B> today.</L>
          <L>👥 <B>{n(ou?.total)}</B> anonymous users, <B>{n(ou?.today)}</B> new today. <B>{n(ot?.scholars)}</B> Scholars · <B>{n(ot?.neutrals)}</B> Neutrals · <B>{n(ot?.trolls)}</B> Trolls.</L>
          {((overview.trolls_active as number) || 0) > 0 && <L>⚠️ <B>{n(overview.trolls_active)}</B> trolls active in last 24 hours.</L>}
          {((overview as Record<string, unknown>).orphans_72h_no_guidance as number) > 0 && <L>🟠 <B>{n((overview as Record<string, unknown>).orphans_72h_no_guidance)}</B> posts stuck pending over 72h without admin guidance.</L>}
          <L>⏰ Peak submission hour: <B>{n((overview as Record<string, unknown>).peak_submission_hour)}:00</B> ({n((overview as Record<string, unknown>).peak_submission_hour_count)} submissions).</L>
        </>}
      </Panel>

      <Panel scope="health" title="🫀 Platform Health">
        {panels.health.data ? ((): React.ReactNode => { const d = panels.health.data as Record<string, unknown>; const s = d.services as Record<string, unknown>; const mem = d.memory as Record<string, number>; const crons = d.crons as Record<string, Record<string, string>>;
          const ups = Number(d.uptime_seconds) || 0;
          const uptimeHrs = Math.floor(ups / 3600); const uptimeMin = Math.floor((ups % 3600) / 60);
          const leak = mem?.rss_mb > (mem?.heap_mb * 3) ? '⚠️ Possible memory leak (RSS 3x heap)' : '✅ Normal';
          return <>
            <L>⏱️ Uptime: <B>{uptimeHrs}h {uptimeMin}m</B>. Memory: <B>{n(mem?.heap_mb)}</B> MB heap / <B>{n(mem?.rss_mb)}</B> MB RSS — {leak}.</L>
            <L>🗄️ MongoDB: <B>{n(s?.mongodb)}</B> at <B>{n(s?.mongodb_latency_ms)}ms</B>. Redis: <B>{n(s?.redis)}</B> {s?.redis_memory_pct !== null && s?.redis_memory_pct !== undefined ? `at ${n(s?.redis_memory_pct)}% memory (${n(s?.redis_memory_mb)} MB)` : ''}. Elasticsearch: <B>{n(s?.elasticsearch)}</B>.</L>
            <L>🔄 Cron Health:</L>
            {crons && Object.entries(crons).map(([k,v]) => { const hb = v as Record<string, string>; const status = hb.last_success ? '✅' : hb.last_error ? '❌' : '⏳'; const last = hb.last_success ? ` (${new Date(hb.last_success).toLocaleTimeString()})` : ''; return <L key={k}>  {status} <B>{k}</B>{last}{hb.last_error ? ` — ${hb.last_error}` : ''}</L>; })}
            {((d.affected_features_count as number) || 0) > 0 && <>
              <L>🔴 <B>{n(d.affected_features_count)}</B> features degraded due to service outages:</L>
              {(arr(d.affected_features) as Array<{ feature: string; degradation: string; depends_on: string[] }>).map(f => <L key={f.feature}>  — <B>{f.feature}</B>: {f.degradation} (needs {f.depends_on.join(', ')})</L>)}
            </>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="content" title="📂 Content Pipeline + Age Distribution">
        {panels.content.data ? ((): React.ReactNode => { const d = panels.content.data as Record<string, unknown>; const p = d.posts as Record<string, number>; const ag = d.approval_gap as Record<string, number>; const age = d.age_distribution as Record<string, number>; const tp = arr(d.throughput_7d) as Array<{ day: number; count: number }>;
          const gapContext = ag?.avg_hours ? (ag.avg_hours < 1 ? 'Same-day moderation (excellent).' : ag.avg_hours < 24 ? 'Within 24 hours (good).' : ag.avg_hours < 72 ? '2-3 days (acceptable).' : 'Over 3 days (backlog risk).') : '';
          return <>
            <T>📝 Posts</T>
            <L>Total: <B>{n(p?.total)}</B>. Submitted: <B>{n(p?.submitted)}</B>. Approved: <B>{n(p?.approved)}</B>. Rejected: <B>{n(p?.rejected)}</B>. In revision: <B>{n(p?.in_revision)}</B>.</L>
            <L>Throughput (7d): {tp.map(t => <span key={t.day}>Day {t.day}: <B>{t.count}</B> · </span>)}</L>
            <L>Approval gap: avg <B>{n(ag?.avg_hours)}h</B>, max <B>{n(ag?.max_hours)}h</B>, min <B>{n(ag?.min_hours)}h</B>. {gapContext}</L>
            <L>Comments: <B>{n((d.comments as Record<string, number>)?.total)}</B> total, <B>{n((d.comments as Record<string, number>)?.today)}</B> today, <B>{n((d.comments as Record<string, number>)?.this_week)}</B> this week.</L>
            <T>📅 Age Distribution</T>
            {age && Object.entries(age).map(([k,v]) => <L key={k}>{k}: <B>{v}</B> posts</L>)}
            {(!age || Object.keys(age).length === 0) && <L>No age data yet.</L>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="community" title="👥 Community + Fan-Out">
        {panels.community.data ? ((): React.ReactNode => { const d = panels.community.data as Record<string, unknown>; const u = d.users as Record<string, number>; const tr = d.trust as Record<string, number>; const ti = d.user_tiers as Record<string, number>;
          return <>
            <L>Total users: <B>{n(u?.total)}</B>. New today: <B>{n(u?.new_today)}</B>. New this week: <B>{n(u?.new_this_week)}</B>.</L>
            <L>Active (30d): <B>{n(u?.active_30d)}</B> ({n(d.active_pct)}%). Lurkers: <B>{n(d.lurkers)}</B> ({n(d.lurker_pct)}%).</L>
            <L>Scholars: <B>{n(tr?.scholars)}</B>. Neutrals: <B>{n(tr?.neutrals)}</B>. Trolls: <B>{n(tr?.trolls)}</B>. Trolls active 24h: <B>{n(d.trolls_active_24h)}</B>.</L>
            <L>Churn: <B>{n(d.churn_pct)}%</B>. Maturity: <B>{n(d.maturity_pct)}%</B>. New user conversion (24h): <B>{n(d.new_user_conversion_24h_pct)}%</B>.</L>
            <L>Fan-out: <B>{n(d.fan_out)}</B> posts/active user. Pareto: <B>{n(d.pareto_pct)}%</B> posts from top 5 users.</L>
            {ti && <L>Tiers: <B>{n(ti?.casual)}</B> casual (1-2 posts) · <B>{n(ti?.regular)}</B> regular (3-9) · <B>{n(ti?.power)}</B> power (10+).</L>}
            <L>Retained creators: <B>{n(d.retained_creators)}</B>. Deep lurkers (10+ visits, 0 posts): <B>{n(d.lurker_depth_10plus)}</B>.</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="moderation" title="⏳ Moderation + Velocity">
        {panels.moderation.data ? ((): React.ReactNode => { const d = panels.moderation.data as Record<string, unknown>; const pq = d.pending_queue as Record<string, number>; const qv = d.queue_velocity as Record<string, number>; const wv = d.weekend_vs_weekday as Record<string, number>; const rbd = arr(d.reviews_by_day_of_week) as Array<{ day: number; count: number }>;
          const dayNames: Record<string, string> = { '1': 'Sun', '2': 'Mon', '3': 'Tue', '4': 'Wed', '5': 'Thu', '6': 'Fri', '7': 'Sat' };
          const vContext = qv?.days_to_clear ? (qv.days_to_clear <= 1 ? 'Queue will clear within a day.' : qv.days_to_clear <= 3 ? 'Manageable — clears within 3 days.' : 'Backlog — may take over 3 days.') : '';
          const flipContext = (d.decision_flips as number) > 0 ? `⚠️ ${n(d.decision_flips)} posts changed from approved to rejected. Review these.` : '✅ No approval reversals.';
          return <>
            <L>Pending: <B>{n(pq?.total)}</B> posts. Oldest: <B>{n(pq?.oldest_age_hours)}h</B> old.</L>
            <L>Today: <B>{n(d.reviews_today)}</B> reviews — <B>{n(d.approved_today)}</B> approved, <B>{n(d.rejected_today)}</B> rejected, <B>{n(d.retry_today)}</B> revision requests sent.</L>
            <L>Velocity: avg <B>{n(qv?.avg_reviews_per_day)}</B> reviews per day. {vContext}</L>
            <L>Peak moderation hour: <B>{d.peak_moderation_hour !== null && d.peak_moderation_hour !== undefined ? `${d.peak_moderation_hour}:00 UTC` : 'N/A'}</B>.</L>
            {rbd.length > 0 && <><T>Reviews by Day of Week</T>{rbd.map(d => <L key={d.day}><B>{dayNames[String(d.day)] || d.day}</B>: {d.count} reviews</L>)}</>}
            {wv && <L>Weekend share: <B>{n(wv?.weekend)}</B> reviews ({n(wv?.weekend_pct)}%) vs weekday <B>{n(wv?.weekday)}</B>.</L>}
            <L>{flipContext}</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="categories" title="📁 Category Heatmap">
        {panels.categories.data ? ((): React.ReactNode => { const d = panels.categories.data as Record<string, unknown>; const top = arr(d.top_by_posts) as Array<{ slug: string; post_count: number }>; const eng = arr(d.per_category_engagement) as Array<{ slug: string; post_count: number; avg_comments: number; avg_views: number }>;
          return <>
            <L>Utilization: <B>{n(d.utilization_pct)}%</B>. Empty children: <B>{n(d.empty_children)}</B>.</L>
            <T>Top Categories</T>
            {top.slice(0, 10).map(c => <L key={c.slug}><B>{c.slug}</B>: {c.post_count} posts</L>)}
            <T>Engagement Per Category</T>
            {eng.slice(0, 10).map(c => <L key={c.slug}><B>{c.slug}</B>: {c.post_count} posts, avg {Math.round(c.avg_comments)} comments, avg {Math.round(c.avg_views)} views</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="trends" title="📉 Trends with Deltas">
        {panels.trends.data ? ((): React.ReactNode => { const d = panels.trends.data as Record<string, unknown>; const weeks = arr(d.weeks) as Array<Record<string, unknown>>;
          const arrow = (dir: string) => dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
          const c = (col: string) => col === 'green' ? '#2e7d32' : col === 'red' ? '#c62828' : '#999';
          return <>
            {weeks.map(w => { const del = w.deltas as Record<string, { delta_pct: number; direction: string; color: string }> | undefined;
              return <L key={w.date as string}>
                📅 <B>{w.date as string}</B>
                {del && <span style={{ fontSize: '12px', marginLeft: '10px' }}>
                  Posts <span style={{ color: c(del.posts_total?.color || 'grey') }}>{arrow(del.posts_total?.direction || 'flat')}{del.posts_total?.delta_pct || 0}%</span> ·
                  Submitted <span style={{ color: c(del.posts_submitted?.color || 'grey') }}>{arrow(del.posts_submitted?.direction || 'flat')}{del.posts_submitted?.delta_pct || 0}%</span> ·
                  Comments <span style={{ color: c(del.comments_total?.color || 'grey') }}>{arrow(del.comments_total?.direction || 'flat')}{del.comments_total?.delta_pct || 0}%</span> ·
                  Users <span style={{ color: c(del.users_total?.color || 'grey') }}>{arrow(del.users_total?.direction || 'flat')}{del.users_total?.delta_pct || 0}%</span> ·
                  Pending <span style={{ color: c(del.pending?.color || 'grey') }}>{arrow(del.pending?.direction || 'flat')}{del.pending?.delta_pct || 0}%</span>
                </span>}
              </L>;
            })}
          </>;
        })() : null}
      </Panel>

      <Panel scope="quality" title="✅ Quality + Correlations">
        {panels.quality.data ? ((): React.ReactNode => { const d = panels.quality.data as Record<string, unknown>; const corr = arr(d.intro_length_correlation) as Array<{ bucket: string; count: number; avg_comments: number; avg_fire: number }>;
          return <>
            <L>Revision rate: <B>{n(d.revision_rate)}%</B> of submissions requested revision.</L>
            <T>Intro Length → Comments/Fire</T>
            {corr.map(c => <L key={c.bucket}><B>{c.bucket}</B>: {c.count} posts, avg {c.avg_comments} comments, avg {c.avg_fire} fire</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="traffic" title="🌐 Traffic Analytics">
        {panels.traffic.data ? ((): React.ReactNode => { const d = panels.traffic.data as Record<string, unknown>; const refs = arr(d.top_referrers) as Array<{ domain: string; count: number }>; const peaks = arr(d.peak_hours) as Array<{ hour: number; count: number }>; const countries = arr(d.countries) as Array<{ code: string; count: number; population: number; visits_per_million: number }>; const engaged = arr(d.top_engaged) as Array<{ slug: string; title: string; ratio: number }>; const items = arr(d.top_engaged_items) as Array<{ title: string; rank: number; comment_count: number }>; const newUser = arr(d.new_users_by_referrer) as Array<{ source: string; count: number }>; const paths = arr(d.top_paths) as Array<{ path: string; count: number }>;
          const browserStr = d.browsers ? Object.entries(d.browsers as Record<string, number>).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'N/A';
          const osStr = d.os ? Object.entries(d.os as Record<string, number>).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'N/A';
          const engageContext = engaged.length > 0 ? `Top post "${engaged[0]?.title}" has ${engaged[0]?.ratio}% engagement rate (comments+fire/views).` : '';
          const topCountry = countries[0]; const topCountryContext = topCountry && topCountry.visits_per_million ? `Highest per-capita: ${topCountry.code} at ${topCountry.visits_per_million} visits/million.` : '';
          return <>
            <L>Visits today: <B>{n(d.visits_today)}</B>. Unique visitors: <B>{n(d.unique_today)}</B>.</L>
            <L>🌐 Browsers: {browserStr}</L>
            <L>💻 OS: {osStr}</L>
            {paths.length > 0 && <><T>Top Pages</T>{paths.map(p => <L key={p.path}><B>{p.path}</B>: {p.count} visits</L>)}</>}
            {refs.length > 0 && <><T>Top Referrers</T>{refs.map(r => <L key={r.domain}><B>{r.domain}</B>: {r.count} visits</L>)}</>}
            {countries.length > 0 && <><T>Countries</T>
              <L>{topCountryContext}</L>
              {countries.map(c => <L key={c.code}><B>{c.code}</B>: {c.count} visits, pop {c.population ? (c.population / 1000000).toFixed(1) + 'M' : 'N/A'}, {c.visits_per_million !== null ? c.visits_per_million + '/M' : 'N/A'}</L>)}
            </>}
            {peaks.length > 0 && <><T>Peak Hours (7d)</T>{peaks.map(p => <L key={p.hour}><B>{p.hour}:00 UTC</B>: {p.count} visits</L>)}</>}
            {engaged.length > 0 && <><T>Top Engaged Posts</T>{engageContext && <L>{engageContext}</L>}{engaged.map(e => <L key={e.slug}><B>{e.title}</B>: {e.ratio}% engagement</L>)}</>}
            {items.length > 0 && <><T>Top Debated Items</T>{items.map(i => <L key={`${i.rank}-${i.title}`}><B>#{i.rank} {i.title}</B>: {i.comment_count} item-anchored comments</L>)}</>}
            {newUser.length > 0 && <><T>New Users by Source</T>{newUser.map(r => <L key={r.source}><B>{r.source}</B>: {r.count} new users</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="submissions" title="✍️ Submission Patterns">
        {panels.submissions.data ? ((): React.ReactNode => { const d = panels.submissions.data as Record<string, unknown>; const hr = arr(d.by_hour) as Array<{ hour: number; count: number }>; const tp = arr(d.by_type) as Array<{ type: string; count: number }>; const tm = d.type_migration as Record<string, unknown>;
          return <>
            <L>Avg items per post: <B>{n(d.avg_items_per_post)}</B>.</L>
            {tp.length > 0 && <><T>By Post Type</T>{tp.map(t => <L key={t.type}><B>{t.type}</B>: {t.count} posts</L>)}</>}
            {hr.length > 0 && <><T>By Hour (7d)</T>{hr.map(h => <L key={h.hour}><B>{h.hour}:00</B>: {h.count} submissions</L>)}</>}
            {tm && <><T>Type Migration</T>
              <L>Multi-type users: <B>{n(tm.multi_type_users)}</B>. Switched types: <B>{n(tm.switched_types)}</B>.</L>
              {(arr(tm.paths) as Array<{ from: string; to: string; count: number }>).map(p => <L key={`${p.from}-${p.to}`}><B>{p.from}</B> → <B>{p.to}</B>: {p.count} users</L>)}
            </>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="lifecycle" title="🔄 User Lifecycle">
        {panels.lifecycle.data ? ((): React.ReactNode => { const d = panels.lifecycle.data as Record<string, unknown>; const lc = arr(d.lifecycle) as Array<{ bucket: string; count: number }>; const drop = arr(d.drop_off_distribution) as Array<{ posts_made: number; users: number }>;
          return <>
            <L>Total posters: <B>{n(d.total_posters)}</B>. Avg lifetime posts: <B>{n(d.avg_lifetime_posts)}</B>.</L>
            <L>Activation gap (creation → first post): <B>{n(d.activation_gap_hours)}h</B>. Converted within 24h: <B>{n(d.converted_within_24h)}</B>.</L>
            <L>One-and-done rate: <B>{n(d.one_and_done_pct)}%</B> (posted once, never returned).</L>
            {lc.length > 0 && <><T>Time to Second Post</T>{lc.map(b => <L key={b.bucket}><B>{b.bucket}</B>: {b.count} users</L>)}</>}
            {drop.length > 0 && <><T>Drop-off Distribution</T>{drop.map(b => <L key={b.posts_made}>{b.posts_made} post(s): {b.users} users</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="lurkers" title="👻 Lurker Analysis">
        {panels.lurkers.data ? ((): React.ReactNode => { const d = panels.lurkers.data as Record<string, unknown>;
          return <>
            <L>Total lurkers: <B>{n(d.total_lurkers)}</B>.</L>
            <L>Ghosts (1 visit, never returned): <B>{n(d.ghosts)}</B> ({n(d.ghosts_pct)}%).</L>
            <L>Repeat lurkers (2-10 visits): <B>{n(d.repeat_lurkers)}</B> ({n(d.repeat_pct)}%).</L>
            <L>Deep lurkers (10+ visits, 0 posts): <B>{n(d.deep_lurkers)}</B> ({n(d.deep_pct)}%).</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="conversion" title="🔄 Lurker → Poster Conversion">
        {panels.conversion.data ? ((): React.ReactNode => { const d = panels.conversion.data as Record<string, unknown>; const paths = arr(d.converting_paths) as Array<{ path: string; count: number }>;
          return <>
            {paths.length === 0 ? <L>No conversion data yet — needs page visit traffic and user events.</L>
              : paths.map(p => <L key={p.path}><B>{p.path}</B> converted {p.count} lurker(s) into posters</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="reengagement" title="🔁 Re-Engagement Triggers">
        {panels.reengagement.data ? ((): React.ReactNode => { const d = panels.reengagement.data as Record<string, unknown>; const triggers = arr(d.triggers) as Array<{ path: string; count: number }>;
          return <>
            <L>Re-engaged users (30+ day gap): <B>{n(d.reengaged_users)}</B>.</L>
            {triggers.map(t => <L key={t.path}><B>{t.path}</B> triggered {t.count} re-engagement(s)</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="alerts" title="🚨 Alerts">
        {panels.alerts.data ? ((): React.ReactNode => { const d = panels.alerts.data as Record<string, unknown>; const th = arr(d.thresholds) as Array<{ metric: string; threshold: number; operator: string; severity: string; enabled: boolean }>; const active = arr(d.active) as Array<{ metric: string; severity: string; value: number; threshold: number }>; const hist = arr(d.history) as Array<{ metric: string; severity: string; triggered_at: string; resolved_at: string | null }>;
          return <>
            {active.length > 0 && <><L>🔴 <B>{active.length}</B> active alerts:</L>
              {active.map(a => <L key={a.metric}>⚠️ <B>{a.metric}</B>: {a.value} (threshold {a.threshold})</L>)}</>}
            {active.length === 0 && <L>✅ No active alerts.</L>}
            <T>Thresholds</T>
            {th.map(t => <L key={t.metric}><B>{t.metric}</B>: {t.operator} {t.threshold} [{t.severity}] {t.enabled ? '✅' : '⏸️'}</L>)}
            {hist.length > 0 && <><T>Recent History</T>{hist.slice(0, 5).map(h => <L key={`${h.metric}-${h.triggered_at}`}><B>{h.metric}</B>: triggered {new Date(h.triggered_at).toLocaleString()} {h.resolved_at ? '✅ resolved' : '🔴 unresolved'}</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="notifications" title="🔔 Notification Analytics">
        {panels.notifications.data ? ((): React.ReactNode => { const d = panels.notifications.data as Record<string, unknown>; const bt = arr(d.by_type) as Array<{ type: string; sent: number; delivered: number; clicked: number }>;
          return <>
            <L>Total sent: <B>{n(d.total_sent)}</B>. Delivered: <B>{n(d.total_delivered)}</B> ({n(d.delivery_rate)}%). Clicked: <B>{n(d.total_clicked)}</B> ({n(d.click_rate)}%).</L>
            {bt.map(b => <L key={b.type}><B>{b.type}</B>: {b.sent} sent, {b.delivered} delivered, {b.clicked} clicked</L>)}
          </>;
        })() : null}
      </Panel>

    </div>
  </>);
}
