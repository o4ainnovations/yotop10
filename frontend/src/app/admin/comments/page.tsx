'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon, type LucideIconName } from '@/components/icons/Icon';

interface Comment { _id: string; id: string; content: string; author_username: string; post_id: string; post_slug: string | null; post_title: string | null; spark_score: number; fire_count: number; reply_count: number; depth: number; is_item_anchored: boolean; depth_badge: string | null; created_at: string; deleted: boolean; hidden: boolean; highlighted: boolean; flag_type: string | null; flag_evidence: Record<string, unknown> | null; }

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [flagModal, setFlagModal] = useState<{ comment: Comment } | null>(null);
  const [customMin, setCustomMin] = useState(''); const [customTrust, setCustomTrust] = useState('');
  const [filters, setFilters] = useState({ type: '', sort: 'newest', search: '', has_replies: '', filter: '' });
  const [stats, setStats] = useState<Record<string, number>>({});

  const fetchComments = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', sort: filters.sort, stats: 'true' });
      if (filters.type) params.set('type', filters.type);
      if (filters.search) params.set('search', filters.search);
      if (filters.has_replies) params.set('has_replies', filters.has_replies);
      if (filters.filter) params.set('filter', filters.filter);
      const data = await apiFetch<{ comments: Comment[]; pagination: { total: number; pages: number }; stats: Record<string, number> }>(`/admin/comments?${params}`);
      setComments(data.comments); setPagination(data.pagination); setStats(data.stats || {});
    } catch {} finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchComments(page); }, [page, fetchComments]);

  const toggleSelect = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
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
      else if (action === 'remove') { await apiFetch(`/admin/comments/${id}/permanent`, { method: 'DELETE' }); }
      toast.success(`${action} done.`);
      fetchComments(page);
    } catch {}
  };

  const applyPenalty = async (commentId: string, minutes: number, trustPenalty: number) => {
    try {
      await apiFetch(`/admin/comments/${commentId}/flag`, { method: 'POST', body: JSON.stringify({ flag_type: 'manual', evidence: { flagged_by: 'admin', penalty_min: minutes, penalty_trust: trustPenalty } }) });
      await apiFetch(`/admin/comments/${commentId}/apply-penalty`, { method: 'POST', body: JSON.stringify({ minutes, trust_penalty: trustPenalty }) });
      toast.success(`Done. Flagged + ${minutes}min applied.`);
      setFlagModal(null);
      await new Promise(r => setTimeout(r, 300));
      fetchComments(page);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg.substring(0, 80));
    }
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
    const map: Record<string, { label: string; icon: string; color: string }> = { spam_repetition: { label: 'Spam', icon: 'TriangleAlert', color: '#e65100' }, spam_link_first: { label: 'Spam', icon: 'Link', color: '#e65100' }, brigade_referrer: { label: 'Brigade', icon: 'BellDot', color: '#c62828' }, brigade_fresh: { label: 'Brigade', icon: 'BellDot', color: '#c62828' } };
    const m = map[type] || { label: '', icon: 'TriangleAlert', color: '#999' };
    return <span style={{ background: m.color, color: 'white', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}><Icon name={m.icon as LucideIconName} size={10} color="#fff" /> {m.label}</span>;
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

  const applyStatFilter = (key: string) => {
    const reset = { type: '', search: '', has_replies: '', filter: '' };
    if (key === 'total') setFilters(f => ({ ...f, ...reset }));
    else if (key === 'item_anchored') setFilters(f => ({ ...f, ...reset, type: 'item_anchored' }));
    else if (key === 'post_comment') setFilters(f => ({ ...f, ...reset, type: 'post_comment' }));
    else if (key === 'deleted') setFilters(f => ({ ...f, ...reset, filter: 'deleted' }));
    else if (key === 'hidden') setFilters(f => ({ ...f, ...reset, filter: 'hidden' }));
    else if (key === 'flagged') setFilters(f => ({ ...f, ...reset, filter: 'flagged' }));
    else if (key === 'highlighted') setFilters(f => ({ ...f, ...reset, filter: 'highlighted' }));
    setPage(1);
  };

  const filterSelect: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' };
  const filterInput: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' };

  const btnSm: React.CSSProperties = {
    fontSize: '11px', cursor: 'pointer', padding: '2px 8px',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  };

  const modalOverlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const modalBox: React.CSSProperties = { background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', minWidth: '400px', maxWidth: '500px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-primary)' };

  return (<div>
    <h2 style={{ color: 'var(--text-primary)' }}>All Comments ({pagination.total})</h2>

    <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
      {statCards.map(k => <div key={k} onClick={() => applyStatFilter(k)} style={{ background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}><strong style={{ color: 'var(--text-primary)' }}>{k}</strong>: {stats[k] ?? 0}</div>)}
    </div>

    <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
      <select value={filters.type} onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }} style={filterSelect}>
        <option value="">All Types</option><option value="post_comment">Post Comment</option><option value="item_anchored">Item Anchored</option>
      </select>
      <select value={filters.sort} onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1); }} style={filterSelect}>
        <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="most_fire">Most Fire</option><option value="most_replies">Most Replies</option><option value="highest_spark">Highest Spark</option>
      </select>
      <select value={filters.has_replies} onChange={e => { setFilters(f => ({ ...f, has_replies: e.target.value })); setPage(1); }} style={filterSelect}>
        <option value="">All</option><option value="yes">Has Replies</option><option value="no">No Replies</option>
      </select>
      <input placeholder="Search content" value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} style={{ ...filterInput, width: '180px' }} />
    </div>

    {selected.size > 0 && (<div style={{ background: 'var(--bg-tertiary)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', border: '1px solid var(--border-primary)' }}>
      <strong style={{ color: 'var(--text-primary)' }}>{selected.size} selected</strong>
      <button onClick={() => bulkAction('delete')} disabled={actionLoading} style={btnSm}>Delete</button>
      <button onClick={() => bulkAction('hide')} disabled={actionLoading} style={btnSm}>Hide</button>
      <button onClick={() => bulkAction('flag')} disabled={actionLoading} style={btnSm}>Flag</button>
      <button onClick={() => bulkAction('unflag')} disabled={actionLoading} style={btnSm}>Unflag</button>
    </div>)}

    {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : comments.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No comments found.</p> : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead><tr style={{ borderBottom: '2px solid var(--border-primary)', textAlign: 'left' }}>
          <th style={{ padding: '8px', width: '30px' }}><input type="checkbox" checked={selected.size === comments.length && comments.length > 0} onChange={selectAll} /></th>
          <th style={{ padding: '8px', width: '40px', color: 'var(--text-muted)' }}>ID</th>
          <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Post</th>
          <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Content</th>
          <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Author</th>
          <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Type</th>
          <th style={{ padding: '8px' }}><Icon name="Flame" size={12} color="#e65100" /></th><th style={{ padding: '8px' }}><Icon name="MessageCircle" size={12} /></th><th style={{ padding: '8px' }}><Icon name="Sparkles" size={12} /></th>
          <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Created</th>
          <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Actions</th>
        </tr></thead>
        <tbody>
          {comments.map(c => (<tr key={c._id} style={{ borderBottom: '1px solid var(--border-primary)', opacity: c.deleted ? 0.5 : 1, background: c.highlighted ? 'var(--accent-soft)' : c.hidden ? 'var(--bg-tertiary)' : 'transparent' }}>
            <td style={{ padding: '6px' }}><input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleSelect(c._id)} /></td>
            <td style={{ padding: '6px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>{String(c._id).slice(-6)}</td>
            <td style={{ padding: '6px', fontSize: '11px' }}>
              <a href={`/${c.post_slug || '#'}`} target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none' }} title={c.post_title || ''}>
                {(c.post_title || c.post_slug || '\u2014').substring(0, 30)}
              </a>
            </td>
            <td style={{ padding: '6px' }}>
              {c.depth_badge ? <span style={{ background: 'var(--bg-tertiary)', padding: '0 4px', borderRadius: '2px', fontSize: '10px', marginRight: '4px', color: 'var(--text-muted)' }}>{c.depth_badge}</span> : null}
              <a href={`/${c.post_slug || '#'}`} target="_blank" onClick={e => { if (!c.post_slug) e.preventDefault(); }} style={{ textDecoration: 'none', color: 'var(--text-secondary)' }}>
                {c.content?.substring(0, 80)}{(c.content?.length || 0) > 80 ? '...' : ''}
              </a>
            </td>
            <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{c.author_username}</td>
            <td style={{ padding: '6px', fontSize: '11px' }}>{c.is_item_anchored ? <><Icon name="Target" size={11} /> Item</> : <><Icon name="MessageCircle" size={11} /> Post</>} {c.flag_type && isAutoFlag(c.flag_type) && <span onClick={e => { e.stopPropagation(); dismissFlag(c._id); }} style={{ cursor: 'pointer' }}>{flagBadge(c.flag_type)}</span>}{c.flag_type === 'manual' && <span>{flagBadge(c.flag_type)}</span>}</td>
            <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{c.fire_count}</td>
            <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{c.reply_count}</td>
            <td style={{ padding: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>{Number(c.spark_score).toFixed(2)}</td>
            <td style={{ padding: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
            <td style={{ padding: '6px' }}>
              {c.deleted ? <><button onClick={() => quickAction(c._id, 'restore')} style={btnSm}>Restore</button><button onClick={() => { if (confirm('Permanently delete this comment?')) quickAction(c._id, 'remove'); }} style={{ ...btnSm, color: '#b71c1c' }}>Rem</button></> : <>
                <button onClick={() => quickAction(c._id, 'delete')} style={{ ...btnSm, color: '#c62828' }}>Del</button>
                {c.hidden ? <button onClick={() => quickAction(c._id, 'unhide')} style={btnSm}>Show</button> : <button onClick={() => quickAction(c._id, 'hide')} style={btnSm}>Hide</button>}
                {c.highlighted ? <button onClick={() => quickAction(c._id, 'unhighlight')} style={btnSm}>Unpin</button> : <button onClick={() => quickAction(c._id, 'highlight')} style={btnSm}>Pin</button>}
                {c.flag_type ? <button onClick={() => quickAction(c._id, 'unflag')} style={{ ...btnSm, color: '#2e7d32' }}>Unf</button> : <button onClick={() => setFlagModal({ comment: c })} style={{ ...btnSm, color: '#e65100' }}>Flag</button>}
              </>}
            </td>
          </tr>))}
        </tbody>
      </table>
    )}

    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Page {page} of {pagination.pages}</span>
      <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', cursor: page >= pagination.pages ? 'not-allowed' : 'pointer', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', opacity: page >= pagination.pages ? 0.5 : 1 }}>Next</button>
    </div>

    {flagModal && (() => { const rec = getRecommended(flagModal.comment); const ev = flagModal.comment.flag_evidence || {};
      return <div style={modalOverlay} onClick={() => setFlagModal(null)}>
        <div style={modalBox} onClick={e => e.stopPropagation()}>
          <h3 style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>Flag: {flagModal.comment.flag_type?.replace(/_/g, ' ')}</h3>
          <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <p style={{ margin: '0 0 4px' }}><strong style={{ color: 'var(--text-primary)' }}>Comment:</strong> &ldquo;{flagModal.comment.content?.substring(0, 100)}&rdquo;</p>
            <p style={{ margin: '0 0 4px' }}><strong style={{ color: 'var(--text-primary)' }}>Author:</strong> {flagModal.comment.author_username}</p>
            <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-primary)' }}>Evidence:</strong> {JSON.stringify(ev)}</p>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Recommended: <strong style={{ color: 'var(--text-primary)' }}>{rec.minutes}min pause, {rec.trust_penalty} trust</strong></p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={() => applyPenalty(flagModal.comment._id, rec.minutes, rec.trust_penalty)} style={{ padding: '8px 16px', cursor: 'pointer', background: '#e65100', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 'bold' }}>Apply Recommended</button>
            {isAutoFlag(flagModal.comment.flag_type) && <button onClick={() => dismissFlag(flagModal.comment._id)} style={{ padding: '8px 16px', cursor: 'pointer', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--text-primary)' }}>Dismiss Warning</button>}
          </div>
          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>Custom:</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={customMin} onChange={e => setCustomMin(e.target.value)} placeholder={`${rec.minutes} min`} style={{ width: '70px', padding: '6px', fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>min</span>
              <input value={customTrust} onChange={e => setCustomTrust(e.target.value)} placeholder={`${rec.trust_penalty} trust`} style={{ width: '90px', padding: '6px', fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>trust</span>
              <button onClick={() => { const m = parseInt(customMin) || rec.minutes; const t = parseFloat(customTrust) || rec.trust_penalty; applyPenalty(flagModal.comment._id, m, t); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>Apply</button>
            </div>
          </div>
        </div>
      </div>;
    })()}
  </div>);
}
