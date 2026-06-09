'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/dates';
import type { HallOfFameEntry, HallOfFameCandidate } from '@/lib/api/types';

interface FeaturedResponse { featured: HallOfFameEntry[] }
interface CandidatesResponse { candidates: HallOfFameCandidate[] }

type ViewMode = 'featured' | 'candidates';

export default function AdminHallOfFameClient() {
  const [viewMode, setViewMode] = useState<ViewMode>('featured');
  const [featured, setFeatured] = useState<HallOfFameEntry[]>([]);
  const [candidates, setCandidates] = useState<HallOfFameCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const fetchFeatured = useCallback(async () => {
    try {
      const data = await apiFetch<FeaturedResponse>('/admin/hall-of-fame');
      setFeatured(data.featured || []);
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      const data = await apiFetch<CandidatesResponse>('/admin/hall-of-fame/candidates');
      setCandidates(data.candidates || []);
    } catch {}
  }, []);

  useEffect(() => { fetchFeatured(); fetchCandidates(); }, [fetchFeatured, fetchCandidates]);

  const handleFeature = async (postId: string) => {
    try {
      await apiFetch('/admin/hall-of-fame', { method: 'POST', body: JSON.stringify({ post_id: postId, editorial_note: null }) });
      toast.success('Post featured.');
      fetchFeatured();
      fetchCandidates();
    } catch { toast.error('Failed to feature post.'); }
  };

  const handleRemove = async (id: string) => {
    try {
      await apiFetch(`/admin/hall-of-fame/${id}`, { method: 'DELETE' });
      toast.success('Removed from Hall of Fame.');
      setConfirmRemoveId(null);
      fetchFeatured();
    } catch { toast.error('Failed to remove.'); }
  };

  const handleMove = async (index: number, direction: number) => {
    const items = [...featured];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    setReordering(true);

    const reordered = [...items];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setFeatured(reordered);

    try {
      const order = reordered.map((e, i) => ({ id: e.id, sort_order: i }));
      await apiFetch('/admin/hall-of-fame/reorder', { method: 'PATCH', body: JSON.stringify({ order }) });
      toast.success('Reordered.');
    } catch {
      setFeatured(items);
      toast.error('Failed to reorder.');
    } finally { setReordering(false); }
  };

  const startEditNote = (entry: HallOfFameEntry) => {
    setEditingId(entry.id);
    setEditNote(entry.editorial_note || '');
  };

  const saveEditNote = async (id: string) => {
    try {
      await apiFetch(`/admin/hall-of-fame/${id}/editorial-note`, { method: 'PATCH', body: JSON.stringify({ editorial_note: editNote }) });
      toast.success('Editorial note updated.');
      setEditingId(null);
      fetchFeatured();
    } catch { toast.error('Failed to update note.'); }
  };

  const btnSmClass = 'text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white min-h-7 min-w-[28px] flex items-center justify-center';
  const btnDangerSm = `${btnSmClass} text-red-400`;
  const tabClass = (mode: ViewMode) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer min-h-11 flex items-center gap-1.5 ${
    viewMode === mode ? 'bg-white/10 text-white border border-white/20' : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'
  }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-white text-lg font-bold">Hall of Fame</h2>
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
          <button onClick={() => { setViewMode('featured'); setLoading(true); fetchFeatured(); setLoading(false); }} className={tabClass('featured')}>
            <Icon name="Star" size={14} /> Featured
          </button>
          <button onClick={() => { setViewMode('candidates'); fetchCandidates(); }} className={tabClass('candidates')}>
            <Icon name="Users" size={14} /> Candidates
          </button>
        </div>
      </div>

      {viewMode === 'featured' && (
        <div className="space-y-2">
          {loading ? (
            <p className="text-zinc-500 text-sm">Loading...</p>
          ) : featured.length === 0 ? (
            <div className="bg-white/5 border border-white/5 rounded-2xl p-10 text-center">
              <Icon name="Star" size={40} className="text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">No featured posts yet.</p>
              <p className="text-zinc-600 text-sm">Switch to the Candidates tab to feature posts.</p>
            </div>
          ) : (
            <>
              <div className="lg:hidden flex flex-col gap-2">
                {featured.map((entry, i) => {
                  const post = entry.post;
                  const warning = entry.status_warning;
                  return (
                    <div key={entry.id} className={`bg-white/5 border rounded-2xl p-3.5 ${warning ? 'border-red-500/30' : 'border-white/5'}`}>
                      {warning && (
                        <div className="flex items-center gap-1.5 mb-2 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                          <Icon name="TriangleAlert" size={12} className="text-red-400" />
                          <span className="text-red-400 text-3xs font-medium">
                            {warning === 'deleted' ? 'Post deleted after featuring' : `Post status: ${warning}`}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-zinc-500 font-mono text-xs">#{i + 1}</span>
                        {post ? (
                          <a href={`/${post.slug}`} target="_blank" rel="noreferrer" className="text-white text-sm font-semibold no-underline hover:text-orange-400 truncate">
                            {post.title}
                          </a>
                        ) : (
                          <span className="text-zinc-600 text-sm italic">Post unavailable</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-3xs text-zinc-500 mb-2">
                        {post ? (
                          <>
                            <span>{post.author_username}</span>
                            <span className="flex items-center gap-1"><Icon name="MessageCircle" size={12} /> {post.comment_count}</span>
                            <span className="flex items-center gap-1"><Icon name="Eye" size={14} /> {post.view_count}</span>
                          </>
                        ) : (
                          <span className="text-zinc-600 italic">Post data unavailable</span>
                        )}
                        <span suppressHydrationWarning>{formatDate(entry.featured_at)}</span>
                      </div>

                      {editingId === entry.id ? (
                        <div className="flex gap-1 mb-2">
                          <textarea
                            value={editNote}
                            onChange={e => setEditNote(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs min-h-15 resize-y outline-none"
                            placeholder="Editorial note..."
                          />
                          <div className="flex flex-col gap-1">
                            <button aria-label="Save note" onClick={() => saveEditNote(entry.id)} className={btnSmClass}><Icon name="Check" size={12} /></button>
                            <button aria-label="Cancel edit" onClick={() => setEditingId(null)} className={btnDangerSm}><Icon name="X" size={12} /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1 mb-2">
                          <p
                            onClick={() => startEditNote(entry)}
                            className={`flex-1 text-xs cursor-pointer min-h-6 leading-relaxed rounded px-1.5 py-0.5 border border-transparent hover:bg-white/5 hover:border-white/10 ${entry.editorial_note ? 'text-zinc-400 italic' : 'text-zinc-600'}`}
                          >
                            {entry.editorial_note || 'Click to add editorial note...'}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-1 flex-wrap items-center">
                        <button onClick={() => handleMove(i, -1)} disabled={i === 0 || reordering}
                          className={`${btnSmClass} ${i === 0 || reordering ? 'opacity-30 cursor-not-allowed' : ''}`}
                          title="Move up" aria-label="Move up"
                        >
                          <Icon name="ArrowUp" size={12} />
                        </button>
                        <button onClick={() => handleMove(i, 1)} disabled={i === featured.length - 1 || reordering}
                          className={`${btnSmClass} ${i === featured.length - 1 || reordering ? 'opacity-30 cursor-not-allowed' : ''}`}
                          title="Move down" aria-label="Move down"
                        >
                          <Icon name="ArrowDown" size={12} />
                        </button>
                        {confirmRemoveId === entry.id ? (
                          <>
                            <button onClick={() => handleRemove(entry.id)} className={`${btnSmClass} text-red-400 border-red-500/30`}>Confirm</button>
                            <button onClick={() => setConfirmRemoveId(null)} className={btnSmClass}>Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmRemoveId(entry.id)} className={btnDangerSm}>
                            <Icon name="Trash2" size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-white/10 text-left text-zinc-500">
                      <th className="p-2 w-[40px]">#</th>
                      <th className="p-2">Post</th>
                      <th className="p-2">Author</th>
                      <th className="p-2 w-[200px]">Editorial Note</th>
                      <th className="p-2">Featured</th>
                      <th className="p-2">Stats</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featured.map((entry, i) => {
                      const post = entry.post;
                      const warning = entry.status_warning;
                      return (
                        <tr key={entry.id} className={`border-b border-white/5 hover:bg-white/5 ${warning ? 'bg-red-500/5' : ''}`}>
                          <td className="p-2 text-zinc-500 font-mono">{i + 1}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {warning && (
                                <span className="shrink-0 bg-red-500/10 border border-red-500/20 text-red-400 text-2xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                  <Icon name="TriangleAlert" size={10} />
                                  {warning === 'deleted' ? 'Deleted' : warning}
                                </span>
                              )}
                              {post ? (
                                <a href={`/${post.slug}`} target="_blank" rel="noreferrer" className="text-white no-underline hover:text-orange-400 font-medium">
                                  {post.title?.length > 60 ? post.title.substring(0, 60) + '...' : post.title}
                                </a>
                              ) : (
                                <span className="text-zinc-600 italic text-xs">Post unavailable</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-zinc-400">{post?.author_username || <span className="text-zinc-600 italic">--</span>}</td>
                          <td className="p-2">
                            {editingId === entry.id ? (
                              <div className="flex gap-1">
                                <input
                                  value={editNote}
                                  onChange={e => setEditNote(e.target.value)}
                                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white text-xs outline-none"
                                  placeholder="Editorial note..."
                                  onKeyDown={e => { if (e.key === 'Enter') saveEditNote(entry.id); if (e.key === 'Escape') setEditingId(null); }}
                                  autoFocus
                                />
                                <button onClick={() => saveEditNote(entry.id)} className={btnSmClass} aria-label="Save" title="Save"><Icon name="Check" size={12} /></button>
                                <button onClick={() => setEditingId(null)} className={btnDangerSm} aria-label="Cancel" title="Cancel"><Icon name="X" size={12} /></button>
                              </div>
                            ) : (
                              <p
                                onClick={() => startEditNote(entry)}
                                className={`text-xs cursor-pointer min-h-5 leading-relaxed rounded px-1 py-0.5 border border-transparent hover:bg-white/5 hover:border-white/10 ${entry.editorial_note ? 'text-zinc-400 italic' : 'text-zinc-600'}`}
                              >
                                {entry.editorial_note || 'Click to add'}
                              </p>
                            )}
                          </td>
                          <td className="p-2 text-zinc-400" suppressHydrationWarning>{formatDate(entry.featured_at)}</td>
                          <td className="p-2 text-zinc-400">
                            {post ? (
                              <>
                                <span className="mr-2"><Icon name="MessageCircle" size={12} /> {post.comment_count}</span>
                                <span><Icon name="Eye" size={14} /> {post.view_count}</span>
                              </>
                            ) : (
                              <span className="text-zinc-600 italic">--</span>
                            )}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1 items-center">
                              <button onClick={() => handleMove(i, -1)} disabled={i === 0 || reordering}
                                className={`${btnSmClass} ${i === 0 || reordering ? 'opacity-30 cursor-not-allowed' : ''}`}
                                title="Move up" aria-label="Move up"
                              >
                                <Icon name="ArrowUp" size={12} />
                              </button>
                              <button onClick={() => handleMove(i, 1)} disabled={i === featured.length - 1 || reordering}
                                className={`${btnSmClass} ${i === featured.length - 1 || reordering ? 'opacity-30 cursor-not-allowed' : ''}`}
                                title="Move down" aria-label="Move down"
                              >
                                <Icon name="ArrowDown" size={12} />
                              </button>
                              {confirmRemoveId === entry.id ? (
                                <span className="flex gap-1">
                                  <button onClick={() => handleRemove(entry.id)} className={`${btnSmClass} text-red-400 border-red-500/30`}>Confirm</button>
                                  <button onClick={() => setConfirmRemoveId(null)} className={btnSmClass}>Cancel</button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmRemoveId(entry.id)} className={btnDangerSm} aria-label="Remove" title="Remove">
                                  <Icon name="Trash2" size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {viewMode === 'candidates' && (
        <div className="space-y-3">
          {candidates.length === 0 ? (
            <div className="bg-white/5 border border-white/5 rounded-2xl p-10 text-center">
              <Icon name="Users" size={40} className="text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">No candidates found.</p>
              <p className="text-zinc-600 text-sm max-w-md mx-auto">Posts need 10+ comments or 500+ views from last 90 days.</p>
            </div>
          ) : (
            <>
              <div className="lg:hidden flex flex-col gap-2">
                {candidates.map(c => (
                  <div key={c.id} className="bg-white/5 border border-white/5 rounded-2xl p-3.5">
                    <p className="text-white text-sm font-semibold mb-1">{c.title}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-3xs text-zinc-500 mb-2">
                      <span>{c.author_username}</span>
                      <span className="flex items-center gap-1"><Icon name="MessageCircle" size={12} /> {c.comment_count}</span>
                      <span className="flex items-center gap-1"><Icon name="Eye" size={14} /> {c.view_count}</span>
                    </div>
                    <button onClick={() => handleFeature(c.id)} className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:from-orange-600 hover:to-pink-600 transition-all min-h-9">
                      Feature
                    </button>
                  </div>
                ))}
              </div>

              <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {candidates.map(c => (
                  <div key={c.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col">
                    <p className="text-white font-medium text-sm mb-1 line-clamp-2">{c.title}</p>
                    <p className="text-zinc-500 text-xs mb-1">{c.author_username}</p>
                    <div className="flex gap-3 text-3xs text-zinc-500 mb-3">
                      <span className="flex items-center gap-1"><Icon name="MessageCircle" size={12} /> {c.comment_count}</span>
                      <span className="flex items-center gap-1"><Icon name="Eye" size={14} /> {c.view_count}</span>
                    </div>
                    <button onClick={() => handleFeature(c.id)} className="mt-auto bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:from-orange-600 hover:to-pink-600 transition-all min-h-9">
                      Feature
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
