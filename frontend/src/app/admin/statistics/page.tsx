'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Icon, type LucideIconName } from '@/components/icons/Icon';

interface PanelState { loading: boolean; data: unknown; error?: string; open: boolean }

function n(v: unknown): string { if (v === null || v === undefined) return 'N/A'; return String(v); }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }

const L = ({ children }: { children: React.ReactNode }) => <div style={{ marginBottom: '4px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>{children}</div>;
const Heading = ({ children }: { children: React.ReactNode }) => <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', color: 'var(--text-primary)' }}>{children}</h3>;

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
    'search/overview': { loading: false, data: null, open: false },
    'search/queries': { loading: false, data: null, open: false },
    'search/relevance': { loading: false, data: null, open: false },
    'search/trends': { loading: false, data: null, open: false },
    'search/infrastructure': { loading: false, data: null, open: false },
    'search/behavior': { loading: false, data: null, open: false },
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

  const Panel = ({ scope, title, titleIcon, children }: { scope: string; title: string; titleIcon?: LucideIconName; children: React.ReactNode }) => {
    const p = panels[scope];
    const overview = panels.overview.data as Record<string, unknown> | null;
    let hint = '';
    if (!p.open && overview && scope !== 'overview') {
      const ov = overview as Record<string, unknown>;
      if (scope === 'health') hint = ` \u25B8 ${n((ov.services as Record<string, unknown>)?.mongodb)}`;
      else if (scope === 'content') hint = ` \u25B8 ${n((ov.posts as Record<string, number>)?.total)} posts`;
      else if (scope === 'community') hint = ` \u25B8 ${n((ov.users as Record<string, number>)?.total)} users`;
      else if (scope === 'moderation') hint = ` \u25B8 ${n(ov.pending)} pending`;
    }
    return (
      <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', marginBottom: '12px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
        <button onClick={() => toggle(scope)} style={{ width: '100%', textAlign: 'left', padding: '14px 18px', background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
          <span>{titleIcon && <><Icon name={titleIcon} size={16} color="var(--accent)" /> </>}{title.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2702}-\u{27B0}\u{1F900}-\u{1F9FF}\u{2000}-\u{3300}\u{FE00}-\u{FEFF}]+/u, '').trim()}{hint}</span>
          <span style={{ color: 'var(--text-muted)' }}>{p.open ? '\u25BE' : '\u25B8'}</span>
        </button>
        {p.open && <div style={{ padding: '18px' }}>{p.loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : p.error ? <p style={{ color: '#c62828' }}>{p.error}</p> : children}</div>}
      </div>
    );
  };

  const card = (label: string, value: unknown) => (
    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'center', flex: 1, minWidth: '90px' }}>
      <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{String(value ?? '\u2014')}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
    </div>
  );

  const overview = panels.overview.data as Record<string, unknown> | null;
  const op = overview?.posts as Record<string, number> | undefined;
  const oc = overview?.comments as Record<string, number> | undefined;
  const ou = overview?.users as Record<string, number> | undefined;

  return (<>
    <div style={{ maxWidth: '900px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
        <Icon name="ChartBar" size={22} color="var(--accent)" /> Platform Statistics
      </h2>

      <Panel scope="overview" titleIcon="TrendingUp" title="Overview">
        {overview && <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {card('Posts', op?.total)}{card('Comments', oc?.total)}{card('Users', ou?.total)}{card('Pending', overview.pending)}{card('Approved', op?.approved)}{card('Rejected', op?.rejected)}
          </div>
          <L><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(op?.total)}</span> total posts. <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(op?.submitted)}</span> submitted, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(op?.approved)}</span> approved, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(op?.rejected)}</span> rejected. <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(overview.pending)}</span> pending review.</L>
          <L><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(oc?.total)}</span> total comments, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(oc?.today)}</span> today.</L>
          <L><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(ou?.total)}</span> anonymous users, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(ou?.today)}</span> new today. <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n((overview.trust as Record<string, number>)?.scholars)}</span> Scholars · <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n((overview.trust as Record<string, number>)?.neutrals)}</span> Neutrals · <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n((overview.trust as Record<string, number>)?.trolls)}</span> Trolls.</L>
          {((overview.trolls_active as number) || 0) > 0 && <L><Icon name="TriangleAlert" size={14} color="#e65100" /> <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(overview.trolls_active)}</span> trolls active in last 24 hours.</L>}
          {((overview as Record<string, unknown>).orphans_72h_no_guidance as number) > 0 && <L><Icon name="Circle" size={14} color="#f57c00" fill="#f57c00" /> <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n((overview as Record<string, unknown>).orphans_72h_no_guidance)}</span> posts stuck pending over 72h without admin guidance.</L>}
          <L>Peak submission hour: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n((overview as Record<string, unknown>).peak_submission_hour)}:00</span> ({n((overview as Record<string, unknown>).peak_submission_hour_count)} submissions).</L>
        </>}
      </Panel>

      <Panel scope="health" titleIcon="HeartPulse" title="Platform Health">
        {panels.health.data ? ((): React.ReactNode => { const d = panels.health.data as Record<string, unknown>; const s = d.services as Record<string, unknown>; const mem = d.memory as Record<string, number>; const crons = d.crons as Record<string, Record<string, string>>;
          const ups = Number(d.uptime_seconds) || 0;
          const uptimeHrs = Math.floor(ups / 3600); const uptimeMin = Math.floor((ups % 3600) / 60);
          const leak = mem?.rss_mb > (mem?.heap_mb * 3) ? <><Icon name="TriangleAlert" size={14} color="#e65100" /> Possible memory leak (RSS 3x heap)</> : <><Icon name="Check" size={14} color="#2e7d32" /> Normal</>;
          return <>
            <L>Uptime: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{uptimeHrs}h {uptimeMin}m</span>. Memory: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(mem?.heap_mb)}</span> MB heap / <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(mem?.rss_mb)}</span> MB RSS — {leak}.</L>
            <L>MongoDB: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(s?.mongodb)}</span> at <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(s?.mongodb_latency_ms)}ms</span>. Redis: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(s?.redis)}</span> {s?.redis_memory_pct !== null && s?.redis_memory_pct !== undefined ? `at ${n(s?.redis_memory_pct)}% memory (${n(s?.redis_memory_mb)} MB)` : ''}. Elasticsearch: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(s?.elasticsearch)}</span>.</L>
            <L>Cron Health:</L>
            {crons && Object.entries(crons).map(([k,v]) => { const hb = v as Record<string, string>; const status = hb.last_success ? <Icon name="Check" size={14} color="#2e7d32" /> : hb.last_error ? <Icon name="X" size={14} color="#c62828" /> : <Icon name="Hourglass" size={14} />; const last = hb.last_success ? ` (${new Date(hb.last_success).toLocaleTimeString()})` : ''; return <L key={k}>  {status} <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{k}</span>{last}{hb.last_error ? ` — ${hb.last_error}` : ''}</L>; })}
              <L><Icon name="Circle" size={14} color="#d32f2f" fill="#d32f2f" /> <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.affected_features_count)}</span> features degraded due to service outages:</L>
              {(arr(d.affected_features) as Array<{ feature: string; degradation: string; depends_on: string[] }>).map(f => <L key={f.feature}>  — <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{f.feature}</span>: {f.degradation} (needs {f.depends_on.join(', ')})</L>)}
            </>;
        })() : null}
      </Panel>

      <Panel scope="content" titleIcon="Folders" title="Content Pipeline + Age Distribution">
        {panels.content.data ? ((): React.ReactNode => { const d = panels.content.data as Record<string, unknown>; const p = d.posts as Record<string, number>; const ag = d.approval_gap as Record<string, number>; const age = d.age_distribution as Record<string, number>; const tp = arr(d.throughput_7d) as Array<{ day: number; count: number }>;
          const gapContext = ag?.avg_hours ? (ag.avg_hours < 1 ? 'Same-day moderation (excellent).' : ag.avg_hours < 24 ? 'Within 24 hours (good).' : ag.avg_hours < 72 ? '2-3 days (acceptable).' : 'Over 3 days (backlog risk).') : '';
          return <>
            <Heading>Posts</Heading>
            <L>Total: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(p?.total)}</span>. Submitted: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(p?.submitted)}</span>. Approved: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(p?.approved)}</span>. Rejected: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(p?.rejected)}</span>. In revision: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(p?.in_revision)}</span>.</L>
            <L>Throughput (7d): {tp.map(t => <span key={t.day}>Day {t.day}: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{t.count}</span> · </span>)}</L>
            <L>Approval gap: avg <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(ag?.avg_hours)}h</span>, max <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(ag?.max_hours)}h</span>, min <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(ag?.min_hours)}h</span>. {gapContext}</L>
            <L>Comments: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n((d.comments as Record<string, number>)?.total)}</span> total, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n((d.comments as Record<string, number>)?.today)}</span> today, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n((d.comments as Record<string, number>)?.this_week)}</span> this week.</L>
            <Heading>Age Distribution</Heading>
            {age && Object.entries(age).map(([k,v]) => <L key={k}>{k}: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{v}</span> posts</L>)}
            {(!age || Object.keys(age).length === 0) && <L>No age data yet.</L>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="community" titleIcon="Users" title="Community + Fan-Out">
        {panels.community.data ? ((): React.ReactNode => { const d = panels.community.data as Record<string, unknown>; const u = d.users as Record<string, number>; const tr = d.trust as Record<string, number>; const ti = d.user_tiers as Record<string, number>;
          return <>
            <L>Total users: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(u?.total)}</span>. New today: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(u?.new_today)}</span>. New this week: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(u?.new_this_week)}</span>.</L>
            <L>Active (30d): <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(u?.active_30d)}</span> ({n(d.active_pct)}%). Lurkers: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.lurkers)}</span> ({n(d.lurker_pct)}%).</L>
            <L>Scholars: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(tr?.scholars)}</span>. Neutrals: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(tr?.neutrals)}</span>. Trolls: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(tr?.trolls)}</span>. Trolls active 24h: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.trolls_active_24h)}</span>.</L>
            <L>Churn: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.churn_pct)}%</span>. Maturity: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.maturity_pct)}%</span>. New user conversion (24h): <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.new_user_conversion_24h_pct)}%</span>.</L>
            <L>Fan-out: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.fan_out)}</span> posts/active user. Pareto: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.pareto_pct)}%</span> posts from top 5 users.</L>
            {ti && <L>Tiers: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(ti?.casual)}</span> casual (1-2 posts) · <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(ti?.regular)}</span> regular (3-9) · <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(ti?.power)}</span> power (10+).</L>}
            <L>Retained creators: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.retained_creators)}</span>. Deep lurkers (10+ visits, 0 posts): <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.lurker_depth_10plus)}</span>.</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="moderation" titleIcon="Clock" title="Moderation + Velocity">
        {panels.moderation.data ? ((): React.ReactNode => { const d = panels.moderation.data as Record<string, unknown>; const pq = d.pending_queue as Record<string, number>; const qv = d.queue_velocity as Record<string, number>; const wv = d.weekend_vs_weekday as Record<string, number>; const rbd = arr(d.reviews_by_day_of_week) as Array<{ day: number; count: number }>;
          const dayNames: Record<string, string> = { '1': 'Sun', '2': 'Mon', '3': 'Tue', '4': 'Wed', '5': 'Thu', '6': 'Fri', '7': 'Sat' };
          const vContext = qv?.days_to_clear ? (qv.days_to_clear <= 1 ? 'Queue will clear within a day.' : qv.days_to_clear <= 3 ? 'Manageable — clears within 3 days.' : 'Backlog — may take over 3 days.') : '';
          const flipContext = (d.decision_flips as number) > 0 ? <><Icon name="TriangleAlert" size={14} color="#e65100" /> {n(d.decision_flips)} posts changed from approved to rejected. Review these.</> : <><Icon name="Check" size={14} color="#2e7d32" /> No approval reversals.</>;
          return <>
            <L>Pending: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(pq?.total)}</span> posts. Oldest: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(pq?.oldest_age_hours)}h</span> old.</L>
            <L>Today: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.reviews_today)}</span> reviews — <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.approved_today)}</span> approved, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.rejected_today)}</span> rejected, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.retry_today)}</span> revision requests sent.</L>
            <L>Velocity: avg <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(qv?.avg_reviews_per_day)}</span> reviews per day. {vContext}</L>
            <L>Peak moderation hour: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{d.peak_moderation_hour !== null && d.peak_moderation_hour !== undefined ? `${d.peak_moderation_hour}:00 UTC` : 'N/A'}</span>.</L>
            {rbd.length > 0 && <><Heading>Reviews by Day of Week</Heading>{rbd.map(d => <L key={d.day}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{dayNames[String(d.day)] || d.day}</span>: {d.count} reviews</L>)}</>}
            {wv && <L>Weekend share: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(wv?.weekend)}</span> reviews ({n(wv?.weekend_pct)}%) vs weekday <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(wv?.weekday)}</span>.</L>}
            <L>{flipContext}</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="categories" titleIcon="Folder" title="Category Heatmap">
        {panels.categories.data ? ((): React.ReactNode => { const d = panels.categories.data as Record<string, unknown>; const top = arr(d.top_by_posts) as Array<{ slug: string; post_count: number }>; const eng = arr(d.per_category_engagement) as Array<{ slug: string; post_count: number; avg_comments: number; avg_views: number }>;
          return <>
            <L>Utilization: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.utilization_pct)}%</span>. Empty children: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.empty_children)}</span>.</L>
            <Heading>Top Categories</Heading>
            {top.slice(0, 10).map(c => <L key={c.slug}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{c.slug}</span>: {c.post_count} posts</L>)}
            <Heading>Engagement Per Category</Heading>
            {eng.slice(0, 10).map(c => <L key={c.slug}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{c.slug}</span>: {c.post_count} posts, avg {Math.round(c.avg_comments)} comments, avg {Math.round(c.avg_views)} views</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="trends" titleIcon="TrendingDown" title="Trends with Deltas">
        {panels.trends.data ? ((): React.ReactNode => { const d = panels.trends.data as Record<string, unknown>; const weeks = arr(d.weeks) as Array<Record<string, unknown>>;
          const arrow = (dir: string) => dir === 'up' ? '\u2191' : dir === 'down' ? '\u2193' : '\u2192';
          const c = (col: string) => col === 'green' ? '#2e7d32' : col === 'red' ? '#c62828' : 'var(--text-muted)';
          return <>
            {weeks.map(w => { const del = w.deltas as Record<string, { delta_pct: number; direction: string; color: string }> | undefined;
              return <L key={w.date as string}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{w.date as string}</span>
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

      <Panel scope="quality" titleIcon="Check" title="Quality + Correlations">
        {panels.quality.data ? ((): React.ReactNode => { const d = panels.quality.data as Record<string, unknown>; const corr = arr(d.intro_length_correlation) as Array<{ bucket: string; count: number; avg_comments: number; avg_fire: number }>;
          return <>
            <L>Revision rate: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.revision_rate)}%</span> of submissions requested revision.</L>
            <Heading>Intro Length \u2192 Comments/Fire</Heading>
            {corr.map(c => <L key={c.bucket}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{c.bucket}</span>: {c.count} posts, avg {c.avg_comments} comments, avg {c.avg_fire} fire</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="traffic" titleIcon="Globe" title="Traffic Analytics">
        {panels.traffic.data ? ((): React.ReactNode => { const d = panels.traffic.data as Record<string, unknown>; const refs = arr(d.top_referrers) as Array<{ domain: string; count: number }>; const peaks = arr(d.peak_hours) as Array<{ hour: number; count: number }>; const countries = arr(d.countries) as Array<{ code: string; count: number; population: number; visits_per_million: number }>; const engaged = arr(d.top_engaged) as Array<{ slug: string; title: string; ratio: number }>; const items = arr(d.top_engaged_items) as Array<{ title: string; rank: number; comment_count: number }>; const newUser = arr(d.new_users_by_referrer) as Array<{ source: string; count: number }>; const paths = arr(d.top_paths) as Array<{ path: string; count: number }>;
          const browserStr = d.browsers ? Object.entries(d.browsers as Record<string, number>).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'N/A';
          const osStr = d.os ? Object.entries(d.os as Record<string, number>).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'N/A';
          const topCountry = countries[0]; const topCountryContext = topCountry && topCountry.visits_per_million ? `Highest per-capita: ${topCountry.code} at ${topCountry.visits_per_million} visits/million.` : '';
          return <>
            <L>Visits today: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.visits_today)}</span>. Unique visitors: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.unique_today)}</span>.</L>
            <L>Browsers: {browserStr}</L>
            <L>OS: {osStr}</L>
            {paths.length > 0 && <><Heading>Top Pages</Heading>{paths.map(p => <L key={p.path}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{p.path}</span>: {p.count} visits</L>)}</>}
            {refs.length > 0 && <><Heading>Top Referrers</Heading>{refs.map(r => <L key={r.domain}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{r.domain}</span>: {r.count} visits</L>)}</>}
            {countries.length > 0 && <><Heading>Countries</Heading>
              <L>{topCountryContext}</L>
              {countries.map(c => <L key={c.code}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{c.code}</span>: {c.count} visits, pop {c.population ? (c.population / 1000000).toFixed(1) + 'M' : 'N/A'}, {c.visits_per_million !== null ? c.visits_per_million + '/M' : 'N/A'}</L>)}
            </>}
            {peaks.length > 0 && <><Heading>Peak Hours (7d)</Heading>{peaks.map(p => <L key={p.hour}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{p.hour}:00 UTC</span>: {p.count} visits</L>)}</>}
            {engaged.length > 0 && <><Heading>Top Engaged Posts</Heading>{engaged.map(e => <L key={e.slug}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{e.title}</span>: {e.ratio}% engagement</L>)}</>}
            {items.length > 0 && <><Heading>Top Debated Items</Heading>{items.map(i => <L key={`${i.rank}-${i.title}`}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>#{i.rank} {i.title}</span>: {i.comment_count} item-anchored comments</L>)}</>}
            {newUser.length > 0 && <><Heading>New Users by Source</Heading>{newUser.map(r => <L key={r.source}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{r.source}</span>: {r.count} new users</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="submissions" titleIcon="PenLine" title="Submission Patterns">
        {panels.submissions.data ? ((): React.ReactNode => { const d = panels.submissions.data as Record<string, unknown>; const hr = arr(d.by_hour) as Array<{ hour: number; count: number }>; const tp = arr(d.by_type) as Array<{ type: string; count: number }>; const tm = d.type_migration as Record<string, unknown>;
          return <>
            <L>Avg items per post: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.avg_items_per_post)}</span>.</L>
            {tp.length > 0 && <><Heading>By Post Type</Heading>{tp.map(t => <L key={t.type}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{t.type}</span>: {t.count} posts</L>)}</>}
            {hr.length > 0 && <><Heading>By Hour (7d)</Heading>{hr.map(h => <L key={h.hour}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{h.hour}:00</span>: {h.count} submissions</L>)}</>}
            {tm && <><Heading>Type Migration</Heading>
              <L>Multi-type users: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(tm.multi_type_users)}</span>. Switched types: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(tm.switched_types)}</span>.</L>
              {(arr(tm.paths) as Array<{ from: string; to: string; count: number }>).map(p => <L key={`${p.from}-${p.to}`}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{p.from}</span> \u2192 <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{p.to}</span>: {p.count} users</L>)}
            </>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="lifecycle" titleIcon="RefreshCw" title="User Lifecycle">
        {panels.lifecycle.data ? ((): React.ReactNode => { const d = panels.lifecycle.data as Record<string, unknown>; const lc = arr(d.lifecycle) as Array<{ bucket: string; count: number }>; const drop = arr(d.drop_off_distribution) as Array<{ posts_made: number; users: number }>;
          return <>
            <L>Total posters: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_posters)}</span>. Avg lifetime posts: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.avg_lifetime_posts)}</span>.</L>
            <L>Activation gap (creation \u2192 first post): <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.activation_gap_hours)}h</span>. Converted within 24h: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.converted_within_24h)}</span>.</L>
            <L>One-and-done rate: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.one_and_done_pct)}%</span> (posted once, never returned).</L>
            {lc.length > 0 && <><Heading>Time to Second Post</Heading>{lc.map(b => <L key={b.bucket}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{b.bucket}</span>: {b.count} users</L>)}</>}
            {drop.length > 0 && <><Heading>Drop-off Distribution</Heading>{drop.map(b => <L key={b.posts_made}>{b.posts_made} post(s): {b.users} users</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="lurkers" titleIcon="EyeOff" title="Lurker Analysis">
        {panels.lurkers.data ? ((): React.ReactNode => { const d = panels.lurkers.data as Record<string, unknown>;
          return <>
            <L>Total lurkers: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_lurkers)}</span>.</L>
            <L>Ghosts (1 visit, never returned): <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.ghosts)}</span> ({n(d.ghosts_pct)}%).</L>
            <L>Repeat lurkers (2-10 visits): <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.repeat_lurkers)}</span> ({n(d.repeat_pct)}%).</L>
            <L>Deep lurkers (10+ visits, 0 posts): <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.deep_lurkers)}</span> ({n(d.deep_pct)}%).</L>
          </>;
        })() : null}
      </Panel>

      <Panel scope="conversion" titleIcon="RefreshCw" title="Lurker \u2192 Poster Conversion">
        {panels.conversion.data ? ((): React.ReactNode => { const d = panels.conversion.data as Record<string, unknown>; const paths = arr(d.converting_paths) as Array<{ path: string; count: number }>;
          return <>
            {paths.length === 0 ? <L>No conversion data yet \u2014 needs page visit traffic and user events.</L>
              : paths.map(p => <L key={p.path}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{p.path}</span> converted {p.count} lurker(s) into posters</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="reengagement" titleIcon="Repeat" title="Re-Engagement Triggers">
        {panels.reengagement.data ? ((): React.ReactNode => { const d = panels.reengagement.data as Record<string, unknown>; const triggers = arr(d.triggers) as Array<{ path: string; count: number }>;
          return <>
            <L>Re-engaged users (30+ day gap): <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.reengaged_users)}</span>.</L>
            {triggers.map(t => <L key={t.path}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{t.path}</span> triggered {t.count} re-engagement(s)</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="alerts" titleIcon="BellDot" title="Alerts">
        {panels.alerts.data ? ((): React.ReactNode => { const d = panels.alerts.data as Record<string, unknown>; const th = arr(d.thresholds) as Array<{ metric: string; threshold: number; operator: string; severity: string; enabled: boolean }>; const active = arr(d.active) as Array<{ metric: string; severity: string; value: number; threshold: number }>; const hist = arr(d.history) as Array<{ metric: string; severity: string; triggered_at: string; resolved_at: string | null }>;
          return <>
            {active.length > 0 && <><L><Icon name="Circle" size={14} color="#d32f2f" fill="#d32f2f" /> <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{active.length}</span> active alerts:</L>
              {active.map(a => <L key={a.metric}><Icon name="TriangleAlert" size={14} color="#e65100" /> <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{a.metric}</span>: {a.value} (threshold {a.threshold})</L>)}</>}
            {active.length === 0 && <L><Icon name="Check" size={14} color="#2e7d32" /> No active alerts.</L>}
            <Heading>Thresholds</Heading>
            {th.map(t => <L key={t.metric}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{t.metric}</span>: {t.operator} {t.threshold} [{t.severity}] {t.enabled ? <Icon name="Check" size={14} color="#2e7d32" /> : <span style={{ color: 'var(--text-muted)' }}>(paused)</span>}</L>)}
            {hist.length > 0 && <><Heading>Recent History</Heading>{hist.slice(0, 5).map(h => <L key={`${h.metric}-${h.triggered_at}`}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{h.metric}</span>: triggered {new Date(h.triggered_at).toLocaleString()} {h.resolved_at ? <><Icon name="Check" size={12} color="#2e7d32" /> resolved</> : <><Icon name="Circle" size={12} color="#d32f2f" fill="#d32f2f" /> unresolved</>}</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="notifications" titleIcon="Bell" title="Notification Analytics">
        {panels.notifications.data ? ((): React.ReactNode => { const d = panels.notifications.data as Record<string, unknown>; const bt = arr(d.by_type) as Array<{ type: string; sent: number; delivered: number; clicked: number }>;
          return <>
            <L>Total sent: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_sent)}</span>. Delivered: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_delivered)}</span> ({n(d.delivery_rate)}%). Clicked: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_clicked)}</span> ({n(d.click_rate)}%).</L>
            {bt.map(b => <L key={b.type}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{b.type}</span>: {b.sent} sent, {b.delivered} delivered, {b.clicked} clicked</L>)}
          </>;
        })() : null}
      </Panel>

      {/* Search Analytics */}
      <Panel scope="search/overview" titleIcon="Search" title="Search Overview">
        {panels['search/overview'].data ? ((): React.ReactNode => {
          const d = panels['search/overview'].data as Record<string, unknown>;
          return <>
            <L>Today: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.searches_today)}</span> searches by <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.unique_searchers_today)}</span> users. Zero results: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.zero_result_today)}</span> ({n(d.zero_result_pct)}%).</L>
            {d.rollup && (() => { const r = d.rollup as Record<string, unknown>; return <>
              <Heading>Yesterday&apos;s Rollup</Heading>
              <L>Searches: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(r.total_searches)}</span> · Unique: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(r.unique_searchers)}</span> · Zero: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(r.zero_result_searches)}</span> ({n(r.zero_result_pct)}%)</L>
              <L>Avg latency: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(r.avg_response_time_ms)}ms</span> · P99: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(r.p99_response_time_ms)}ms</span></L>
              <L>Avg query length: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(r.query_length_avg)}</span> chars · CTR by top position: {(arr(r.ctr_by_position) as number[]).slice(0,5).join(', ')}</L>
              <L>Suggestion rate: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(r.suggestion_rate)}%</span> · Accept rate: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(r.suggestion_accept_rate)}%</span></L>
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
            <L><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_searches)}</span> searches over <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.period_days)}</span> days.</L>
            <Heading>Top Queries</Heading>
            {top.slice(0, 10).map(q => <L key={q.query}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{q.query}</span>: {q.count}x · {q.zero_result_pct}% zero</L>)}
            {zero.length > 0 && <><Heading>Zero-Result Queries</Heading>
            {zero.slice(0, 5).map(q => <L key={q.query}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{q.query}</span>: {q.count}x</L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="search/relevance" titleIcon="Target" title="Relevance">
        {panels['search/relevance'].data ? ((): React.ReactNode => {
          const d = panels['search/relevance'].data as Record<string, unknown>;
          const ctr = arr(d.ctr_by_position) as number[];
          const avg = d.avg_results as Record<string, number> | undefined;
          return <>
            <L><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_clicks)}</span> clicks from <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_searches)}</span> searches → <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.ctr)}%</span> CTR over <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.period_days)}</span> days.</L>
            <L>Avg results: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(avg?.avg_posts)}</span> posts, <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(avg?.avg_comments)}</span> comments per search.</L>
            <Heading>CTR by Position</Heading>
            {ctr.slice(0, 5).map((c, i) => <L key={i}>Position <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>#{i + 1}</span>: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{c}</span> clicks</L>)}
          </>;
        })() : null}
      </Panel>

      <Panel scope="search/trends" titleIcon="TrendingUp" title="Search Trends">
        {panels['search/trends'].data ? ((): React.ReactNode => {
          const d = panels['search/trends'].data as Record<string, unknown>;
          const vol = arr(d.volume) as Array<{ date: string; count: number }>;
          const zr = arr(d.zero_result_rate) as Array<{ date: string; rate: number }>;
          return <>
            <L>Daily volume over <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.period_days)}</span> days:</L>
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
            <L>Avg latency: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.avg_latency_ms)}ms</span> · P99: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.p99_latency_ms)}ms</span></L>
            <L>Dead letter queue: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.dead_letter_queue)}</span> documents awaiting retry</L>
            {gap.length > 0 && <><Heading>Index Gap Trend</Heading>
            {gap.slice(0, 10).map(g => <L key={g.date}>{g.date}: gap <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{g.gap_pct}%</span> · DLQ <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{g.dlq}</span></L>)}</>}
          </>;
        })() : null}
      </Panel>

      <Panel scope="search/behavior" titleIcon="User" title="Search Behavior">
        {panels['search/behavior'].data ? ((): React.ReactNode => {
          const d = panels['search/behavior'].data as Record<string, unknown>;
          return <>
            <L><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.search_sessions)}</span> search sessions over <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.period_days)}</span> days.</L>
            <L>Search-to-post ratio: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.search_and_post_ratio)}%</span> of users who posted also searched.</L>
            <L>Total clicks from search: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n(d.total_clicks_from_search)}</span></L>
          </>;
        })() : null}
      </Panel>
    </div>
  </>);
}
