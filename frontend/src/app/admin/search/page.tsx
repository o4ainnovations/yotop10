'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';

interface IndexInfo {
  docs: number;
  size: string;
}

interface GapInfo {
  diff: number;
  pct: number;
}

interface SearchStatus {
  cluster: string;
  indices: Record<string, IndexInfo>;
  db_counts: Record<string, number>;
  gaps: Record<string, GapInfo>;
}

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

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<SearchStatus>('/search/admin/status');
      setStatus(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { const i = setInterval(fetchStatus, 30000); return () => clearInterval(i); }, [fetchStatus]);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const data = await apiFetch<{ success: boolean; total: { indexed: number; errors: number }; results: Record<string, unknown> }>(
        '/search/admin/reindex', { method: 'POST', body: JSON.stringify({ scope: reindexScope }) }
      );
      toast.success(`Reindexed ${data.total.indexed} docs, ${data.total.errors} errors`);
      fetchStatus();
    } catch { toast.error('Reindex failed'); }
    setReindexing(false);
  };

  const handlePreview = async () => {
    if (!previewQ.trim()) return;
    try {
      const data = await apiFetch<{ results: number; top: Array<{ title: string; slug: string; score: number }> }>(
        `/search/admin/preview?q=${encodeURIComponent(previewQ)}`
      );
      setPreviewResult(data);
    } catch {}
  };

  const handleDeleteIndex = async () => {
    if (!deleteIdx || !confirm(`Delete and recreate ${deleteIdx} index?`)) return;
    try {
      await apiFetch('/search/admin/index', { method: 'DELETE', body: JSON.stringify({ index: deleteIdx }) });
      toast.success(`${deleteIdx} index recreated`);
      setDeleteIdx('');
      fetchStatus();
    } catch { toast.error('Failed'); }
  };

  const handleShowMappings = async () => {
    try {
      const data = await apiFetch<{ indices: Record<string, unknown> }>('/search/admin/mappings');
      setMappings(data.indices);
      setShowMappings(true);
    } catch {}
  };

  const clusterColor = (s: string) => s === 'green' ? '#2e7d32' : s === 'yellow' ? '#f57c00' : '#c62828';

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ fontSize: '20px', marginBottom: '16px' }}>🔍 Search Management</h1>

      {status && (
        <div style={{ marginBottom: '24px', padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px' }}>Cluster: <strong style={{ color: clusterColor(status.cluster) }}>{status.cluster}</strong></span>
            <button onClick={fetchStatus} style={{ padding: '4px 12px', border: '1px solid #ddd', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>🔄 Refresh</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '6px' }}>Index</th>
                <th style={{ padding: '6px' }}>ES Docs</th>
                <th style={{ padding: '6px' }}>Size</th>
                <th style={{ padding: '6px' }}>DB Count</th>
                <th style={{ padding: '6px' }}>Gap</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(status.indices).map(([name, idx]) => {
                const gap = status.gaps[name];
                const gapColor = gap && gap.pct === 0 ? '#2e7d32' : '#c62828';
                return (
                  <tr key={name} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px', fontWeight: 'bold' }}>{name}</td>
                    <td style={{ padding: '6px' }}>{idx.docs}</td>
                    <td style={{ padding: '6px', color: '#666' }}>{idx.size}</td>
                    <td style={{ padding: '6px' }}>{status.db_counts[name] || 0}</td>
                    <td style={{ padding: '6px', color: gapColor, fontWeight: 'bold' }}>{gap ? `${gap.diff > 0 ? '+' : ''}${gap.diff} (${gap.pct}%)` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reindex */}
      <div style={{ marginBottom: '24px', padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
        <h3 style={{ fontSize: '15px', margin: '0 0 12px' }}>🔄 Reindex</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={reindexScope} onChange={e => setReindexScope(e.target.value)} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
            <option value="all">All (posts + comments + categories + users)</option>
            <option value="posts">Posts only</option>
            <option value="comments">Comments only</option>
            <option value="categories">Categories only</option>
            <option value="users">Users only</option>
          </select>
          <button onClick={handleReindex} disabled={reindexing}
            style={{ padding: '8px 20px', background: reindexing ? '#ccc' : '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: reindexing ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
            {reindexing ? 'Reindexing...' : 'Reindex'}
          </button>
        </div>
      </div>

      {/* Test Search */}
      <div style={{ marginBottom: '24px', padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
        <h3 style={{ fontSize: '15px', margin: '0 0 12px' }}>🔎 Test Search Query</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input value={previewQ} onChange={e => setPreviewQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePreview()}
            placeholder="Enter query..." style={{ flex: 1, padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
          <button onClick={handlePreview} style={{ padding: '8px 20px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Search</button>
        </div>
        {previewResult && (
          <div style={{ marginTop: '12px', fontSize: '13px' }}>
            <L><B>{previewResult.results}</B> results.</L>
            {previewResult.top.map(r => <L key={r.slug}><B>{r.title}</B> — score: {r.score.toFixed(2)}</L>)}
          </div>
        )}
      </div>

      {/* Mappings */}
      <div style={{ marginBottom: '24px', padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
        <h3 style={{ fontSize: '15px', margin: '0 0 12px' }}>📋 Index Mappings</h3>
        <button onClick={handleShowMappings} style={{ padding: '8px 20px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>View Mappings</button>
        {showMappings && mappings && (
          <div style={{ marginTop: '12px', fontSize: '12px', fontFamily: 'monospace', background: '#f0f0f0', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflow: 'auto' }}>
            <pre>{JSON.stringify(mappings, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Delete Index */}
      <div style={{ marginBottom: '24px', padding: '16px', background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '6px' }}>
        <h3 style={{ fontSize: '15px', margin: '0 0 12px', color: '#e65100' }}>⚠️ Delete & Recreate Index</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={deleteIdx} onChange={e => setDeleteIdx(e.target.value)} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
            <option value="">Select index...</option>
            <option value="posts">Posts</option>
            <option value="comments">Comments</option>
            <option value="categories">Categories</option>
            <option value="users">Users</option>
          </select>
          <button onClick={handleDeleteIndex} disabled={!deleteIdx}
            style={{ padding: '8px 20px', background: deleteIdx ? '#c62828' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: deleteIdx ? 'pointer' : 'not-allowed', fontSize: '13px' }}>
            Delete & Recreate
          </button>
        </div>
      </div>
    </div>
  );
}

const L = ({ children }: { children: React.ReactNode }) => <div style={{ marginBottom: '4px', fontSize: '13px', lineHeight: '1.6' }}>{children}</div>;
const B = ({ children }: { children: React.ReactNode }) => <strong>{children}</strong>;
