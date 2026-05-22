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

  const clusterColor = (s: string) => s === 'green' ? 'text-green-500' : s === 'yellow' ? 'text-orange-500' : 'text-red-500';
  const primaryBtnClass = (disabled: boolean) => `px-5 py-2 text-white border-none rounded-xl cursor-pointer text-sm2 font-bold min-h-9 ${disabled ? 'bg-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-pink-500 cursor-pointer hover:from-orange-600 hover:to-pink-600'}`;
  const selClass = 'px-2.5 py-1.5 border border-white/10 rounded-lg text-sm2 bg-white/5 text-white outline-none min-h-9';
  const sectionClass = 'bg-white/5 border border-white/5 rounded-2xl p-4 mb-4 w-full';

  if (loading) return <div className="p-5 text-white/40">Loading...</div>;

  return (
    <div className="space-y-3 sm:space-y-4">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
        <Icon name="Search" size={22} color="var(--color-orange-400)" /> Search Management
      </h1>

      {/* Tabs - wrap on mobile */}
      <div className="flex gap-0 mb-5 border-b border-white/10 flex-wrap">
        <button onClick={() => setTab('status')} className={`px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm min-h-11 transition-colors ${tab === 'status' ? 'font-bold text-orange-400 border-b-2 border-orange-400' : 'text-white/40 border-b-2 border-transparent hover:text-white/60'}`}>Cluster Status</button>
        <button onClick={() => { setTab('analytics'); fetchAnalytics(); }} className={`px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm min-h-11 transition-colors ${tab === 'analytics' ? 'font-bold text-orange-400 border-b-2 border-orange-400' : 'text-white/40 border-b-2 border-transparent hover:text-white/60'}`}>Search Analytics</button>
      </div>

      {/* CLUSTER STATUS */}
      {tab === 'status' && status && (
        <>
          <div className="mb-5 px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex gap-5 items-center flex-wrap">
              <span className="text-white/60">Cluster: <strong className={clusterColor(status.cluster)}>{status.cluster}</strong></span>
              <button onClick={fetchStatus} className="px-3.5 py-1.5 border border-white/10 rounded-lg bg-white/5 cursor-pointer text-xs text-white min-h-9 flex items-center gap-1.5">
                <Icon name="RefreshCw" size={14} /> Refresh
              </button>
            </div>
          </div>

          {/* Index table - scroll on mobile */}
          <div className="overflow-x-auto mb-6 -mx-3 sm:mx-0">
            <div className="min-w-[500px]">
              <table className="w-full border-collapse text-sm2">
                <thead><tr className="border-b-2 border-white/10 text-left text-white/40"><th className="p-2.5">Index</th><th className="p-2.5">ES Docs</th><th className="p-2.5">Size</th><th className="p-2.5">DB Count</th><th className="p-2.5">Gap</th></tr></thead>
                <tbody>{Object.entries(status.indices).map(([name, idx]) => { const gap = status.gaps[name]; const gc = gap && gap.pct === 0 ? 'text-green-500' : 'text-red-500'; return <tr key={name} className="border-b border-white/5"><td className="p-2.5 font-bold text-white">{name}</td><td className="p-2.5 text-white/60">{idx.docs}</td><td className="p-2.5 text-white/40">{idx.size}</td><td className="p-2.5 text-white/60">{status.db_counts[name] || 0}</td><td className={`p-2.5 font-bold ${gc}`}>{gap ? `${gap.diff > 0 ? '+' : ''}${gap.diff} (${gap.pct}%)` : '\u2014'}</td></tr>; })}</tbody>
              </table>
            </div>
          </div>

          <div className={sectionClass}>
            <h3 className="text-base2 font-bold mb-3 text-white flex items-center gap-2"><Icon name="RefreshCw" size={16} /> Reindex</h3>
            <div className="flex gap-2.5 items-center flex-wrap">
              <select value={reindexScope} onChange={e => setReindexScope(e.target.value)} className={selClass}>
                <option value="all" className="bg-zinc-900">All</option><option value="posts" className="bg-zinc-900">Posts</option><option value="comments" className="bg-zinc-900">Comments</option><option value="categories" className="bg-zinc-900">Categories</option><option value="users" className="bg-zinc-900">Users</option>
              </select>
              <button onClick={handleReindex} disabled={reindexing} className={primaryBtnClass(reindexing)}>{reindexing ? 'Reindexing...' : 'Reindex'}</button>
            </div>
          </div>

          <div className={sectionClass}>
            <h3 className="text-base2 font-bold mb-3 text-white flex items-center gap-2"><Icon name="Search" size={16} /> Test Query</h3>
            <div className="flex gap-2.5 flex-wrap">
              <input value={previewQ} onChange={e => setPreviewQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePreview()} placeholder="Enter query..." className="flex-1 min-w-[200px] px-3 py-2 border border-white/10 rounded-lg text-sm2 bg-white/5 text-white outline-none placeholder:text-white/30 min-h-9" />
              <button onClick={handlePreview} className={primaryBtnClass(false)}>Search</button>
            </div>
            {previewResult && <div className="mt-3 text-sm2">
              <div className="mb-1 text-white/60"><strong className="text-white">{previewResult.results}</strong> results.</div>
              {previewResult.top.map(r => <div key={r.slug} className="mb-1 text-white/60"><strong className="text-white">{r.title}</strong> — score: {r.score.toFixed(2)}</div>)}
            </div>}
          </div>

          <div className={sectionClass}>
            <h3 className="text-base2 font-bold mb-3 text-white flex items-center gap-2"><Icon name="ClipboardList" size={16} /> Mappings</h3>
            <button onClick={handleShowMappings} className={primaryBtnClass(false)}>View Mappings</button>
            {showMappings && mappings && <pre className="mt-3 text-3xs bg-white/5 p-3 rounded-lg max-h-[300px] overflow-auto text-white/60 border border-white/10">{JSON.stringify(mappings, null, 2)}</pre>}
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-4">
            <h3 className="text-base2 font-bold mb-3 text-white flex items-center gap-2"><Icon name="TriangleAlert" size={16} color="#e65100" /> Delete Index</h3>
            <div className="flex gap-2.5 items-center flex-wrap">
              <select value={deleteIdx} onChange={e => setDeleteIdx(e.target.value)} className={selClass}>
                <option value="" className="bg-zinc-900">Select...</option><option value="posts" className="bg-zinc-900">Posts</option><option value="comments" className="bg-zinc-900">Comments</option><option value="categories" className="bg-zinc-900">Categories</option><option value="users" className="bg-zinc-900">Users</option>
              </select>
              <button onClick={handleDeleteIndex} disabled={!deleteIdx} className={`px-5 py-2 text-white border-none rounded-xl text-sm2 font-bold min-h-9 ${deleteIdx ? 'bg-red-700 cursor-pointer hover:bg-red-600' : 'bg-white/10 cursor-not-allowed'}`}>Delete & Recreate</button>
            </div>
          </div>
        </>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <>
          {/* Status cards - stack vertically on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{trending.length}</div>
              <div className="text-xs text-white/50 mt-1">Trending Now</div>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{popular.length}</div>
              <div className="text-xs text-white/50 mt-1">Popular (7d)</div>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-green-500">{engaged.length}</div>
              <div className="text-xs text-white/50 mt-1">Most Engaged</div>
            </div>
          </div>

          {/* Analytics tabs - wrap on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <h3 className="text-sm font-bold mb-0.5 text-white flex items-center gap-1.5"><Icon name="Flame" size={16} color="#e65100" /> Trending Now</h3>
              <p className="text-3xs text-white/40 mb-2.5">EMA spike detection: current hour vs 24h baseline</p>
              {trending.length === 0 ? <div className="p-6 text-center text-white/40 text-sm2">No data yet.</div> : (
                <table className="w-full border-collapse text-xs">
                  <thead><tr className="text-left text-white/40"><th>Query</th><th className="text-right">1h</th><th className="text-right">Score</th></tr></thead>
                  <tbody>{trending.map(t => <tr key={t.query}><td className="font-bold text-white">{t.query}</td><td className="text-right text-white/60">{t.count}</td><td className="text-right"><span className={`font-bold ${t.level === 'hot' ? 'text-red-500' : 'text-orange-500'}`}>{t.trending_score}x</span></td></tr>)}</tbody>
                </table>
              )}
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <h3 className="text-sm font-bold mb-0.5 text-white flex items-center gap-1.5"><Icon name="ChartBar" size={16} /> Popular</h3>
              <p className="text-3xs text-white/40 mb-2.5">Decay-weighted rank over 7 days (0.95^d)</p>
              {popular.length === 0 ? <div className="p-6 text-center text-white/40 text-sm2">No data yet.</div> : (
                <table className="w-full border-collapse text-xs">
                  <thead><tr className="text-left text-white/40"><th>Query</th><th className="text-right">Total</th><th className="text-right">Score</th></tr></thead>
                  <tbody>{popular.map(p => <tr key={p.query}><td className="font-bold text-white">{p.query}</td><td className="text-right text-white/60">{p.total}</td><td className="text-right text-white/60">{p.popularity_score.toFixed(1)}</td></tr>)}</tbody>
                </table>
              )}
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <h3 className="text-sm font-bold mb-0.5 text-white flex items-center gap-1.5"><Icon name="Target" size={16} /> Most Engaged</h3>
              <p className="text-3xs text-white/40 mb-2.5">Bayesian CTR (alpha=1, beta=99 prior)</p>
              {engaged.length === 0 ? <div className="p-6 text-center text-white/40 text-sm2">No data yet.</div> : (
                <table className="w-full border-collapse text-xs">
                  <thead><tr className="text-left text-white/40"><th>Query</th><th className="text-right">CTR</th><th className="text-right">Clicks</th></tr></thead>
                  <tbody>{engaged.map(e => <tr key={e.query}><td className="font-bold text-white">{e.query}</td><td className="text-right text-white/60">{e.bayesian_ctr}%</td><td className="text-right text-white/60">{e.clicks}/{e.impressions}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
