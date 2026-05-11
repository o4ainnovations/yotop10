'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';

interface PendingPost { _id: string; title: string; author_username: string; post_type: string; created_at: string; revision_count: number; category_slug: string; intro?: string; collision?: { title: string; submitted_at: string; first: boolean } }
interface CategoryOption { slug: string; name: string; children?: Array<{ slug: string; name: string }> }

export default function PendingPostsPage() {
  const router = useRouter();
  const postsRef = useRef<PendingPost[]>([]);
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ category_slug: '', post_type: '', sort: 'oldest', author: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [retryGuidance, setRetryGuidance] = useState('');
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [previewCache, setPreviewCache] = useState<Record<string, { intro: string; items: Array<{ rank: number; title: string; justification: string }> }>>({});
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchPosts = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', sort: filters.sort });
      if (filters.category_slug) params.set('category_slug', filters.category_slug);
      if (filters.post_type) params.set('post_type', filters.post_type);
      if (filters.author) params.set('author', filters.author);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const data = await apiFetch<{ posts: PendingPost[]; pagination: { total: number; pages: number } }>(`/admin/posts/pending?${params}`);
      setPosts(data.posts); postsRef.current = data.posts; setPagination(data.pagination);
    } catch {} finally { setLoading(false); }
  }, [filters, dateFrom, dateTo]);

  useEffect(() => { fetchPosts(page); }, [page, fetchPosts]);

  useEffect(() => { apiFetch<{ categories: CategoryOption[] }>('/categories').then(d => setCategories(d.categories || [])).catch(() => {}); }, []);

  const toggleSelect = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectAll = () => { if (selected.size === posts.length) setSelected(new Set()); else setSelected(new Set(posts.map(p => p._id))); };

  const toggleExpand = async (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) { next.delete(id); setExpanded(next); return; }
    next.add(id); setExpanded(next);
    if (!previewCache[id]) {
      try {
        const data = await apiFetch<{ post: PendingPost & { intro: string; items: Array<{ rank: number; title: string; justification: string }> } }>(`/admin/posts/pending/${id}`);
        setPreviewCache(prev => ({ ...prev, [id]: { intro: data.post.intro || '', items: data.post.items || [] } }));
      } catch {}
    }
  };

  const bulkAction = async (action: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setActionLoading(true);
    try {
      if (action === 'approve') {
        const res = await apiFetch<{ approved: number }>('/admin/posts/bulk/approve', { method: 'POST', body: JSON.stringify({ ids }) });
        toast.success(`${res.approved} post(s) approved.`);
      } else if (action === 'reject') {
        await apiFetch('/admin/posts/bulk/reject', { method: 'POST', body: JSON.stringify({ ids, reason: rejectReason }) });
        toast.success('Posts rejected.');
        setRejectReason(''); setShowRejectModal(false);
      }
      setSelected(new Set()); fetchPosts(page);
    } catch {} finally { setActionLoading(false); }
  };

  const singleAction = useCallback(async (id: string, action: string) => {
    setActionLoading(true);
    try {
      if (action === 'approve') await apiFetch(`/admin/posts/${id}/approve`, { method: 'PATCH' });
      else if (action === 'reject') await apiFetch(`/admin/posts/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason: rejectReason || 'Rejected' }) });
      else if (action === 'retry') await apiFetch(`/admin/posts/${id}/retry`, { method: 'POST', body: JSON.stringify({ guidance: retryGuidance }) });
      toast.success(`${action === 'approve' ? 'Approved.' : action === 'reject' ? 'Rejected.' : 'Guidance sent.'}`);
      if (action !== 'retry') { setRejectReason(''); setRetryGuidance(''); setShowRejectModal(false); setShowRetryModal(false); }
      fetchPosts(page);
    } catch {} finally { setActionLoading(false); }
  }, [rejectReason, retryGuidance, fetchPosts, page]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const posts = postsRef.current;
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); if (posts.length > 0) singleAction(posts[0]._id, 'approve'); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); setSelected(new Set([posts[0]?._id].filter(Boolean) as string[])); setShowRejectModal(true); }
      else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); setSelected(new Set([posts[0]?._id].filter(Boolean) as string[])); setShowRetryModal(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [singleAction]);

  const ageStr = (d: string) => { const h = Math.round((Date.now() - new Date(d).getTime()) / 3600000); return h < 1 ? 'now' : h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`; };
  const ageColor = (d: string) => { const h = Math.round((Date.now() - new Date(d).getTime()) / 3600000); return h > 168 ? '#c62828' : h > 48 ? '#e65100' : '#666'; };

  const modalOverlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const modalBox: React.CSSProperties = { background: 'white', padding: '20px', borderRadius: '8px', minWidth: '400px', maxWidth: '500px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' };

  return (<div>
    <h2>Review Queue ({pagination.total} pending)</h2>

    <div style={{ display: 'flex', gap: '10px', margin: '12px 0', flexWrap: 'wrap' }}>
      <select value={filters.sort} onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1); }} style={{ padding: '6px' }}>
        <option value="oldest">Oldest First</option><option value="newest">Newest First</option>
      </select>
      <select value={filters.post_type} onChange={e => { setFilters(f => ({ ...f, post_type: e.target.value })); setPage(1); }} style={{ padding: '6px' }}>
        <option value="">All Types</option><option value="top_list">Top List</option><option value="best_of">Best Of</option><option value="worst_of">Worst Of</option><option value="hidden_gems">Hidden Gems</option><option value="counter_list">Counter List</option>
      </select>
      <input placeholder="Author username" value={filters.author} onChange={e => { setFilters(f => ({ ...f, author: e.target.value })); setPage(1); }} style={{ padding: '6px', width: '140px' }} />
      <select value={filters.category_slug} onChange={e => { setFilters(f => ({ ...f, category_slug: e.target.value })); setPage(1); }} style={{ padding: '6px', maxWidth: '180px' }}>
        <option value="">All Categories</option>
        {categories.map(c => (<React.Fragment key={c.slug}>
          <option value={c.slug}><Icon name="Folder" size={12} /> {c.name}</option>
          {c.children?.map(ch => <option key={ch.slug} value={ch.slug}>&nbsp;&nbsp;{ch.name}</option>)}
        </React.Fragment>))}
      </select>
      <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ padding: '4px', width: '130px' }} title="From date" />
      <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={{ padding: '4px', width: '130px' }} title="To date" />
    </div>

    {selected.size > 0 && (<div style={{ background: '#e3f2fd', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
      <strong>{selected.size} selected</strong>
      <button onClick={() => bulkAction('approve')} disabled={actionLoading} style={{ padding: '4px 12px', cursor: 'pointer' }}><Icon name="Check" size={14} color="#2e7d32" /> Approve</button>
      <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} style={{ padding: '4px 12px', cursor: 'pointer' }}><Icon name="X" size={14} color="#c62828" /> Reject</button>
    </div>)}

    {loading ? <p>Loading...</p> : posts.length === 0 ? <p>No pending posts.</p> : (
      <div>
        <div style={{ borderBottom: '2px solid #ccc', paddingBottom: '8px', marginBottom: '8px', display: 'flex', fontSize: '12px', color: '#666', textAlign: 'left' }}>
          <span style={{ width: '30px' }}><input type="checkbox" checked={selected.size === posts.length && posts.length > 0} onChange={selectAll} /></span>
          <span style={{ flex: 1 }}>Title</span><span style={{ width: '90px' }}>Type</span><span style={{ width: '90px' }}>Author</span><span style={{ width: '50px' }}>Age</span><span style={{ width: '140px' }}>Actions</span>
        </div>
        {posts.map(p => (<div key={p._id}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
            <span style={{ width: '30px' }}><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} onClick={e => e.stopPropagation()} /></span>
            <span style={{ flex: 1, fontWeight: 'bold', fontSize: '13px' }} onClick={() => toggleExpand(p._id)}>
              {p.title}
              {p.collision && <span style={{ background: '#ffcc02', color: '#333', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', marginLeft: '6px', fontWeight: 'bold' }} title={`Similar pending: ${p.collision.title} (submitted ${new Date(p.collision.submitted_at).toLocaleDateString()})`}><Icon name="Zap" size={10} /> COLLISION</span>}
              {p.revision_count > 0 && <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>×{p.revision_count}</span>}
            </span>
            <span style={{ width: '90px', fontSize: '11px', color: '#666' }}>{p.post_type}</span>
            <span style={{ width: '90px', fontSize: '11px' }}>{p.author_username}</span>
            <span style={{ width: '50px', fontSize: '11px', color: ageColor(p.created_at) }}>{ageStr(p.created_at)}</span>
            <span style={{ width: '140px', display: 'flex', gap: '4px' }}>
              <button onClick={e => { e.stopPropagation(); singleAction(p._id, 'approve'); }} disabled={actionLoading} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}><Icon name="Check" size={14} color="#2e7d32" /></button>
              <button onClick={e => { e.stopPropagation(); router.push(`/admin/posts/pending/${p._id}`); }} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}><Icon name="Search" size={14} /></button>
              <button onClick={e => { e.stopPropagation(); setShowRejectModal(true); setSelected(new Set([p._id])); }} disabled={actionLoading} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}><Icon name="X" size={14} color="#c62828" /></button>
              <button onClick={e => { e.stopPropagation(); setShowRetryModal(true); setSelected(new Set([p._id])); }} disabled={actionLoading} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}><Icon name="RefreshCw" size={14} /></button>
            </span>
          </div>
          {expanded.has(p._id) && (<div style={{ padding: '10px 10px 10px 40px', background: '#f9f9f9', borderBottom: '1px solid #eee', fontSize: '12px' }}>
            <p style={{ color: '#666' }}>Category: <strong>{p.category_slug}</strong></p>
            {previewCache[p._id] ? <div>
              <p><strong>Intro:</strong> {previewCache[p._id].intro.substring(0, 200)}{(previewCache[p._id].intro?.length || 0) > 200 ? '...' : ''}</p>
              <div>{previewCache[p._id].items.map(i => <div key={i.rank} style={{ margin: '4px 0' }}><strong>#{i.rank}</strong> {i.title} — {i.justification.substring(0, 80)}</div>)}</div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                <button onClick={() => singleAction(p._id, 'approve')} disabled={actionLoading} style={{ fontSize: '12px', padding: '4px 10px', cursor: 'pointer' }}><Icon name="Check" size={14} color="#2e7d32" /> Approve</button>
                <button onClick={() => { setSelected(new Set([p._id])); setShowRejectModal(true); }} disabled={actionLoading} style={{ fontSize: '12px', padding: '4px 10px', cursor: 'pointer' }}><Icon name="X" size={14} color="#c62828" /> Reject</button>
                <button onClick={() => { setSelected(new Set([p._id])); setShowRetryModal(true); }} disabled={actionLoading} style={{ fontSize: '12px', padding: '4px 10px', cursor: 'pointer' }}><Icon name="RefreshCw" size={14} /> Request Revision</button>
              </div>
            </div> : <p>Loading preview...</p>}
          </div>)}
        </div>))}
      </div>
    )}

    <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
      <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
      <span>Page {page} of {pagination.pages}</span>
      <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
    </div>

    <p style={{ marginTop: '12px', fontSize: '11px', color: '#999' }}><Icon name="Keyboard" size={12} /> Shortcuts: <strong>A</strong>=Approve first &nbsp; <strong>R</strong>=Reject first &nbsp; <strong>E</strong>=Request revision for first</p>

    {showRejectModal && <div style={modalOverlay} onClick={() => setShowRejectModal(false)}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h3>Reject {selected.size > 1 ? `${selected.size} posts` : 'Post'}</h3>
        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason..." rows={3} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowRejectModal(false)}>Cancel</button>
          <button onClick={() => selected.size > 1 ? bulkAction('reject') : singleAction(Array.from(selected)[0], 'reject')} disabled={!rejectReason.trim() || actionLoading} style={{ background: '#c62828', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px' }}>Confirm</button>
        </div>
      </div>
    </div>}

    {showRetryModal && <div style={modalOverlay} onClick={() => setShowRetryModal(false)}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h3>Request Revision</h3>
        <textarea value={retryGuidance} onChange={e => setRetryGuidance(e.target.value)} placeholder="Guidance for the author..." rows={4} maxLength={2000} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowRetryModal(false)}>Cancel</button>
          <button onClick={() => singleAction(Array.from(selected)[0], 'retry')} disabled={!retryGuidance.trim() || actionLoading} style={{ background: '#ff9800', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px' }}>Send Guidance</button>
        </div>
      </div>
    </div>}
  </div>);
}
