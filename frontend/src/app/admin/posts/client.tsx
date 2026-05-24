'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/dates';

interface Post { _id: string; title: string; slug: string; author_username: string; post_type: string; status: string; category_slug: string; comment_count: number; fire_count?: number; view_count: number; created_at: string; published_at?: string; deleted: boolean; featured: boolean; comments_locked: boolean }

export default function AdminPostsClient() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', post_type: '', search: '', sort: 'newest' });
  const [stats, setStats] = useState<Record<string, number>>({});
  const [mobileDropdownId, setMobileDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const fetchPosts = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', sort: filters.sort, stats: 'true' });
      if (filters.status) params.set('status', filters.status);
      if (filters.post_type) params.set('post_type', filters.post_type);
      if (filters.search) params.set('search', filters.search);
      const data = await apiFetch<{ posts: Post[]; pagination: { total: number; pages: number }; stats: Record<string, number> }>(`/admin/posts?${params}`);
      setPosts(data.posts); setPagination(data.pagination); setStats(data.stats || {});
    } catch {} finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchPosts(page); }, [page, fetchPosts]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMobileDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleSelect = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectAll = () => selected.size === posts.length ? setSelected(new Set()) : setSelected(new Set(posts.map(p => p._id)));

  const bulkAction = async (action: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setActionLoading(true);
    try {
      if (action === 'delete') { await apiFetch('/admin/posts/bulk/delete', { method: 'POST', body: JSON.stringify({ ids }) }); toast.success('Deleted.'); }
      else if (action === 'feature') { for (const id of ids) await apiFetch(`/admin/posts/${id}/feature`, { method: 'POST' }); toast.success('Featured.'); }
      else if (action === 'unfeature') { for (const id of ids) await apiFetch(`/admin/posts/${id}/unfeature`, { method: 'POST' }); toast.success('Unfeatured.'); }
      setSelected(new Set()); fetchPosts(page);
    } catch {} finally { setActionLoading(false); }
  };

  const quickAction = async (id: string, action: string) => {
    setMobileDropdownId(null);
    try {
      if (action === 'delete') await apiFetch(`/admin/posts/${id}`, { method: 'DELETE' });
      else if (action === 'restore') await apiFetch(`/admin/posts/${id}/restore`, { method: 'POST' });
      else if (action === 'feature') await apiFetch(`/admin/posts/${id}/feature`, { method: 'POST' });
      else if (action === 'unfeature') await apiFetch(`/admin/posts/${id}/unfeature`, { method: 'POST' });
      else if (action === 'lock') await apiFetch(`/admin/posts/${id}/lock`, { method: 'POST' });
      else if (action === 'unlock') await apiFetch(`/admin/posts/${id}/unlock`, { method: 'POST' });
      else if (action === 'bump') await apiFetch(`/admin/posts/${id}/bump`, { method: 'POST' });
      toast.success(`${action} done.`);
      fetchPosts(page);
    } catch {}
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pending_review: 'bg-orange-500/15 text-orange-400', approved: 'bg-green-500/15 text-green-400', rejected: 'bg-red-500/15 text-red-400' };
    const cls = map[s] || 'bg-white/10 text-white/60';
    return <span className={`${cls} rounded-full px-2.5 py-0.5 text-3xs font-semibold uppercase tracking-wider`}>{s}</span>;
  };

  const statCards = ['total', 'pending', 'approved', 'rejected', 'deleted', 'featured', 'locked'];
  const filterSelectClass = 'bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none min-h-11 w-full sm:w-auto';
  const btnSmClass = 'text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white';
  const dropdownItemClass = 'w-full text-left px-4 py-2.5 text-sm2 text-white hover:bg-white/10 flex items-center gap-2 min-h-11';

  return (
    <div className="space-y-3 sm:space-y-4 px-3 sm:px-6">
      <h2 className="text-white text-lg font-bold">All Posts ({pagination.total})</h2>

      <div className="flex gap-2 flex-wrap">
        {statCards.map(k => (
          <div key={k} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 min-h-9 flex items-center">
            <strong className="text-white mr-1">{k}</strong>: {stats[k] ?? 0}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }} className={filterSelectClass}>
          <option value="" className="bg-zinc-900">All Status</option><option value="pending_review" className="bg-zinc-900">Pending</option><option value="approved" className="bg-zinc-900">Approved</option><option value="rejected" className="bg-zinc-900">Rejected</option><option value="deleted" className="bg-zinc-900">Deleted</option>
        </select>
        <select value={filters.post_type} onChange={e => { setFilters(f => ({ ...f, post_type: e.target.value })); setPage(1); }} className={filterSelectClass}>
          <option value="" className="bg-zinc-900">All Types</option><option value="top_list" className="bg-zinc-900">Top List</option><option value="best_of" className="bg-zinc-900">Best Of</option><option value="worst_of" className="bg-zinc-900">Worst Of</option><option value="hidden_gems" className="bg-zinc-900">Hidden Gems</option><option value="counter_list" className="bg-zinc-900">Counter List</option>
        </select>
        <select value={filters.sort} onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1); }} className={filterSelectClass}>
          <option value="newest" className="bg-zinc-900">Newest</option><option value="oldest" className="bg-zinc-900">Oldest</option><option value="most_comments" className="bg-zinc-900">Most Comments</option><option value="most_views" className="bg-zinc-900">Most Views</option>
        </select>
        <input placeholder="Search title/intro" value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} className={`${filterSelectClass} sm:w-[180px]`} />
      </div>

      {selected.size > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 flex flex-col sm:flex-row gap-2 items-start sm:items-center text-sm2">
          <strong className="text-white">{selected.size} selected</strong>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => bulkAction('delete')} disabled={actionLoading} className={`${btnSmClass} min-h-11 sm:min-h-7`}>Delete</button>
            <button onClick={() => bulkAction('feature')} disabled={actionLoading} className={`${btnSmClass} min-h-11 sm:min-h-7`}>Feature</button>
            <button onClick={() => bulkAction('unfeature')} disabled={actionLoading} className={`${btnSmClass} min-h-11 sm:min-h-7`}>Unfeature</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-white/40">Loading...</p> : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden flex flex-col gap-2">
            {posts.map(p => (
              <div key={p._id} className={`bg-white/5 border border-white/5 rounded-2xl p-3 ${p.deleted ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} className="min-h-11 min-w-11" />
                  <a href="#" onClick={e => { e.preventDefault(); window.open(`/${p.slug}`, '_blank'); }} className="text-white text-sm font-semibold no-underline truncate flex-1 min-h-11 flex items-center">
                    {p.title?.substring(0, 50)}{(p.title?.length || 0) > 50 ? '...' : ''}
                  </a>
                  {p.featured && <Icon name="Star" size={12} color="#f57c00" />}
                  {p.comments_locked && <Icon name="Lock" size={12} />}
                  {/* Mobile dropdown trigger */}
                  <div className="relative" ref={mobileDropdownId === p._id ? dropdownRef : null}>
                    <button
                      onClick={e => { e.stopPropagation(); setMobileDropdownId(prev => prev === p._id ? null : p._id); }}
                      className="min-h-11 min-w-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg"
                    >
                      <Icon name="Ellipsis" size={18} />
                    </button>
                    {mobileDropdownId === p._id && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-white/10 rounded-xl py-1 min-w-[180px] shadow-2xl">
                        {p.deleted ? (
                          <button onClick={e => { e.stopPropagation(); quickAction(p._id, 'restore'); }} className={dropdownItemClass}><Icon name="Undo2" size={14} /> Restore</button>
                        ) : (
                          <>
                            <button onClick={e => { e.stopPropagation(); setMobileDropdownId(null); router.push(`/admin/posts/pending/${p._id}`); }} className={dropdownItemClass}><Icon name="Search" size={14} /> View</button>
                            <button onClick={e => { e.stopPropagation(); quickAction(p._id, 'delete'); }} className={`${dropdownItemClass} text-red-400`}><Icon name="Trash2" size={14} /> Delete</button>
                            <button onClick={e => { e.stopPropagation(); quickAction(p._id, 'bump'); }} className={dropdownItemClass}><Icon name="ArrowBigUp" size={14} /> Bump</button>
                            <button onClick={e => { e.stopPropagation(); setMobileDropdownId(null); router.push(`/admin/posts/${p._id}/edit`); }} className={dropdownItemClass}><Icon name="Pencil" size={14} /> Edit</button>
                            {p.featured
                              ? <button onClick={e => { e.stopPropagation(); quickAction(p._id, 'unfeature'); }} className={dropdownItemClass}><Icon name="Star" size={14} /> Unfeature</button>
                              : <button onClick={e => { e.stopPropagation(); quickAction(p._id, 'feature'); }} className={dropdownItemClass}><Icon name="Star" size={14} /> Feature</button>
                            }
                            {p.comments_locked
                              ? <button onClick={e => { e.stopPropagation(); quickAction(p._id, 'unlock'); }} className={dropdownItemClass}><Icon name="LockOpen" size={14} /> Unlock</button>
                              : <button onClick={e => { e.stopPropagation(); quickAction(p._id, 'lock'); }} className={dropdownItemClass}><Icon name="Lock" size={14} /> Lock</button>
                            }
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-3xs text-white/50">
                  <span>{p.author_username}</span>
                  <span>{p.category_slug}</span>
                  <span>{p.post_type}</span>
                  <span>{statusBadge(p.status)}</span>
                  <span><Icon name="Flame" size={12} color="#e65100" /> {p.fire_count || 0}</span>
                  <span><Icon name="MessageCircle" size={12} /> {p.comment_count}</span>
                  <span><Icon name="Eye" size={14} /> {p.view_count}</span>
                  <span suppressHydrationWarning>{p.published_at ? formatDate(p.published_at) : '\u2014'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead><tr className="border-b-2 border-white/10 text-left text-white/40">
                <th className="p-1.5 w-[30px]"><input type="checkbox" checked={selected.size === posts.length && posts.length > 0} onChange={selectAll} /></th>
                <th className="p-1.5">Title</th><th className="p-1.5">Author</th><th className="p-1.5">Category</th><th className="p-1.5">Type</th><th className="p-1.5">Status</th><th className="p-1.5"><Icon name="Flame" size={12} color="#e65100" /></th><th className="p-1.5"><Icon name="MessageCircle" size={12} /></th><th className="p-1.5"><Icon name="Eye" size={14} /></th><th className="p-1.5">Published</th><th className="p-1.5">Actions</th>
              </tr></thead>
              <tbody>
                {posts.map(p => (<tr key={p._id} className={`border-b border-white/5 ${p.deleted ? 'opacity-40' : ''}`}>
                  <td className="p-1"><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} /></td>
                  <td className="p-1">
                    <a href="#" onClick={e => { e.preventDefault(); window.open(`/${p.slug}`, '_blank'); }} className="text-white no-underline hover:text-orange-400">{p.title?.substring(0, 50)}{(p.title?.length || 0) > 50 ? '...' : ''}</a>
                    {p.featured && <span className="ml-1"><Icon name="Star" size={12} color="#f57c00" /></span>}
                    {p.comments_locked && <span className="ml-1"><Icon name="Lock" size={12} /></span>}
                  </td>
                  <td className="p-1 text-white/60">{p.author_username}</td>
                  <td className="p-1 text-3xs text-white/40">{p.category_slug}</td>
                  <td className="p-1 text-3xs text-white/50">{p.post_type}</td>
                  <td className="p-1">{statusBadge(p.status)}</td>
                  <td className="p-1 text-white/60">{p.fire_count || 0}</td>
                  <td className="p-1 text-white/60">{p.comment_count}</td>
                  <td className="p-1 text-white/60">{p.view_count}</td>
                  <td className="p-1 text-3xs text-white/40" suppressHydrationWarning>{p.published_at ? formatDate(p.published_at) : '\u2014'}</td>
                  <td className="p-1">
                    {p.deleted ? <button onClick={() => quickAction(p._id, 'restore')} className={btnSmClass}>Restore</button> : <>
                      <button onClick={() => router.push(`/admin/posts/pending/${p._id}`)} className={btnSmClass}>View</button>
                      <button onClick={() => quickAction(p._id, 'delete')} className={`${btnSmClass} text-red-400`}>Del</button>
                      <button onClick={() => quickAction(p._id, 'bump')} className={btnSmClass}>Bump</button>
                      <button onClick={() => router.push(`/admin/posts/${p._id}/edit`)} className={btnSmClass}>Edit</button>
                    </>}
                    {p.featured ? <button onClick={() => quickAction(p._id, 'unfeature')} className={btnSmClass}>Unfeat</button> : <button onClick={() => quickAction(p._id, 'feature')} className={btnSmClass}>Feat</button>}
                    {p.comments_locked ? <button onClick={() => quickAction(p._id, 'unlock')} className={btnSmClass}>Unlock</button> : <button onClick={() => quickAction(p._id, 'lock')} className={btnSmClass}>Lock</button>}
                  </td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex gap-2 items-center justify-center sm:justify-start">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={`px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm min-h-11 ${page <= 1 ? 'opacity-40 cursor-not-allowed bg-white/5' : 'cursor-pointer bg-white/5 hover:bg-white/10'}`}>Prev</button>
        <span className="text-white/60 text-sm2">Page {page} of {pagination.pages}</span>
        <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className={`px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm min-h-11 ${page >= pagination.pages ? 'opacity-40 cursor-not-allowed bg-white/5' : 'cursor-pointer bg-white/5 hover:bg-white/10'}`}>Next</button>
      </div>
    </div>
  );
}
