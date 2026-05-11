'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { toast } from '@/lib/toast';

interface Post { _id: string; title: string; slug: string; author_username: string; post_type: string; status: string; category_slug: string; comment_count: number; fire_count?: number; view_count: number; created_at: string; published_at?: string; deleted: boolean; featured: boolean; comments_locked: boolean }

export default function AllPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', post_type: '', search: '', sort: 'newest' });
  const [stats, setStats] = useState<Record<string, number>>({});

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

  const statusBadge = (s: string) => { const map: Record<string, { bg: string; c: string }> = { pending_review: { bg: '#fff3e0', c: '#e65100' }, approved: { bg: '#e8f5e9', c: '#2e7d32' }, rejected: { bg: '#ffebee', c: '#c62828' } }; const m = map[s] || { bg: '#eee', c: '#333' }; return <span style={{ background: m.bg, color: m.c, padding: '1px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>{s}</span>; };

  const statCards = ['total', 'pending', 'approved', 'rejected', 'deleted', 'featured', 'locked'];

  return (<div>
    <h2>All Posts ({pagination.total})</h2>

    <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
      {statCards.map(k => <div key={k} style={{ background: '#f5f5f5', padding: '4px 10px', borderRadius: '4px', fontSize: '12px' }}><strong>{k}</strong>: {stats[k] ?? 0}</div>)}
    </div>

    <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
      <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }} style={{ padding: '6px' }}>
        <option value="">All Status</option><option value="pending_review">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="deleted">Deleted</option>
      </select>
      <select value={filters.post_type} onChange={e => { setFilters(f => ({ ...f, post_type: e.target.value })); setPage(1); }} style={{ padding: '6px' }}>
        <option value="">All Types</option><option value="top_list">Top List</option><option value="best_of">Best Of</option><option value="worst_of">Worst Of</option><option value="hidden_gems">Hidden Gems</option><option value="counter_list">Counter List</option>
      </select>
      <select value={filters.sort} onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1); }} style={{ padding: '6px' }}>
        <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="most_comments">Most Comments</option><option value="most_views">Most Views</option>
      </select>
      <input placeholder="Search title/intro" value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} style={{ padding: '6px', width: '180px' }} />
    </div>

    {selected.size > 0 && (<div style={{ background: '#e3f2fd', padding: '6px 12px', borderRadius: '4px', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
      <strong>{selected.size} selected</strong>
      <button onClick={() => bulkAction('delete')} disabled={actionLoading}>Delete</button>
      <button onClick={() => bulkAction('feature')} disabled={actionLoading}>Feature</button>
      <button onClick={() => bulkAction('unfeature')} disabled={actionLoading}>Unfeature</button>
    </div>)}

    {loading ? <p>Loading...</p> : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead><tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
          <th style={{ padding: '6px', width: '30px' }}><input type="checkbox" checked={selected.size === posts.length && posts.length > 0} onChange={selectAll} /></th>
          <th style={{ padding: '6px' }}>Title</th><th style={{ padding: '6px' }}>Author</th><th style={{ padding: '6px' }}>Category</th><th style={{ padding: '6px' }}>Type</th><th style={{ padding: '6px' }}>Status</th><th style={{ padding: '6px' }}><Icon name="Flame" size={12} color="#e65100" /></th><th style={{ padding: '6px' }}><Icon name="MessageCircle" size={12} /></th><th style={{ padding: '6px' }}><Icon name="Eye" size={14} /></th><th style={{ padding: '6px' }}>Published</th><th style={{ padding: '6px' }}>Actions</th>
        </tr></thead>
        <tbody>
          {posts.map(p => (<tr key={p._id} style={{ borderBottom: '1px solid #eee', opacity: p.deleted ? 0.5 : 1 }}>
            <td style={{ padding: '4px' }}><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} /></td>
            <td style={{ padding: '4px' }}><a href="#" onClick={e => { e.preventDefault(); window.open(`/${p.slug}`, '_blank'); }} style={{ textDecoration: 'none' }}>{p.title?.substring(0, 50)}{(p.title?.length || 0) > 50 ? '...' : ''}</a>{p.featured && <span style={{ marginLeft: '4px' }}><Icon name="Star" size={12} color="#f57c00" /></span>}{p.comments_locked && <span style={{ marginLeft: '4px' }}><Icon name="Lock" size={12} /></span>}</td>
            <td style={{ padding: '4px' }}>{p.author_username}</td>
            <td style={{ padding: '4px', fontSize: '11px', color: '#666' }}>{p.category_slug}</td>
            <td style={{ padding: '4px', fontSize: '11px' }}>{p.post_type}</td>
            <td style={{ padding: '4px' }}>{statusBadge(p.status)}</td>
            <td style={{ padding: '4px' }}>{p.fire_count || 0}</td>
            <td style={{ padding: '4px' }}>{p.comment_count}</td>
            <td style={{ padding: '4px' }}>{p.view_count}</td>
            <td style={{ padding: '4px', fontSize: '11px' }}>{p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}</td>
            <td style={{ padding: '4px' }}>
              {p.deleted ? <button onClick={() => quickAction(p._id, 'restore')} style={{ fontSize: '11px', cursor: 'pointer' }}>Restore</button> : <>
                <button onClick={() => router.push(`/admin/posts/pending/${p._id}`)} style={{ fontSize: '11px', cursor: 'pointer' }}>View</button>
                <button onClick={() => quickAction(p._id, 'delete')} style={{ fontSize: '11px', cursor: 'pointer', color: '#c62828' }}>Del</button>
                <button onClick={() => quickAction(p._id, 'bump')} style={{ fontSize: '11px', cursor: 'pointer' }}>Bump</button>
                <button onClick={() => router.push(`/admin/posts/${p._id}/edit`)} style={{ fontSize: '11px', cursor: 'pointer' }}>Edit</button>
              </>}
              {p.featured ? <button onClick={() => quickAction(p._id, 'unfeature')} style={{ fontSize: '11px', cursor: 'pointer' }}>Unfeat</button> : <button onClick={() => quickAction(p._id, 'feature')} style={{ fontSize: '11px', cursor: 'pointer' }}>Feat</button>}
              {p.comments_locked ? <button onClick={() => quickAction(p._id, 'unlock')} style={{ fontSize: '11px', cursor: 'pointer' }}>Unlock</button> : <button onClick={() => quickAction(p._id, 'lock')} style={{ fontSize: '11px', cursor: 'pointer' }}>Lock</button>}
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
  </div>);
}
