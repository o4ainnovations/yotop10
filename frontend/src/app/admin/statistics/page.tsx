'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface PanelState { loading: boolean; data: unknown; error?: string; open: boolean }

export default function StatisticsDashboard() {
  const [panels, setPanels] = useState<Record<string, PanelState>>({
    overview: { loading: false, data: null, open: true },
    content: { loading: false, data: null, open: false },
    community: { loading: false, data: null, open: false },
    moderation: { loading: false, data: null, open: false },
    categories: { loading: false, data: null, open: false },
    trends: { loading: false, data: null, open: false },
    quality: { loading: false, data: null, open: false },
    traffic: { loading: false, data: null, open: false },
    submissions: { loading: false, data: null, open: false },
  });

  const fetchPanel = useCallback(async (scope: string) => {
    setPanels(prev => ({ ...prev, [scope]: { ...prev[scope], loading: true } }));
    try {
      const data = await apiFetch(`/admin/stats/${scope}`);
      setPanels(prev => ({ ...prev, [scope]: { ...prev[scope], loading: false, data, open: true } }));
    } catch {
      setPanels(prev => ({ ...prev, [scope]: { ...prev[scope], loading: false, error: 'Failed to load' } }));
    }
  }, []);

  useEffect(() => { fetchPanel('overview'); }, [fetchPanel]);

  const toggle = (scope: string) => {
    setPanels(prev => {
      const current = prev[scope];
      if (!current.open && !current.data) fetchPanel(scope);
      return { ...prev, [scope]: { ...current, open: !current.open } };
    });
  };

  const card = (label: string, value: unknown) => (
    <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: '8px', textAlign: 'center', flex: 1, minWidth: '100px' }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{String(value ?? '—')}</div>
      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{label}</div>
    </div>
  );

  const SummaryRow = ({ data, fields }: { data: Record<string, unknown>; fields: string[] }) => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      {fields.map(f => <span key={f}>{card(f, (data as Record<string, unknown>)[f])}</span>)}
    </div>
  );

  const Panel = ({ scope, title, summary, children }: { scope: string; title: string; summary?: string; children: React.ReactNode }) => {
    const p = panels[scope];
    return (
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
        <button onClick={() => toggle(scope)} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: '#f5f5f5', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>{title}{!p.open && summary ? ` ▸ ${summary}` : ''}</span>
          <span>{p.open ? '▾' : '▸'}</span>
        </button>
        {p.open && (
          <div style={{ padding: '16px' }}>
            {p.loading ? <p>Loading...</p> : p.error ? <p style={{ color: 'red' }}>{p.error}</p> : children}
          </div>
        )}
      </div>
    );
  };

  const overview = panels.overview.data as Record<string, unknown> | null;

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📊 Platform Statistics</h2>
        <button onClick={() => window.open('/api/admin/stats/export?scope=overview', '_blank')}
          style={{ fontSize: '12px', padding: '6px 12px' }}>Export CSV</button>
      </div>

      <Panel scope="overview" title="📈 Overview">
        {overview && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {card('Posts', (overview.posts as Record<string, number>)?.total)}
            {card('Comments', (overview.comments as Record<string, number>)?.total)}
            {card('Users', (overview.users as Record<string, number>)?.total)}
            {card('Pending', overview.pending)}
            {card('Approved', (overview.posts as Record<string, number>)?.approved)}
            {card('Rejected', (overview.posts as Record<string, number>)?.rejected)}
          </div>
        )}
      </Panel>

      <Panel scope="content" title="📂 Content" summary={overview ? `${(overview.posts as Record<string, number>)?.total || 0} posts, ${(overview.comments as Record<string, number>)?.total || 0} comments` : ''}>
        {panels.content.data && (
          <SummaryRow data={panels.content.data as Record<string, unknown>}
            fields={['posts.total', 'posts.submitted', 'posts.approved', 'posts.rejected', 'posts.pending', 'posts.in_revision', 'comments.total', 'comments.this_week', 'comments.today']} />
        )}
      </Panel>

      <Panel scope="community" title="👥 Community" summary={overview ? `${(overview.users as Record<string, number>)?.total || 0} users, ${(overview.trust as Record<string, number>)?.scholars || 0} scholars` : ''}>
        {panels.community.data && (
          <SummaryRow data={panels.community.data as Record<string, unknown>}
            fields={['users.total', 'users.new_today', 'users.new_this_week', 'users.active_30d', 'users.active_7d', 'trust.scholars', 'trust.neutrals', 'trust.trolls', 'trolls_active_24h', 'lurkers', 'active_pct']} />
        )}
      </Panel>

      <Panel scope="moderation" title="⏳ Moderation" summary={overview ? `${overview.queue || 0} pending` : ''}>
        {panels.moderation.data && (
          <SummaryRow data={panels.moderation.data as Record<string, unknown>}
            fields={['reviews_today', 'approved_today', 'rejected_today', 'retry_today', 'pending_queue.total', 'pending_queue.oldest_age_hours']} />
        )}
      </Panel>

      <Panel scope="categories" title="📁 Categories">
        {panels.categories.data && (
          <div>
            <p>Utilization: {(panels.categories.data as Record<string, number>).utilization_pct}% | Empty children: {(panels.categories.data as Record<string, number>).empty_children}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #ccc' }}><th style={{ textAlign: 'left', padding: '4px' }}>Category</th><th style={{ textAlign: 'left', padding: '4px' }}>Posts</th></tr></thead>
              <tbody>
                {((panels.categories.data as Record<string, unknown>).top_by_posts as Array<{ slug: string; post_count: number }>)?.map(c => (
                  <tr key={c.slug} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '4px' }}>{c.slug}</td><td style={{ padding: '4px' }}>{c.post_count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel scope="trends" title="📉 Trends (14-day)">
        {panels.trends.data && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead><tr style={{ borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: '4px' }}>Date</th><th style={{ padding: '4px' }}>Posts</th><th style={{ padding: '4px' }}>Submits</th><th style={{ padding: '4px' }}>Comments</th><th style={{ padding: '4px' }}>Users</th><th style={{ padding: '4px' }}>New</th><th style={{ padding: '4px' }}>Reviews</th><th style={{ padding: '4px' }}>Pending</th>
            </tr></thead>
            <tbody>
              {((panels.trends.data as Record<string, unknown>).weeks as Array<Record<string, number>>)?.map(w => (
                <tr key={w.date} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px' }}>{w.date}</td>
                  <td style={{ padding: '4px' }}>{w.posts_total}</td><td style={{ padding: '4px' }}>{w.posts_submitted}</td>
                  <td style={{ padding: '4px' }}>{w.comments_total}</td><td style={{ padding: '4px' }}>{w.users_total}</td>
                  <td style={{ padding: '4px' }}>{w.users_new}</td><td style={{ padding: '4px' }}>{w.reviews}</td>
                  <td style={{ padding: '4px' }}>{w.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel scope="quality" title="✅ Quality">
        {panels.quality.data && (
          <SummaryRow data={panels.quality.data as Record<string, unknown>} fields={['revision_rate']} />
        )}
      </Panel>

      <Panel scope="traffic" title="🌐 Traffic">
        {panels.traffic.data && (
          <div>
            <SummaryRow data={panels.traffic.data as Record<string, unknown>} fields={['visits_today', 'unique_today']} />
            <h4 style={{ marginTop: '12px' }}>Browsers</h4>
            <div>{Object.entries(((panels.traffic.data as Record<string, unknown>).browsers as Record<string, number>) || {}).map(([k, v]) => `${k}: ${v}`).join(' | ')}</div>
            <h4 style={{ marginTop: '8px' }}>OS</h4>
            <div>{Object.entries(((panels.traffic.data as Record<string, unknown>).os as Record<string, number>) || {}).map(([k, v]) => `${k}: ${v}`).join(' | ')}</div>
            <h4 style={{ marginTop: '8px' }}>Top Paths</h4>
            {((panels.traffic.data as Record<string, unknown>).top_paths as Array<{ path: string; count: number }>)?.map(p => (
              <div key={p.path}>{p.path}: {p.count}</div>
            ))}
          </div>
        )}
      </Panel>

      <Panel scope="submissions" title="✍️ Submissions (7d)">
        {panels.submissions.data && (
          <div>
            <SummaryRow data={panels.submissions.data as Record<string, unknown>} fields={['avg_items_per_post']} />
            <h4 style={{ marginTop: '12px' }}>By Post Type</h4>
            {((panels.submissions.data as Record<string, unknown>).by_type as Array<{ type: string; count: number }>)?.map(t => (
              <div key={t.type}>{t.type}: {t.count}</div>
            ))}
          </div>
        )}
      </Panel>
    </div>

    <div style={{ marginTop: '40px', borderTop: '2px solid #ccc', paddingTop: '20px' }}>
      <h2>🔬 Deep Analytics (All Metrics)</h2>
      <DeepAnalytics />
    </div>
  );
}

function DeepAnalytics() {
  const endpoints = [
    { key: 'health', label: '🫀 Platform Health' },
    { key: 'content', label: '📂 Content Pipeline + Age Distribution' },
    { key: 'community', label: '👥 Community + Fan-Out + Lurkers' },
    { key: 'moderation', label: '⏳ Moderation Velocity + Queue Projection' },
    { key: 'categories', label: '📁 Category Heatmap' },
    { key: 'trends', label: '📉 Trends with Deltas (Week-over-Week)' },
    { key: 'quality', label: '✅ Quality + Intro-Length Correlation' },
    { key: 'traffic', label: '🌐 Traffic (Referrers, Peak Hours, Countries, Engagement)' },
    { key: 'submissions', label: '✍️ Submissions (By Hour, By Type)' },
    { key: 'lifecycle', label: '🔄 User Lifecycle (First → Second Post)' },
    { key: 'alerts', label: '🚨 Alerts (Thresholds + History + Active)' },
    { key: 'compare', label: '⚖️ Comparison Mode', params: '?date1=2026-05-06&date2=2026-05-05' },
    { key: 'notifications', label: '🔔 Notification Analytics (Delivery + Click Rate)' },
    { key: 'correlations', label: '📊 Quality Correlations (standalone)' },
  ];

  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    endpoints.forEach(async ({ key, params }) => {
      setLoading(prev => ({ ...prev, [key]: true }));
      try {
        const url = key === 'lifecycle' ? '/api/admin/stats/users/lifecycle'
          : key === 'correlations' ? '/api/admin/stats/quality'
          : key === 'compare' ? `/api/admin/stats/compare${params || ''}`
          : `/api/admin/stats/${key}`;
        const result = await apiFetch(url);
        setData(prev => ({ ...prev, [key]: result }));
      } catch { setData(prev => ({ ...prev, [key]: { error: 'Failed' } })); }
      finally { setLoading(prev => ({ ...prev, [key]: false })); }
    });
  }, []);

  const RawJSON = ({ d }: { d: unknown }) => (
    <pre style={{
      backgroundColor: '#1a1a2e', color: '#e0e0e0', padding: '12px', borderRadius: '6px',
      fontSize: '11px', lineHeight: '1.5', overflow: 'auto', maxHeight: '400px',
      fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>
      {JSON.stringify(d, null, 2)}
    </pre>
  );

  return (
    <div>
      {endpoints.map(({ key, label }) => (
        <div key={key} style={{ border: '1px solid #ddd', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
          <button onClick={() => setOpen(prev => ({ ...prev, [key]: !prev[key] }))}
            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: '#f5f5f5', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>{label} {loading[key] ? '(loading...)' : data[key] ? '✅' : '⏳'}</span>
            <span>{open[key] ? '▾' : '▸'}</span>
          </button>
          {open[key] && (
            <div style={{ padding: '8px' }}>
              <RawJSON d={data[key] || { loading: true }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
