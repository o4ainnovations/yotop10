'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';
import { formatDate, relativeTime } from '@/lib/dates';

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

  const ageColor = (d: string) => { const h = Math.round((Date.now() - new Date(d).getTime()) / 3600000); return h > 168 ? 'text-red-700' : h > 48 ? 'text-orange-600' : 'text-white/40'; };

  const filterSelectClass = 'bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none min-h-[36px]';
  const filterInputClass = 'bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none min-h-[36px]';
  const btnSmClass = 'text-[11px] px-2 py-0.5 cursor-pointer bg-white/5 border border-white/10 rounded-lg text-white min-h-[28px]';

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="text-white text-lg font-bold">Review Queue ({pagination.total} pending)</h2>

      <div className="text-[10px] font-mono text-zinc-600">
        DOUBLE-BLIND REVIEW — Decisions based on content, not author reputation
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={filters.sort} onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1); }} className={filterSelectClass}>
          <option value="oldest" className="bg-zinc-900">Oldest First</option><option value="newest" className="bg-zinc-900">Newest First</option>
        </select>
        <select value={filters.post_type} onChange={e => { setFilters(f => ({ ...f, post_type: e.target.value })); setPage(1); }} className={filterSelectClass}>
          <option value="" className="bg-zinc-900">All Types</option><option value="top_list" className="bg-zinc-900">Top List</option><option value="best_of" className="bg-zinc-900">Best Of</option><option value="worst_of" className="bg-zinc-900">Worst Of</option><option value="hidden_gems" className="bg-zinc-900">Hidden Gems</option><option value="counter_list" className="bg-zinc-900">Counter List</option>
        </select>
        <input placeholder="Author username" value={filters.author} onChange={e => { setFilters(f => ({ ...f, author: e.target.value })); setPage(1); }} className={`${filterInputClass} w-[140px]`} />
        <select value={filters.category_slug} onChange={e => { setFilters(f => ({ ...f, category_slug: e.target.value })); setPage(1); }} className={`${filterSelectClass} max-w-[180px]`}>
          <option value="" className="bg-zinc-900">All Categories</option>
          {categories.map(c => (<React.Fragment key={c.slug}>
            <option value={c.slug} className="bg-zinc-900">{c.name}</option>
            {c.children?.map(ch => <option key={ch.slug} value={ch.slug} className="bg-zinc-900">&nbsp;&nbsp;{ch.name}</option>)}
          </React.Fragment>))}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={`${filterInputClass} w-[130px]`} title="From date" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className={`${filterInputClass} w-[130px]`} title="To date" />
      </div>

      {selected.size > 0 && (
        <div className="bg-white/[0.03] rounded-lg px-3 py-2.5 flex gap-2 items-center border border-white/10">
          <span className="text-white text-sm font-semibold">{selected.size} selected</span>
          <button onClick={() => bulkAction('approve')} disabled={actionLoading} className={btnSmClass}><Icon name="Check" size={14} color="#2e7d32" /> Approve</button>
          <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} className={btnSmClass}><Icon name="X" size={14} color="#c62828" /> Reject</button>
        </div>
      )}

      {loading ? <p className="text-white/40">Loading...</p> : posts.length === 0 ? <p className="text-white/40">No pending posts.</p> : (
        <div className="space-y-3 sm:space-y-4">
          {/* Desktop header */}
          <div className="hidden sm:flex border-b-2 border-white/10 pb-2 text-xs text-white/40 text-left">
            <span className="w-[30px]"><input type="checkbox" checked={selected.size === posts.length && posts.length > 0} onChange={selectAll} /></span>
            <span className="flex-1">Title</span><span className="w-[90px]">Type</span><span className="w-[90px]">Author</span><span className="w-[50px]">Age</span><span className="w-[140px]">Actions</span>
          </div>
          {/* Mobile + Desktop rows */}
          <div className="flex flex-col gap-2">
            {posts.map(p => (
              <div key={p._id}>
                {/* Card row (visible on all screens) */}
                <div className="flex items-center py-2 gap-1 border-b border-white/5 cursor-pointer flex-wrap">
                  {/* Mobile card layout */}
                  <div className="sm:hidden flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} onClick={e => e.stopPropagation()} />
                      <span className="font-bold text-[13px] text-white flex-1" onClick={() => toggleExpand(p._id)}>
                        {p.title}
                        {p.collision && <span className="bg-yellow-400 text-zinc-900 px-1 py-px rounded text-[10px] ml-1 font-bold" title={`Similar pending: ${p.collision.title} (submitted ${formatDate(p.collision.submitted_at)})`}><Icon name="Zap" size={10} /> COLLISION</span>}
                        {p.revision_count > 0 && <span className="bg-orange-500/20 text-orange-400 px-1 py-px rounded text-[10px] ml-1">{p.revision_count}x</span>}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[11px] text-white/50 pl-7">
                      <span>{p.post_type}</span>
                      <span>{p.author_username}</span>
                      <span className={ageColor(p.created_at)} suppressHydrationWarning>{relativeTime(p.created_at)}</span>
                    </div>
                    <div className="flex gap-1 pl-7">
                      <button onClick={e => { e.stopPropagation(); singleAction(p._id, 'approve'); }} disabled={actionLoading} className={btnSmClass}><Icon name="Check" size={14} color="#2e7d32" /></button>
                      <button onClick={e => { e.stopPropagation(); router.push(`/admin/posts/pending/${p._id}`); }} className={btnSmClass}><Icon name="Search" size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); setShowRejectModal(true); setSelected(new Set([p._id])); }} disabled={actionLoading} className={btnSmClass}><Icon name="X" size={14} color="#c62828" /></button>
                      <button onClick={e => { e.stopPropagation(); setShowRetryModal(true); setSelected(new Set([p._id])); }} disabled={actionLoading} className={btnSmClass}><Icon name="RefreshCw" size={14} /></button>
                    </div>
                  </div>
                  {/* Desktop row */}
                  <span className="hidden sm:block w-[30px]"><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} onClick={e => e.stopPropagation()} /></span>
                  <span className="hidden sm:block flex-1 font-bold text-[13px] text-white cursor-pointer" onClick={() => toggleExpand(p._id)}>
                    {p.title}
                    {p.collision && <span className="bg-yellow-400 text-zinc-900 px-1 py-px rounded text-[10px] ml-1 font-bold" title={`Similar pending: ${p.collision.title} (submitted ${formatDate(p.collision.submitted_at)})`}><Icon name="Zap" size={10} /> COLLISION</span>}
                    {p.revision_count > 0 && <span className="bg-orange-500/20 text-orange-400 px-1 py-px rounded text-[10px] ml-1">{p.revision_count}x</span>}
                  </span>
                  <span className="hidden sm:block w-[90px] text-[11px] text-white/40">{p.post_type}</span>
                  <span className="hidden sm:block w-[90px] text-[11px] text-white/60">{p.author_username}</span>
                  <span className={`hidden sm:block w-[50px] text-[11px] ${ageColor(p.created_at)}`} suppressHydrationWarning>{relativeTime(p.created_at)}</span>
                  <span className="hidden sm:flex w-[140px] gap-1">
                    <button onClick={e => { e.stopPropagation(); singleAction(p._id, 'approve'); }} disabled={actionLoading} className={btnSmClass}><Icon name="Check" size={14} color="#2e7d32" /></button>
                    <button onClick={e => { e.stopPropagation(); router.push(`/admin/posts/pending/${p._id}`); }} className={btnSmClass}><Icon name="Search" size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); setShowRejectModal(true); setSelected(new Set([p._id])); }} disabled={actionLoading} className={btnSmClass}><Icon name="X" size={14} color="#c62828" /></button>
                    <button onClick={e => { e.stopPropagation(); setShowRetryModal(true); setSelected(new Set([p._id])); }} disabled={actionLoading} className={btnSmClass}><Icon name="RefreshCw" size={14} /></button>
                  </span>
                </div>
                {expanded.has(p._id) && (
                  <div className="px-3 py-2.5 sm:pl-10 bg-white/[0.02] border-b border-white/5 text-xs text-white/60">
                    <p>Category: <strong className="text-white">{p.category_slug}</strong></p>
                    {previewCache[p._id] ? <div>
                      <p><strong className="text-white">Intro:</strong> {previewCache[p._id].intro.substring(0, 200)}{(previewCache[p._id].intro?.length || 0) > 200 ? '...' : ''}</p>
                      <div>{previewCache[p._id].items.map(i => <div key={i.rank} className="my-1"><strong className="text-white">#{i.rank}</strong> {i.title} — {i.justification.substring(0, 80)}</div>)}</div>
                      <div className="mt-2 flex gap-1.5">
                        <button onClick={() => singleAction(p._id, 'approve')} disabled={actionLoading} className="text-xs px-3 py-1 cursor-pointer bg-white/5 border border-white/10 rounded-lg text-white"><Icon name="Check" size={14} color="#2e7d32" /> Approve</button>
                        <button onClick={() => { setSelected(new Set([p._id])); setShowRejectModal(true); }} disabled={actionLoading} className="text-xs px-3 py-1 cursor-pointer bg-white/5 border border-white/10 rounded-lg text-white"><Icon name="X" size={14} color="#c62828" /> Reject</button>
                        <button onClick={() => { setSelected(new Set([p._id])); setShowRetryModal(true); }} disabled={actionLoading} className="text-xs px-3 py-1 cursor-pointer bg-white/5 border border-white/10 rounded-lg text-white"><Icon name="RefreshCw" size={14} /> Request Revision</button>
                      </div>
                    </div> : <p className="text-white/40">Loading preview...</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={`px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm min-h-[36px] ${page <= 1 ? 'opacity-40 cursor-not-allowed bg-white/5' : 'cursor-pointer bg-white/5 hover:bg-white/10'}`}>Prev</button>
        <span className="text-white/60 text-[13px]">Page {page} of {pagination.pages}</span>
        <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className={`px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm min-h-[36px] ${page >= pagination.pages ? 'opacity-40 cursor-not-allowed bg-white/5' : 'cursor-pointer bg-white/5 hover:bg-white/10'}`}>Next</button>
      </div>

      <p className="text-[11px] text-white/30 mt-3"><Icon name="Keyboard" size={12} /> Shortcuts: <strong className="text-white/50">A</strong>=Approve first · <strong className="text-white/50">R</strong>=Reject first · <strong className="text-white/50">E</strong>=Request revision for first</p>

      {/* Reject Modal */}
      {showRejectModal && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowRejectModal(false)}>
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-white text-lg font-semibold mb-3">Reject {selected.size > 1 ? `${selected.size} posts` : 'Post'}</h3>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason..." rows={3} className="w-full mb-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] resize-y outline-none placeholder:text-white/30" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] cursor-pointer">Cancel</button>
            <button onClick={() => selected.size > 1 ? bulkAction('reject') : singleAction(Array.from(selected)[0], 'reject')} disabled={!rejectReason.trim() || actionLoading} className={`px-5 py-2 text-white rounded-xl text-[13px] font-bold ${!rejectReason.trim() || actionLoading ? 'bg-white/10 cursor-not-allowed' : 'bg-red-700 cursor-pointer hover:bg-red-600'}`}>Confirm</button>
          </div>
        </div>
      </div>}

      {/* Retry Modal */}
      {showRetryModal && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowRetryModal(false)}>
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-white text-lg font-semibold mb-3">Request Revision</h3>
          <textarea value={retryGuidance} onChange={e => setRetryGuidance(e.target.value)} placeholder="Guidance for the author..." rows={4} maxLength={2000} className="w-full mb-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] resize-y outline-none placeholder:text-white/30" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowRetryModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] cursor-pointer">Cancel</button>
            <button onClick={() => singleAction(Array.from(selected)[0], 'retry')} disabled={!retryGuidance.trim() || actionLoading} className={`px-5 py-2 text-white rounded-xl text-[13px] font-bold ${!retryGuidance.trim() || actionLoading ? 'bg-white/10 cursor-not-allowed' : 'bg-orange-600 cursor-pointer hover:bg-orange-500'}`}>Send Guidance</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
