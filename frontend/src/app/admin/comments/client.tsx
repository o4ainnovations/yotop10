'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon, type LucideIconName } from '@/components/icons/Icon';
import { formatDate } from '@/lib/dates';

interface Comment { _id: string; id: string; content: string; author_username: string; post_id: string; post_slug: string | null; post_title: string | null; spark_score: number; fire_count: number; reply_count: number; depth: number; is_item_anchored: boolean; depth_badge: string | null; created_at: string; deleted: boolean; hidden: boolean; highlighted: boolean; flag_type: string | null; flag_evidence: Record<string, unknown> | null; }

export default function AdminCommentsClient() {
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
  const [mobileDropdownId, setMobileDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
  const selectAll = () => selected.size === comments.length ? setSelected(new Set()) : setSelected(new Set(comments.map(c => c._id)));

  const quickAction = async (id: string, action: string) => {
    setMobileDropdownId(null);
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
    const map: Record<string, { label: string; icon: LucideIconName; colorClass: string }> = { spam_repetition: { label: 'Spam', icon: 'TriangleAlert', colorClass: 'bg-orange-600' }, spam_link_first: { label: 'Spam', icon: 'Link', colorClass: 'bg-orange-600' }, brigade_referrer: { label: 'Brigade', icon: 'BellDot', colorClass: 'bg-red-700' }, brigade_fresh: { label: 'Brigade', icon: 'BellDot', colorClass: 'bg-red-700' } };
    const m = map[type] || { label: '', icon: 'TriangleAlert' as LucideIconName, colorClass: 'bg-white/20' };
    return <span className={`${m.colorClass} text-white rounded-full px-2.5 py-0.5 text-3xs font-semibold uppercase tracking-wider cursor-pointer`}><Icon name={m.icon} size={10} color="#fff" /> {m.label}</span>;
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

  const filterSelectClass = 'bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none min-h-11 w-full sm:w-auto';
  const btnSmClass = 'text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white';
  const dropdownItemClass = 'w-full text-left px-4 py-2.5 text-sm2 text-white hover:bg-white/10 flex items-center gap-2 min-h-11';

  return (
    <div className="space-y-3 sm:space-y-4 px-3 sm:px-6">
      <h2 className="text-white text-lg font-bold">All Comments ({pagination.total})</h2>

      <div className="text-2xs font-mono text-zinc-600">
        DOUBLE-BLIND REVIEW — Decisions based on content, not author reputation
      </div>

      <div className="flex gap-2 flex-wrap">
        {statCards.map(k => (
          <div key={k} onClick={() => applyStatFilter(k)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 cursor-pointer hover:border-orange-500/30 min-h-11 flex items-center">
            <strong className="text-white mr-1">{k}</strong>: {stats[k] ?? 0}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <select value={filters.type} onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }} className={filterSelectClass}>
          <option value="" className="bg-zinc-900">All Types</option><option value="post_comment" className="bg-zinc-900">Post Comment</option><option value="item_anchored" className="bg-zinc-900">Item Anchored</option>
        </select>
        <select value={filters.sort} onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1); }} className={filterSelectClass}>
          <option value="newest" className="bg-zinc-900">Newest</option><option value="oldest" className="bg-zinc-900">Oldest</option><option value="most_fire" className="bg-zinc-900">Most Fire</option><option value="most_replies" className="bg-zinc-900">Most Replies</option><option value="highest_spark" className="bg-zinc-900">Highest Spark</option>
        </select>
        <select value={filters.has_replies} onChange={e => { setFilters(f => ({ ...f, has_replies: e.target.value })); setPage(1); }} className={filterSelectClass}>
          <option value="" className="bg-zinc-900">All</option><option value="yes" className="bg-zinc-900">Has Replies</option><option value="no" className="bg-zinc-900">No Replies</option>
        </select>
        <input placeholder="Search content" value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} className={`${filterSelectClass} sm:w-[180px]`} />
      </div>

      {selected.size > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 flex flex-col sm:flex-row gap-2 items-start sm:items-center text-sm2">
          <strong className="text-white">{selected.size} selected</strong>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => bulkAction('delete')} disabled={actionLoading} className={`${btnSmClass} min-h-11 sm:min-h-7`}>Delete</button>
            <button onClick={() => bulkAction('hide')} disabled={actionLoading} className={`${btnSmClass} min-h-11 sm:min-h-7`}>Hide</button>
            <button onClick={() => bulkAction('flag')} disabled={actionLoading} className={`${btnSmClass} min-h-11 sm:min-h-7`}>Flag</button>
            <button onClick={() => bulkAction('unflag')} disabled={actionLoading} className={`${btnSmClass} min-h-11 sm:min-h-7`}>Unflag</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-white/40">Loading...</p> : comments.length === 0 ? <p className="text-white/40">No comments found.</p> : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden flex flex-col gap-2">
            {comments.map(c => (
              <div key={c._id} className={`bg-white/5 border border-white/5 rounded-2xl p-3 ${c.deleted ? 'opacity-40' : ''} ${c.highlighted ? 'bg-orange-500/10' : ''} ${c.hidden ? 'bg-white/5' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleSelect(c._id)} className="min-h-11 min-w-11" />
                  <span className="text-2xs text-white/40 font-mono">{String(c._id).slice(-6)}</span>
                  <span className="text-white/60 text-sm font-semibold flex-1">{c.author_username}</span>
                  {/* Mobile dropdown trigger */}
                  <div className="relative" ref={mobileDropdownId === c._id ? dropdownRef : null}>
                    <button
                      onClick={e => { e.stopPropagation(); setMobileDropdownId(prev => prev === c._id ? null : c._id); }}
                      className="min-h-11 min-w-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg"
                    >
                      <Icon name="Ellipsis" size={18} />
                    </button>
                    {mobileDropdownId === c._id && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-white/10 rounded-xl py-1 min-w-[180px] shadow-2xl">
                        {c.deleted ? (
                          <>
                            <button onClick={e => { e.stopPropagation(); quickAction(c._id, 'restore'); }} className={dropdownItemClass}><Icon name="Undo2" size={14} /> Restore</button>
                            <button onClick={e => { e.stopPropagation(); if (confirm('Permanently delete this comment?')) quickAction(c._id, 'remove'); }} className={`${dropdownItemClass} text-red-400`}><Icon name="Trash2" size={14} /> Remove</button>
                          </>
                        ) : (
                          <>
                            <button onClick={e => { e.stopPropagation(); quickAction(c._id, 'delete'); }} className={`${dropdownItemClass} text-red-400`}><Icon name="Trash2" size={14} /> Delete</button>
                            {c.hidden
                              ? <button onClick={e => { e.stopPropagation(); quickAction(c._id, 'unhide'); }} className={dropdownItemClass}><Icon name="Eye" size={14} /> Show</button>
                              : <button onClick={e => { e.stopPropagation(); quickAction(c._id, 'hide'); }} className={dropdownItemClass}><Icon name="EyeOff" size={14} /> Hide</button>
                            }
                            {c.highlighted
                              ? <button onClick={e => { e.stopPropagation(); quickAction(c._id, 'unhighlight'); }} className={dropdownItemClass}><Icon name="PinOff" size={14} /> Unpin</button>
                              : <button onClick={e => { e.stopPropagation(); quickAction(c._id, 'highlight'); }} className={dropdownItemClass}><Icon name="Pin" size={14} /> Pin</button>
                            }
                            {c.flag_type
                              ? <button onClick={e => { e.stopPropagation(); quickAction(c._id, 'unflag'); }} className={`${dropdownItemClass} text-green-400`}><Icon name="FlagOff" size={14} /> Unflag</button>
                              : <button onClick={e => { e.stopPropagation(); setMobileDropdownId(null); setFlagModal({ comment: c }); }} className={`${dropdownItemClass} text-orange-400`}><Icon name="Flag" size={14} /> Flag</button>
                            }
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <a href={`/${c.post_slug || '#'}`} target="_blank" className="text-orange-400 text-3xs no-underline hover:text-orange-300 block truncate">
                  {(c.post_title || c.post_slug || '\u2014').substring(0, 30)}
                </a>
                <p className="text-white/60 text-xs my-1.5">
                  {c.depth_badge ? <span className="bg-white/5 px-1 py-px rounded text-2xs mr-1 text-white/40">{c.depth_badge}</span> : null}
                  {c.content?.substring(0, 80)}{(c.content?.length || 0) > 80 ? '...' : ''}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-3xs text-white/50">
                  <span>{c.is_item_anchored ? <><Icon name="Target" size={11} /> Item</> : <><Icon name="MessageCircle" size={11} /> Post</>}</span>
                  <span><Icon name="Flame" size={12} color="#e65100" /> {c.fire_count}</span>
                  <span><Icon name="MessageCircle" size={12} /> {c.reply_count}</span>
                  <span><Icon name="Sparkles" size={12} /> {Number(c.spark_score).toFixed(2)}</span>
                  <span suppressHydrationWarning>{formatDate(c.created_at)}</span>
                </div>
                {c.flag_type && isAutoFlag(c.flag_type) && <span onClick={e => { e.stopPropagation(); dismissFlag(c._id); }} className="cursor-pointer mt-1 inline-block">{flagBadge(c.flag_type)}</span>}
                {c.flag_type === 'manual' && <span className="mt-1 inline-block">{flagBadge(c.flag_type)}</span>}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead><tr className="border-b-2 border-white/10 text-left text-white/40">
                <th className="p-2 w-[30px]"><input type="checkbox" checked={selected.size === comments.length && comments.length > 0} onChange={selectAll} /></th>
                <th className="p-2 w-[40px]">ID</th><th className="p-2">Post</th><th className="p-2">Content</th><th className="p-2">Author</th><th className="p-2">Type</th>
                <th className="p-2"><Icon name="Flame" size={12} color="#e65100" /></th><th className="p-2"><Icon name="MessageCircle" size={12} /></th><th className="p-2"><Icon name="Sparkles" size={12} /></th>
                <th className="p-2">Created</th><th className="p-2">Actions</th>
              </tr></thead>
              <tbody>
                {comments.map(c => (<tr key={c._id} className={`border-b border-white/5 ${c.deleted ? 'opacity-40' : ''} ${c.highlighted ? 'bg-orange-500/10' : ''} ${c.hidden ? 'bg-white/5' : ''}`}>
                  <td className="p-1.5"><input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleSelect(c._id)} /></td>
                  <td className="p-1.5 text-2xs text-white/30 font-mono">{String(c._id).slice(-6)}</td>
                  <td className="p-1.5 text-3xs">
                    <a href={`/${c.post_slug || '#'}`} target="_blank" className="text-orange-400 no-underline hover:text-orange-300" title={c.post_title || ''}>
                      {(c.post_title || c.post_slug || '\u2014').substring(0, 30)}
                    </a>
                  </td>
                  <td className="p-1.5">
                    {c.depth_badge ? <span className="bg-white/5 px-1 py-px rounded text-2xs mr-1 text-white/40">{c.depth_badge}</span> : null}
                    <a href={`/${c.post_slug || '#'}`} target="_blank" onClick={e => { if (!c.post_slug) e.preventDefault(); }} className="no-underline text-white/60 hover:text-white/80">
                      {c.content?.substring(0, 80)}{(c.content?.length || 0) > 80 ? '...' : ''}
                    </a>
                  </td>
                  <td className="p-1.5 text-white/60">{c.author_username}</td>
                  <td className="p-1.5 text-3xs">{c.is_item_anchored ? <><Icon name="Target" size={11} /> Item</> : <><Icon name="MessageCircle" size={11} /> Post</>} {c.flag_type && isAutoFlag(c.flag_type) && <span onClick={e => { e.stopPropagation(); dismissFlag(c._id); }} className="cursor-pointer">{flagBadge(c.flag_type)}</span>}{c.flag_type === 'manual' && <span>{flagBadge(c.flag_type)}</span>}</td>
                  <td className="p-1.5 text-white/60">{c.fire_count}</td>
                  <td className="p-1.5 text-white/60">{c.reply_count}</td>
                  <td className="p-1.5 text-3xs text-white/60">{Number(c.spark_score).toFixed(2)}</td>
                  <td className="p-1.5 text-3xs text-white/40" suppressHydrationWarning>{formatDate(c.created_at)}</td>
                  <td className="p-1.5">
                    {c.deleted ? <><button onClick={() => quickAction(c._id, 'restore')} className={btnSmClass}>Restore</button><button onClick={() => { if (confirm('Permanently delete this comment?')) quickAction(c._id, 'remove'); }} className={`${btnSmClass} text-red-400`}>Rem</button></> : <>
                      <button onClick={() => quickAction(c._id, 'delete')} className={`${btnSmClass} text-red-400`}>Del</button>
                      {c.hidden ? <button onClick={() => quickAction(c._id, 'unhide')} className={btnSmClass}>Show</button> : <button onClick={() => quickAction(c._id, 'hide')} className={btnSmClass}>Hide</button>}
                      {c.highlighted ? <button onClick={() => quickAction(c._id, 'unhighlight')} className={btnSmClass}>Unpin</button> : <button onClick={() => quickAction(c._id, 'highlight')} className={btnSmClass}>Pin</button>}
                      {c.flag_type ? <button onClick={() => quickAction(c._id, 'unflag')} className={`${btnSmClass} text-green-400`}>Unf</button> : <button onClick={() => setFlagModal({ comment: c })} className={`${btnSmClass} text-orange-400`}>Flag</button>}
                    </>}
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

      {/* Flag Modal — full-screen on mobile */}
      {flagModal && (() => { const rec = getRecommended(flagModal.comment); const ev = flagModal.comment.flag_evidence || {};
        return (
          <div className="fixed inset-0 z-[200] flex sm:items-center sm:justify-center bg-black/40 p-0 sm:p-4" onClick={() => setFlagModal(null)}>
            <div className="bg-zinc-900 border border-white/10 sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl h-full sm:h-auto flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-semibold mb-3">Flag: {flagModal.comment.flag_type?.replace(/_/g, ' ')}</h3>
              <div className="bg-white/5 rounded-xl p-3 mb-3 text-xs text-white/60">
                <p className="mb-1"><strong className="text-white">Comment:</strong> &ldquo;{flagModal.comment.content?.substring(0, 100)}&rdquo;</p>
                <p className="mb-1"><strong className="text-white">Author:</strong> {flagModal.comment.author_username}</p>
                <p><strong className="text-white">Evidence:</strong> {JSON.stringify(ev)}</p>
              </div>
              <p className="text-sm2 text-white/60 mb-3">Recommended: <strong className="text-white">{rec.minutes}min pause, {rec.trust_penalty} trust</strong></p>
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <button onClick={() => applyPenalty(flagModal.comment._id, rec.minutes, rec.trust_penalty)} className="px-4 py-2.5 cursor-pointer bg-orange-600 text-white border-none rounded-xl text-sm2 font-bold hover:bg-orange-500 min-h-11">Apply Recommended</button>
                {isAutoFlag(flagModal.comment.flag_type) && <button onClick={() => dismissFlag(flagModal.comment._id)} className="px-4 py-2.5 cursor-pointer bg-white/5 border border-white/10 rounded-xl text-sm2 text-white min-h-11">Dismiss Warning</button>}
              </div>
              <div className="border-t border-white/10 pt-3 mt-auto sm:mt-0">
                <p className="text-xs font-bold mb-2 text-white">Custom:</p>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input value={customMin} onChange={e => setCustomMin(e.target.value)} placeholder={`${rec.minutes} min`} className="w-full sm:w-[70px] px-2 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white outline-none min-h-11" />
                    <span className="text-white/40 text-xs">min</span>
                    <input value={customTrust} onChange={e => setCustomTrust(e.target.value)} placeholder={`${rec.trust_penalty} trust`} className="w-full sm:w-[90px] px-2 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white outline-none min-h-11" />
                    <span className="text-white/40 text-xs">trust</span>
                  </div>
                  <button onClick={() => { const m = parseInt(customMin) || rec.minutes; const t = parseFloat(customTrust) || rec.trust_penalty; applyPenalty(flagModal.comment._id, m, t); }} className="px-4 py-2.5 cursor-pointer text-xs bg-white/5 border border-white/10 rounded-xl text-white min-h-11 w-full sm:w-auto">Apply</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
