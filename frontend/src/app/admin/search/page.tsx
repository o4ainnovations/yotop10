'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';

interface IndexInfo { docs: number; size: string; }
interface GapInfo { diff: number; pct: number; }
interface SearchStatus { cluster: string; indices: Record<string, IndexInfo>; db_counts: Record<string, number>; gaps: Record<string, GapInfo>; }
interface TrendingItem { query: string; count: number; trending_score: number; level: string; }
interface PopularItem { query: string; popularity_score: number; total: number; days_present: number; }
interface EngagedItem { query: string; impressions: number; clicks: number; bayesian_ctr: number; engagement_score: number; }

export default function AdminSearchPage() {
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [reindexScope, setReindexScope] = useState('all');
  const [previewQ, setPreviewQ] = useState('');
  const [previewResult, setPreviewResult] = useState<{ results: number; top: Array<{ title: string; slug: string; score: number }> } | null>(null);
  const [deleteIdx, setDeleteIdx] = useState('');
  const [mappings, setMappings] = useState<Record<string, unknown> | null>(null);
  const [showMappings, setShowMappings] = useState(false);
  const [tab, setTab] = useState<'status' | 'analytics'>('status');
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [engaged, setEngaged] = useState<EngagedItem[]>([]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try { setStatus(await apiFetch<SearchStatus>('/search/admin/status')); } catch {} finally { setLoading(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [t, p, e] = await Promise.all([
        apiFetch<{ trending: TrendingItem[] }>('/admin/stats/search/trending'),
        apiFetch<{ popular: PopularItem[] }>('/admin/stats/search/popular'),
        apiFetch<{ engaged: EngagedItem[] }>('/admin/stats/search/engaged'),
      ]);
      setTrending(t.trending || []);
      setPopular(p.popular || []);
      setEngaged(e.engaged || []);
    } catch {}
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { fetchAnalytics(); const i = setInterval(fetchAnalytics, 120000); return () => clearInterval(i); }, [fetchAnalytics]);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const data = await apiFetch<{ total: { indexed: number; errors: number } }>('/search/admin/reindex', { method: 'POST', body: JSON.stringify({ scope: reindexScope }) });
      toast.success(`Reindexed ${data.total.indexed} docs, ${data.total.errors} errors`);
      fetchStatus();
    } catch { toast.error('Reindex failed'); }
    setReindexing(false);
  };

  const handlePreview = async () => {
    if (!previewQ.trim()) return;
    try { setPreviewResult(await apiFetch<{ results: number; top: Array<{ title: string; slug: string; score: number }> }>(`/search/admin/preview?q=${encodeURIComponent(previewQ)}`)); } catch {}
  };

  const handleDeleteIndex = async () => {
    if (!deleteIdx || !confirm(`Delete and recreate ${deleteIdx} index?`)) return;
    try { await apiFetch('/search/admin/index', { method: 'DELETE', body: JSON.stringify({ index: deleteIdx }) }); toast.success(`${deleteIdx} index recreated`); setDeleteIdx(''); fetchStatus(); } catch { toast.error('Failed'); }
  };

  const handleShowMappings = async () => {
    try { const data = await apiFetch<{ indices: Record<string, unknown> }>('/search/admin/mappings'); setMappings(data.indices); setShowMappings(true); } catch {}
  };

  const clusterColor = (s: string) => s === 'green' ? '#2e7d32' : s === 'yellow' ? '#f57c00' : '#c62828';

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="Search" size={22} /> Search Management</h1>

      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <button onClick={() => setTab('status')} style={bt(tab === 'status')}>Cluster Status</button>
        <button onClick={() => { setTab('analytics'); fetchAnalytics(); }} style={bt(tab === 'analytics')}>Search Analytics</button>
      </div>

      {/* ═══ CLUSTER STATUS ══════════════════════════════════════ */}
      {tab === 'status' && status && (
        <>
          <div style={{ marginBottom: '20px', padding: '14px 18px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <span>Cluster: <strong style={{ color: clusterColor(status.cluster) }}>{status.cluster}</strong></span>
              <button onClick={fetchStatus} style={{ padding: '4px 12px', border: '1px solid #ddd', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}><Icon name="RefreshCw" size={14} /> Refresh</button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '24px' }}>
            <thead><tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}><th style={{ padding: '8px' }}>Index</th><th style={{ padding: '8px' }}>ES Docs</th><th style={{ padding: '8px' }}>Size</th><th style={{ padding: '8px' }}>DB Count</th><th style={{ padding: '8px' }}>Gap</th></tr></thead>
            <tbody>{Object.entries(status.indices).map(([name, idx]) => { const gap = status.gaps[name]; const gc = gap && gap.pct === 0 ? '#2e7d32' : '#c62828'; return <tr key={name} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px', fontWeight: 'bold' }}>{name}</td><td style={{ padding: '8px' }}>{idx.docs}</td><td style={{ padding: '8px', color: '#666' }}>{idx.size}</td><td style={{ padding: '8px' }}>{status.db_counts[name] || 0}</td><td style={{ padding: '8px', color: gc, fontWeight: 'bold' }}>{gap ? `${gap.diff > 0 ? '+' : ''}${gap.diff} (${gap.pct}%)` : '—'}</td></tr>; })}</tbody>
          </table>

          <S title={<><Icon name="RefreshCw" size={16} /> Reindex</>}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select value={reindexScope} onChange={e => setReindexScope(e.target.value)} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                <option value="all">All</option><option value="posts">Posts</option><option value="comments">Comments</option><option value="categories">Categories</option><option value="users">Users</option>
              </select>
              <button onClick={handleReindex} disabled={reindexing} style={btn(reindexing)}>{reindexing ? 'Reindexing...' : 'Reindex'}</button>
            </div>
          </S>

          <S title="🔎 Test Query">
            <div style={{ display: 'flex', gap: '10px' }}>
              <input value={previewQ} onChange={e => setPreviewQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePreview()} placeholder="Enter query..." style={{ flex: 1, padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
              <button onClick={handlePreview} style={btn(false)}>Search</button>
            </div>
            {previewResult && <div style={{ marginTop: '12px', fontSize: '13px' }}><L><B>{previewResult.results}</B> results.</L>{previewResult.top.map(r => <L key={r.slug}><B>{r.title}</B> — score: {r.score.toFixed(2)}</L>)}</div>}
          </S>

          <S title={<><Icon name="ClipboardList" size={16} /> Mappings</>}>
            <button onClick={handleShowMappings} style={btn(false)}>View Mappings</button>
            {showMappings && mappings && <pre style={{ marginTop: '12px', fontSize: '11px', background: '#f0f0f0', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflow: 'auto' }}>{JSON.stringify(mappings, null, 2)}</pre>}
          </S>

          <S title={<><Icon name="TriangleAlert" size={16} color="#e65100" /> Delete Index</>} warn>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select value={deleteIdx} onChange={e => setDeleteIdx(e.target.value)} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                <option value="">Select...</option><option value="posts">Posts</option><option value="comments">Comments</option><option value="categories">Categories</option><option value="users">Users</option>
              </select>
              <button onClick={handleDeleteIndex} disabled={!deleteIdx} style={{ padding: '8px 20px', background: deleteIdx ? '#c62828' : '#ccc', color: '#fff', border: 'none', borderRadius: '4px', cursor: deleteIdx ? 'pointer' : 'not-allowed', fontSize: '13px' }}>Delete & Recreate</button>
            </div>
          </S>
        </>
      )}

      {/* ═══ ANALYTICS ═══════════════════════════════════════════ */}
      {tab === 'analytics' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <MetricsCard label="Trending Now" count={trending.length} color="#c62828" />
            <MetricsCard label="Popular (7d)" count={popular.length} color="#1565c0" />
            <MetricsCard label="Most Engaged" count={engaged.length} color="#2e7d32" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {/* Trending */}
            <Section title={<><Icon name="Flame" size={16} /> Trending Now</>} subtitle="EMA spike detection: current hour vs 24h baseline">
              {trending.length === 0 ? <Empty /> : (
                <table style={tbl}>
                  <thead><tr><th>Query</th><th style={{ textAlign: 'right' }}>1h</th><th style={{ textAlign: 'right' }}>Score</th></tr></thead>
                  <tbody>{trending.map(t => <tr key={t.query}><td style={{ fontWeight: 'bold' }}>{t.query}</td><td style={{ textAlign: 'right' }}>{t.count}</td><td style={{ textAlign: 'right' }}><span style={{ color: t.level === 'hot' ? '#c62828' : '#f57c00', fontWeight: 'bold' }}>{t.trending_score}×</span></td></tr>)}</tbody>
                </table>
              )}
            </Section>

            {/* Popular */}
            <Section title={<><Icon name="ChartBar" size={16} /> Popular</>} subtitle="Decay-weighted rank over 7 days (0.95^d)">
              {popular.length === 0 ? <Empty /> : (
                <table style={tbl}>
                  <thead><tr><th>Query</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Score</th></tr></thead>
                  <tbody>{popular.map(p => <tr key={p.query}><td style={{ fontWeight: 'bold' }}>{p.query}</td><td style={{ textAlign: 'right' }}>{p.total}</td><td style={{ textAlign: 'right' }}>{p.popularity_score.toFixed(1)}</td></tr>)}</tbody>
                </table>
              )}
            </Section>

            {/* Most Engaged */}
            <Section title="👆 Most Engaged" subtitle="Bayesian CTR (α=1, β=99 prior)">
              {engaged.length === 0 ? <Empty /> : (
                <table style={tbl}>
                  <thead><tr><th>Query</th><th style={{ textAlign: 'right' }}>CTR</th><th style={{ textAlign: 'right' }}>Clicks</th></tr></thead>
                  <tbody>{engaged.map(e => <tr key={e.query}><td style={{ fontWeight: 'bold' }}>{e.query}</td><td style={{ textAlign: 'right' }}>{e.bayesian_ctr}%</td><td style={{ textAlign: 'right' }}>{e.clicks}/{e.impressions}</td></tr>)}</tbody>
                </table>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared components ─────────────────────────────────────────────
const bt = (active: boolean) => ({ padding: '8px 16px', border: 'none', borderBottom: active ? '2px solid #1565c0' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: active ? 'bold' as const : 'normal' as const, color: active ? '#1565c0' : '#666' });
const btn = (disabled: boolean) => ({ padding: '8px 20px', background: disabled ? '#ccc' : '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px' });
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' };
const S = ({ title, children, warn }: { title: React.ReactNode; children: React.ReactNode; warn?: boolean }) => <div style={{ marginBottom: '20px', padding: '16px', background: warn ? '#fff3e0' : '#fafafa', border: warn ? '1px solid #ffb74d' : '1px solid #eee', borderRadius: '6px' }}><h3 style={{ fontSize: '15px', margin: '0 0 12px', color: warn ? '#e65100' : '#333' }}>{title}</h3>{children}</div>;
const L = ({ children }: { children: React.ReactNode }) => <div style={{ marginBottom: '4px', fontSize: '13px', lineHeight: '1.6' }}>{children}</div>;
const B = ({ children }: { children: React.ReactNode }) => <strong>{children}</strong>;
const MetricsCard = ({ label, count, color }: { label: string; count: number; color: string }) => <div style={{ padding: '14px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: 'bold', color }}>{count}</div><div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{label}</div></div>;
const Section = ({ title, subtitle, children }: { title: React.ReactNode; subtitle: string; children: React.ReactNode }) => <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', padding: '14px' }}><h3 style={{ fontSize: '14px', margin: '0 0 2px' }}>{title}</h3><p style={{ fontSize: '11px', color: '#999', margin: '0 0 10px' }}>{subtitle}</p>{children}</div>;
const Empty = () => <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>No data yet — searches will appear here as users search</div>;
