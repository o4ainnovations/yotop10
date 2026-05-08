'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Comment { _id: string; id: string; content: string; author_username: string; post_id: string; post_slug: string | null; post_title: string | null; spark_score: number; fire_count: number; reply_count: number; depth: number; is_item_anchored: boolean; depth_badge: string | null; created_at: string; deleted: boolean; hidden: boolean; highlighted: boolean; flag_type: string | null; flag_evidence: Record<string, unknown> | null; }

export default function AdminCommentsPage() {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [flagModal, setFlagModal] = useState<{ comment: Comment } | null>(null);
  const [customMin, setCustomMin] = useState(''); const [customTrust, setCustomTrust] = useState('');
  const [filters, setFilters] = useState({ type: '', sort: 'newest', search: '', has_replies: '' });
  const [stats, setStats] = useState<Record<string, number>>({});

  const fetchComments = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', sort: filters.sort, stats: 'true' });
      if (filters.type) params.set('type', filters.type);
      if (filters.search) params.set('search', filters.search);
      if (filters.has_replies) params.set('has_replies', filters.has_replies);
      const data = await apiFetch<{ comments: Comment[]; pagination: { total: number; pages: number }; stats: Record<string, number> }>(`/admin/comments?${params}`);
      setComments(data.comments); setPagination(data.pagination); setStats(data.stats || {});
    } catch {} finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchComments(page); }, [page, fetchComments]);

  const toggleSelect = (id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectAll = () => selected.size === comments.length ? setSelected(new Set()) : setSelected(new Set(comments.map(c => c._id)));

  const quickAction = async (id: string, action: string) => {
    try {
      if (action === 'delete') await apiFetch(`/admin/comments/${id}`, { method: 'DELETE' });
      else if (action === 'restore') await apiFetch(`/admin/comments/${id}/restore`, { method: 'POST' });
      else if (action === 'hide') await apiFetch(`/admin/comments/${id}/hide`, { method: 'POST', body: JSON.stringify({ reason: 'Admin moderation' }) });
      else if (action === 'unhide') await apiFetch(`/admin/comments/${id}/unhide`, { method: 'POST' });
      else if (action === 'highlight') await apiFetch(`/admin/comments/${id}/highlight`, { method: 'POST' });
      else if (action === 'unhighlight') await apiFetch(`/admin/comments/${id}/unhighlight`, { method: 'POST' });
      else if (action === 'flag') { await apiFetch(`/admin/comments/${id}/flag`, { method: 'POST', body: JSON.stringify({ flag_type: 'manual', evidence: { flagged_by: 'admin' } }) }); }
      else if (action === 'unflag') { await apiFetch(`/admin/comments/${id}/dismiss-flag`, { method: 'POST' }); }
      toast.success(`${action} done.`);
      fetchComments(page);
    } catch {}
  };

  const applyPenalty = async (commentId: string, minutes: number, trustPenalty: number) => {
    try {
      await apiFetch(`/admin/comments/${commentId}/apply-penalty`, { method: 'POST', body: JSON.stringify({ minutes, trust_penalty: trustPenalty }) });
      toast.success(`${minutes}min pause + ${trustPenalty} trust applied.`);
      setFlagModal(null); fetchComments(page);
    } catch {}
  };

  const dismissFlag = async (commentId: string) => {
    try {
      await apiFetch(`/admin/comments/${commentId}/dismiss-flag`, { method: 'POST' });
      toast.success('Auto-flag dismissed.');
      setFlagModal(null); fetchComments(page);
    } catch {}
  };

  const isAutoFlag = (type: string | null) => type && type !== 'manual';

  const flagBadge = (type: string) => {
    const map: Record<string, { label: string; color: string }> = { spam_repetition: { label: '⚠️ Spam', color: '#e65100' }, spam_link_first: { label: '🔗 Spam', color: '#e65100' }, brigade_referrer: { label: '🚨 Brigade', color: '#c62828' }, brigade_fresh: { label: '🚨 Brigade', color: '#c62828' } };
    const m = map[type] || { label: '⚠️', color: '#999' };
    return <span style={{ background: m.color, color: 'white', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>{m.label}</span>;
  };

  function getRecommended(comment: Comment): { minutes: number; trust_penalty: number } {
    if (!comment.flag_type || !comment.flag_evidence) return { minutes: 5, trust_penalty: -0.01 };
    const e = comment.flag_evidence;
    if (comment.flag_type === 'spam_repetition') return { minutes: Math.min(30, (e.duplicates as number) * 5), trust_penalty: -0.01 * (e.duplicates as number) };
    if (comment.flag_type === 'spam_link_first') return { minutes: 5, trust_penalty: -0.01 };
    if (comment.flag_type.includes('brigade')) return { minutes: (e.count as number) ? Math.min(60, Math.floor((e.count as number) / 5) * 30) : 30, trust_penalty: -0.01 * Math.floor((e.count as number || 5) / 5) };
    return { minutes: 5, trust_penalty: -0.01 };
  }

  const bulkAction = async (action: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setActionLoading(true);
    try {
      await apiFetch(`/admin/comments/bulk/${action}`, { method: 'POST', body: JSON.stringify({ ids }) });
      toast.success(`${action} done.`);
      setSelected(new Set()); fetchComments(page);
    } catch {} finally { setActionLoading(false); }
  };

  const statCards = ['total', 'item_anchored', 'post_comment', 'deleted', 'hidden', 'highlighted', 'flagged'];

  return (<div>
    <h2>All Comments ({pagination.total})</h2>

    <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
      {statCards.map(k => <div key={k} style={{ background: '#f5f5f5', padding: '4px 10px', borderRadius: '4px', fontSize: '12px' }}><strong>{k}</strong>: {stats[k] ?? 0}</div>)}
    </div>

    <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
      <select value={filters.type} onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }} style={{ padding: '6px' }}>
        <option value="">All Types</option><option value="post_comment">Post Comment</option><option value="item_anchored">Item Anchored</option>
      </select>
      <select value={filters.sort} onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1); }} style={{ padding: '6px' }}>
        <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="most_fire">Most Fire</option><option value="most_replies">Most Replies</option><option value="highest_spark">Highest Spark</option>
      </select>
      <select value={filters.has_replies} onChange={e => { setFilters(f => ({ ...f, has_replies: e.target.value })); setPage(1); }} style={{ padding: '6px' }}>
        <option value="">All</option><option value="yes">Has Replies</option><option value="no">No Replies</option>
      </select>
      <input placeholder="Search content" value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} style={{ padding: '6px', width: '180px' }} />
    </div>

    {selected.size > 0 && (<div style={{ background: '#e3f2fd', padding: '6px 12px', borderRadius: '4px', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
      <strong>{selected.size} selected</strong>
      <button onClick={() => bulkAction('delete')} disabled={actionLoading}>Delete</button>
      <button onClick={() => bulkAction('hide')} disabled={actionLoading}>Hide</button>
    </div>)}

    {loading ? <p>Loading...</p> : comments.length === 0 ? <p>No comments found.</p> : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead><tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
          <th style={{ padding: '6px', width: '30px' }}><input type="checkbox" checked={selected.size === comments.length && comments.length > 0} onChange={selectAll} /></th>
          <th style={{ padding: '6px', width: '40px' }}>ID</th>
          <th style={{ padding: '6px' }}>Post</th>
          <th style={{ padding: '6px' }}>Content</th>
          <th style={{ padding: '6px' }}>Author</th>
          <th style={{ padding: '6px' }}>Type</th>
          <th style={{ padding: '6px' }}>🔥</th><th style={{ padding: '6px' }}>💬</th><th style={{ padding: '6px' }}>✨</th>
          <th style={{ padding: '6px' }}>Created</th>
          <th style={{ padding: '6px' }}>Actions</th>
        </tr></thead>
        <tbody>
          {comments.map(c => (<tr key={c._id} style={{ borderBottom: '1px solid #eee', opacity: c.deleted ? 0.5 : 1, background: c.highlighted ? '#fffde7' : c.hidden ? '#fafafa' : 'transparent' }}>
            <td style={{ padding: '4px' }}><input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleSelect(c._id)} /></td>
            <td style={{ padding: '4px', fontSize: '10px', color: '#999', fontFamily: 'monospace' }}>{String(c._id).slice(-6)}</td>
            <td style={{ padding: '4px', fontSize: '11px' }}>
              <a href={`/${c.post_slug || '#'}`} target="_blank" style={{ color: '#1565c0', textDecoration: 'none' }} title={c.post_title || ''}>
                {(c.post_title || c.post_slug || '—').substring(0, 30)}
              </a>
            </td>
            <td style={{ padding: '4px' }}>
              {c.depth_badge ? <span style={{ background: '#e0e0e0', padding: '0 4px', borderRadius: '2px', fontSize: '10px', marginRight: '4px' }}>{c.depth_badge}</span> : null}
              <a href={`/${c.post_slug || '#'}`} target="_blank" onClick={e => { if (!c.post_slug) e.preventDefault(); }} style={{ textDecoration: 'none', color: 'inherit' }}>
                {c.content?.substring(0, 80)}{(c.content?.length || 0) > 80 ? '...' : ''}
              </a>
            </td>
            <td style={{ padding: '4px' }}>{c.author_username}</td>
            <td style={{ padding: '4px', fontSize: '11px' }}>{c.is_item_anchored ? '🎯 Item' : '💬 Post'} {c.flag_type && isAutoFlag(c.flag_type) && <span onClick={e => { e.stopPropagation(); dismissFlag(c._id); }} style={{ cursor: 'pointer' }}>{flagBadge(c.flag_type)}</span>}{c.flag_type === 'manual' && <span>{flagBadge(c.flag_type)}</span>}</td>
            <td style={{ padding: '4px' }}>{c.fire_count}</td>
            <td style={{ padding: '4px' }}>{c.reply_count}</td>
            <td style={{ padding: '4px', fontSize: '11px' }}>{Number(c.spark_score).toFixed(2)}</td>
            <td style={{ padding: '4px', fontSize: '11px' }}>{new Date(c.created_at).toLocaleDateString()}</td>
            <td style={{ padding: '4px' }}>
              {c.deleted ? <button onClick={() => quickAction(c._id, 'restore')} style={{ fontSize: '11px', cursor: 'pointer' }}>Restore</button> : <>
                <button onClick={() => quickAction(c._id, 'delete')} style={{ fontSize: '11px', cursor: 'pointer', color: '#c62828' }}>Del</button>
                {c.hidden ? <button onClick={() => quickAction(c._id, 'unhide')} style={{ fontSize: '11px', cursor: 'pointer' }}>Show</button> : <button onClick={() => quickAction(c._id, 'hide')} style={{ fontSize: '11px', cursor: 'pointer' }}>Hide</button>}
                {c.highlighted ? <button onClick={() => quickAction(c._id, 'unhighlight')} style={{ fontSize: '11px', cursor: 'pointer' }}>Unpin</button> : <button onClick={() => quickAction(c._id, 'highlight')} style={{ fontSize: '11px', cursor: 'pointer' }}>Pin</button>}
                {c.flag_type === 'manual' ? <button onClick={() => quickAction(c._id, 'unflag')} style={{ fontSize: '11px', cursor: 'pointer', color: '#2e7d32' }}>Unf</button> : <button onClick={() => setFlagModal({ comment: c })} style={{ fontSize: '11px', cursor: 'pointer', color: '#e65100' }}>Flag</button>}
              </>}
            </td>
          </tr>))}
        </tbody>
      </table>
    )}

    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
      <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
      <span>Page {page} of {pagination.pages}</span>
      <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
    </div>

    {flagModal && (() => { const rec = getRecommended(flagModal.comment); const ev = flagModal.comment.flag_evidence || {};
      return <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setFlagModal(null)}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', minWidth: '400px', maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
          <h3>Flag: {flagModal.comment.flag_type?.replace(/_/g, ' ')}</h3>
          <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px' }}>
            <p><strong>Comment:</strong> "{flagModal.comment.content?.substring(0, 100)}"</p>
            <p><strong>Author:</strong> {flagModal.comment.author_username}</p>
            <p><strong>Evidence:</strong> {JSON.stringify(ev)}</p>
          </div>
          <p style={{ fontSize: '13px', color: '#666' }}>Recommended: <strong>{rec.minutes}min pause, {rec.trust_penalty} trust</strong></p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => applyPenalty(flagModal.comment._id, rec.minutes, rec.trust_penalty)} style={{ padding: '8px 16px', cursor: 'pointer', background: '#e65100', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px' }}>Apply Recommended</button>
            {isAutoFlag(flagModal.comment.flag_type) && <button onClick={() => dismissFlag(flagModal.comment._id)} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}>Dismiss Warning</button>}
          </div>
          <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Custom:</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={customMin} onChange={e => setCustomMin(e.target.value)} placeholder={`${rec.minutes} min`} style={{ width: '70px', padding: '6px', fontSize: '12px' }} />
              <span>min</span>
              <input value={customTrust} onChange={e => setCustomTrust(e.target.value)} placeholder={`${rec.trust_penalty} trust`} style={{ width: '90px', padding: '6px', fontSize: '12px' }} />
              <span>trust</span>
              <button onClick={() => { const m = parseInt(customMin) || rec.minutes; const t = parseFloat(customTrust) || rec.trust_penalty; applyPenalty(flagModal.comment._id, m, t); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px' }}>Apply</button>
            </div>
          </div>
        </div>
      </div>;
    })()}
  </div>);
}
