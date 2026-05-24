'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';

interface Cat {
  id: string; name: string; slug: string; description?: string; icon?: string;
  parent_id?: string; post_count: number; is_featured: boolean; is_archived: boolean;
  sort_order: number; status: string;
  health_score?: number; grown?: boolean; dead?: boolean;
  children?: Cat[];
}

type Tab = 'tree' | 'table' | 'analytics' | 'bulk';

export default function AdminCategoriesClient() {
  const [tab, setTab] = useState<Tab>('tree');
  const [categories, setCategories] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Cat | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('published');
  const [editSort, setEditSort] = useState(0);
  const [editFeatured, setEditFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newParent, setNewParent] = useState('');

  const [analytics, setAnalytics] = useState<{ distribution: Array<{ name: string; total_posts: number }> } | null>(null);
  const [health, setHealth] = useState<{ dead: Cat[]; overloaded: Cat[] } | null>(null);

  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [reparentTarget, setReparentTarget] = useState('');

  const fetchCats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ categories: Cat[] }>('/categories');
      setCategories(data.categories);
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [a, h] = await Promise.all([
        apiFetch<{ distribution: Array<{ name: string; total_posts: number }> }>('/categories/analytics'),
        apiFetch<{ dead: Cat[]; overloaded: Cat[] }>('/categories/health'),
      ]);
      setAnalytics(a); setHealth(h);
    } catch {}
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);
  useEffect(() => { if (tab === 'analytics') fetchAnalytics(); }, [tab, fetchAnalytics]);

  const selectCat = (cat: Cat) => {
    setSelected(cat);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditDesc(cat.description || '');
    setEditStatus(cat.status || 'published');
    setEditSort(cat.sort_order || 0);
    setEditFeatured(cat.is_featured || false);
  };

  const handleSave = async () => {
    if (!selected || !selected.parent_id) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/categories/${selected.id}`, {
        method: 'PATCH', body: JSON.stringify({
          name: editName, slug: editSlug, description: editDesc,
          is_featured: editFeatured, sort_order: editSort, status: editStatus,
        }),
      });
      toast.success('Category updated');
      fetchCats();
      setSelected(null);
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await apiFetch('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim() || undefined, parent_id: newParent || undefined }),
      });
      toast.success('Category created');
      setShowCreate(false); setNewName(''); setNewSlug(''); setNewParent('');
      fetchCats();
    } catch { toast.error('Failed'); }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this category?')) return;
    try { await apiFetch(`/admin/categories/${id}`, { method: 'DELETE' }); toast.success('Archived'); fetchCats(); } catch { toast.error('Failed'); }
  };

  const handleDuplicate = async (id: string) => {
    try { await apiFetch(`/admin/categories/${id}/duplicate`, { method: 'POST' }); toast.success('Duplicated'); fetchCats(); } catch { toast.error('Failed'); }
  };

  const handlePublish = async (id: string) => {
    try { await apiFetch(`/admin/categories/${id}/publish`, { method: 'POST' }); toast.success('Published'); fetchCats(); } catch { toast.error('Failed'); }
  };

  const handleHide = async (id: string) => {
    try { await apiFetch(`/admin/categories/${id}/hide`, { method: 'POST' }); toast.success('Hidden'); fetchCats(); } catch { toast.error('Failed'); }
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget) return toast.error('Select both categories');
    if (!confirm(`Merge ${mergeSource} into ${mergeTarget}?`)) return;
    try { await apiFetch('/categories/bulk/merge', { method: 'POST', body: JSON.stringify({ sourceid: mergeSource, targetid: mergeTarget }) }); toast.success('Merged'); fetchCats(); } catch { toast.error('Failed'); }
  };

  const handleReparent = async () => {
    if (bulkIds.size === 0 || !reparentTarget) return toast.error('Select categories and target');
    try { await apiFetch('/categories/bulk/reparent', { method: 'POST', body: JSON.stringify({ ids: Array.from(bulkIds), new_parent_id: reparentTarget }) }); toast.success('Reparented'); fetchCats(); } catch { toast.error('Failed'); }
  };

  const handleExport = () => { window.open('/api/categories/export'); };

  const toggleExpanded = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const parents = categories.filter(c => !c.parent_id);
  const childrenFromParents = parents.flatMap(p => (p.children || []).map(c => ({ ...c, parent_id: p.id })));
  const allCats = [...parents, ...childrenFromParents];
  const parentOptions = parents.filter(c => !c.is_archived);

  const filtered = search ? allCats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search)) : allCats;

  const primaryBtnClass = (disabled?: boolean) => `px-4 py-2 text-white border-none rounded-xl cursor-pointer text-xs font-bold min-h-11 ${disabled ? 'bg-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-pink-500 cursor-pointer'}`;
  const inputClass = 'px-2.5 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white outline-none w-full sm:w-auto min-h-11';
  const cardClass = 'bg-white/5 border border-white/5 rounded-2xl p-4 mb-4';

  if (loading) return <div className="p-5 text-white/40">Loading...</div>;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2 text-white">
          <Icon name="Folder" size={22} color="var(--color-orange-400)" /> Category Management
        </h1>
        <button onClick={() => setShowCreate(!showCreate)} className={primaryBtnClass()}>+ Create</button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1"><label className="text-3xs text-white/40 block mb-1">Name *</label><input value={newName} onChange={e => setNewName(e.target.value)} className={inputClass} /></div>
          <div className="flex-1"><label className="text-3xs text-white/40 block mb-1">Slug</label><input value={newSlug} onChange={e => setNewSlug(e.target.value)} className={inputClass} /></div>
          <div className="flex-1"><label className="text-3xs text-white/40 block mb-1">Parent</label><select value={newParent} onChange={e => setNewParent(e.target.value)} className={inputClass}><option value="" className="bg-zinc-900">None (parent)</option>{parentOptions.map(p => <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>)}</select></div>
          <button onClick={handleCreate} className={primaryBtnClass()}>Create</button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex mb-4 border-b border-white/10 overflow-x-auto -mx-2 px-2">
        <button onClick={() => setTab('tree')} className={`px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm2 whitespace-nowrap min-h-11 ${tab === 'tree' ? 'font-bold text-orange-400 border-b-2 border-orange-400' : 'text-white/40 border-b-2 border-transparent'}`}>Tree</button>
        <button onClick={() => setTab('table')} className={`px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm2 whitespace-nowrap min-h-11 ${tab === 'table' ? 'font-bold text-orange-400 border-b-2 border-orange-400' : 'text-white/40 border-b-2 border-transparent'}`}>Table</button>
        <button onClick={() => setTab('analytics')} className={`px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm2 whitespace-nowrap min-h-11 ${tab === 'analytics' ? 'font-bold text-orange-400 border-b-2 border-orange-400' : 'text-white/40 border-b-2 border-transparent'}`}>Analytics</button>
        <button onClick={() => setTab('bulk')} className={`px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm2 whitespace-nowrap min-h-11 ${tab === 'bulk' ? 'font-bold text-orange-400 border-b-2 border-orange-400' : 'text-white/40 border-b-2 border-transparent'}`}>Bulk</button>
      </div>

      {/* TREE */}
      {tab === 'tree' && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-[320px] flex-shrink-0 max-h-[70vh] overflow-auto border border-white/10 rounded-xl p-3 bg-white/5">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full px-2.5 py-2.5 border border-white/10 rounded-lg text-xs mb-2.5 bg-white/5 text-white outline-none min-h-11" />
            {parents.map(p => {
              const kids = p.children || [];
              const isOpen = expanded.has(p.id);
              return <div key={p.id}>
                <div onClick={() => { toggleExpanded(p.id); selectCat(p); }}
                  className={`px-2.5 py-2.5 cursor-pointer rounded-lg font-bold text-sm2 flex items-center gap-1.5 text-white min-h-11 ${selected?.id === p.id ? 'bg-orange-500/10' : 'bg-transparent'}`}>
                  <span className="text-2xs text-white/40 w-3 flex-shrink-0">{isOpen ? '\u25BC' : '\u25B6'}</span>
                  <span><Icon name="Folder" size={14} /></span> <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-3xs text-white/40 font-mono tabular-nums flex-shrink-0">{p.post_count}</span>
                  {p.is_featured && <Icon name="Star" size={10} color="#f57c00" />}
                  {p.status === 'draft' && <span className="text-2xs bg-orange-500/15 px-1 py-px rounded text-orange-400 flex-shrink-0">draft</span>}
                </div>
                {isOpen && kids.map(c => <div key={c.id} onClick={() => selectCat(c)}
                  className={`pl-7 py-2 px-2 cursor-pointer rounded-lg text-xs flex items-center gap-1 text-white min-h-11 ${selected?.id === c.id ? 'bg-orange-500/10' : 'bg-transparent'}`}>
                  <span><Icon name="FileText" size={12} /></span> <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-2xs text-white/40 font-mono tabular-nums flex-shrink-0">{c.post_count}</span>
                </div>)}
              </div>;
            })}
          </div>

          <div className="flex-1 min-w-0">
            {selected ? (
              <div className={cardClass}>
                <h2 className="text-base font-bold mb-3 text-white flex items-center gap-1.5">
                  <Icon name="Folder" size={18} color="var(--color-orange-400)" /> {selected.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm2">
                  <div><label className="text-3xs text-white/40 block mb-1">Name</label><input value={editName} onChange={e => setEditName(e.target.value)} disabled={!selected.parent_id} className={`${inputClass} ${!selected.parent_id ? 'opacity-50' : ''}`} /></div>
                  <div><label className="text-3xs text-white/40 block mb-1">Slug</label><input value={editSlug} onChange={e => setEditSlug(e.target.value)} disabled={!selected.parent_id} className={`${inputClass} ${!selected.parent_id ? 'opacity-50' : ''}`} /></div>
                  <div><label className="text-3xs text-white/40 block mb-1">Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} disabled={!selected.parent_id} className={`${inputClass} ${!selected.parent_id ? 'opacity-50' : ''}`}>
                      <option value="published" className="bg-zinc-900">Published</option><option value="draft" className="bg-zinc-900">Draft</option><option value="hidden" className="bg-zinc-900">Hidden</option>
                    </select>
                  </div>
                  <div><label className="text-3xs text-white/40 block mb-1">Sort Order</label><input type="number" value={editSort} onChange={e => setEditSort(parseInt(e.target.value) || 0)} disabled={!selected.parent_id} className={`${inputClass} ${!selected.parent_id ? 'opacity-50' : ''}`} /></div>
                  <div className="flex items-end pb-1"><label className="text-3xs text-white/40 flex items-center gap-2 min-h-11"><input type="checkbox" checked={editFeatured} onChange={e => setEditFeatured(e.target.checked)} disabled={!selected.parent_id} className="w-4 h-4" /> Featured</label></div>
                </div>
                {!selected.parent_id && (
                  <div className="mt-2.5 px-3 py-2.5 bg-orange-500/10 rounded-lg text-xs text-orange-400 flex items-center gap-1.5">
                    <Icon name="TriangleAlert" size={12} /> Parent categories are locked. Only child categories can be edited.
                  </div>
                )}
                <div className="mt-3.5 text-xs text-white/60 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Posts: <strong className="text-white font-mono tabular-nums">{selected.post_count}</strong></span>
                  <span>Health: <strong className={selected.grown ? 'text-green-400 font-mono tabular-nums' : 'text-white/40'}>{selected.health_score || '\u2014'}</strong></span>
                  {selected.grown && <span className="flex items-center gap-1"><Icon name="TrendingUp" size={12} color="#2e7d32" /> Growing</span>}
                  {selected.dead && <span className="flex items-center gap-1"><Icon name="TriangleAlert" size={12} color="#e65100" /> Dead</span>}
                </div>
                {selected.parent_id && (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <button onClick={handleSave} disabled={saving} className={primaryBtnClass(saving)}>{saving ? 'Saving...' : 'Save'}</button>
                    <button onClick={() => handleDuplicate(selected.id)} className="px-4 py-2 bg-orange-500 text-white border-none rounded-xl cursor-pointer text-xs font-bold hover:bg-orange-400 min-h-11">Duplicate</button>
                    {selected.status !== 'published' && <button onClick={() => handlePublish(selected.id)} className="px-4 py-2 bg-green-600 text-white border-none rounded-xl cursor-pointer text-xs font-bold hover:bg-green-500 min-h-11">Publish</button>}
                    {selected.status !== 'hidden' && <button onClick={() => handleHide(selected.id)} className="px-4 py-2 bg-white/10 text-white border-none rounded-xl cursor-pointer text-xs font-bold hover:bg-white/20 min-h-11">Hide</button>}
                    <button onClick={() => handleArchive(selected.id)} className="px-4 py-2 bg-red-700 text-white border-none rounded-xl cursor-pointer text-xs font-bold hover:bg-red-600 min-h-11">Archive</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-16 text-center text-white/40 text-sm">
                Select a category from the tree to edit it
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABLE */}
      {tab === 'table' && (
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories..." className="px-2.5 py-2.5 border border-white/10 rounded-lg text-xs mb-3 w-full sm:w-[250px] bg-white/5 text-white outline-none min-h-11" />

          {/* Mobile card view */}
          <div className="sm:hidden flex flex-col gap-2">
            {filtered.map(c => {
              const parentName = categories.find(p => p.id === c.parent_id)?.name;
              return (
                <div key={c.id} className="bg-white/5 border border-white/5 rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-semibold truncate">{c.name}</div>
                      <div className="text-white/40 text-3xs font-mono">{c.slug}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.is_featured && <Icon name="Star" size={12} color="#f57c00" />}
                      <span className={`text-2xs px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider whitespace-nowrap ${c.status === 'draft' ? 'bg-orange-500/15 text-orange-400' : c.status === 'hidden' ? 'bg-white/10 text-white/40' : 'bg-green-500/15 text-green-400'}`}>{c.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-3xs text-white/50 mb-2.5">
                    {parentName && <span>Parent: <span className="text-white/70">{parentName}</span></span>}
                    <span className="font-mono tabular-nums">Posts: <span className="text-white/70">{c.post_count}</span></span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { selectCat(c); setTab('tree'); }} className="flex-1 px-3 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-none rounded-xl cursor-pointer text-xs font-bold min-h-11">Edit</button>
                    <button onClick={() => handleArchive(c.id)} className="flex-1 px-3 py-2 bg-red-700 text-white border-none rounded-xl cursor-pointer text-xs font-bold min-h-11">Archive</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead><tr className="border-b-2 border-white/10 text-left text-white/40">
                <th className="p-2">Name</th><th className="p-2">Slug</th><th className="p-2">Parent</th><th className="p-2">Posts</th><th className="p-2">Status</th><th className="p-2">Featured</th><th className="p-2">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => <tr key={c.id} className="border-b border-white/5">
                  <td className="p-2 font-bold text-white">{c.name}</td>
                  <td className="p-2 text-white/40">{c.slug}</td>
                  <td className="p-2 text-white/40">{categories.find(p => p.id === c.parent_id)?.name || '\u2014'}</td>
                  <td className="p-2 text-white/60">{c.post_count}</td>
                  <td className="p-2"><span className={`text-2xs px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${c.status === 'draft' ? 'bg-orange-500/15 text-orange-400' : c.status === 'hidden' ? 'bg-white/10 text-white/40' : 'bg-green-500/15 text-green-400'}`}>{c.status}</span></td>
                  <td className="p-2">{c.is_featured ? <Icon name="Star" size={12} color="#f57c00" /> : ''}</td>
                  <td className="p-2 flex gap-1">
                    <button onClick={() => { selectCat(c); setTab('tree'); }} className="px-2.5 py-1 text-3xs bg-gradient-to-r from-orange-500 to-pink-500 text-white border-none rounded-xl cursor-pointer font-bold">Edit</button>
                    <button onClick={() => handleArchive(c.id)} className="px-2.5 py-1 text-3xs bg-red-700 text-white border-none rounded-xl cursor-pointer font-bold">Archive</button>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <div>
          {analytics && (
            <div className={cardClass}>
              <h3 className="text-base2 font-bold mb-3 flex items-center gap-1.5 text-white">
                <Icon name="ChartBar" size={16} /> Content Distribution
              </h3>
              {analytics.distribution.map(d => (
                <div key={d.name} className="mb-2 flex items-center gap-2.5">
                  <span className="w-[120px] text-sm2 font-bold text-white flex-shrink-0 truncate">{d.name}</span>
                  <div className="flex-1 bg-white/5 rounded-lg h-5 overflow-hidden min-w-0">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg flex items-center justify-end pr-1.5" style={{ width: `${Math.min(100, (d.total_posts / Math.max(1, analytics.distribution[0]?.total_posts || 1)) * 100)}%` }}>
                      <span className="text-2xs text-white">{d.total_posts}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {health && (
            <div className={cardClass}>
              <h3 className="text-base2 font-bold mb-3 text-white flex items-center gap-1.5">
                <Icon name="HeartPulse" size={16} color="var(--color-orange-400)" /> Health
              </h3>
              {health.dead.length > 0 && <div className="mb-2.5">
                <strong className="text-red-500">Dead Categories ({health.dead.length})</strong>
                {health.dead.map(d => <div key={d.id} className="text-xs text-white/60">{d.name} ({d.slug})</div>)}
              </div>}
              {health.overloaded.length > 0 && <div>
                <strong className="text-orange-500">Overloaded ({health.overloaded.length})</strong>
                {health.overloaded.map(o => <div key={o.id} className="text-xs text-white/60">{o.name} \u2014 {o.post_count} posts</div>)}
              </div>}
              {health.dead.length === 0 && health.overloaded.length === 0 && <div className="text-green-400 text-sm2 flex items-center gap-1"><Icon name="Check" size={14} color="#2e7d32" /> All categories healthy</div>}
            </div>
          )}
        </div>
      )}

      {/* BULK */}
      {tab === 'bulk' && (
        <div className="flex flex-col gap-4 max-w-[600px]">
          <div className={cardClass}>
            <h3 className="text-sm font-bold mb-2 text-white">Merge Category</h3>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <select value={mergeSource} onChange={e => setMergeSource(e.target.value)} className={inputClass}><option value="">Source...</option>{allCats.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}</select>
              <span className="text-white/40 text-center py-1">{'\u2192'}</span>
              <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className={inputClass}><option value="">Target...</option>{allCats.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}</select>
              <button onClick={handleMerge} className={primaryBtnClass()}>Merge</button>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-sm font-bold mb-2 text-white">Reparent Categories</h3>
            <div className="mb-2 text-xs text-white/60">Select categories below, then choose a new parent:</div>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-3">
              <select value={reparentTarget} onChange={e => setReparentTarget(e.target.value)} className={inputClass}><option value="">New parent...</option>{parentOptions.map(p => <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>)}</select>
              <button onClick={handleReparent} className={primaryBtnClass()}>Reparent {bulkIds.size > 0 ? `(${bulkIds.size})` : ''}</button>
            </div>
            {filtered.map(c => <label key={c.id} className="flex items-center gap-2 text-xs py-1.5 text-white cursor-pointer min-h-11"><input type="checkbox" checked={bulkIds.has(c.id)} onChange={() => { const n = new Set(bulkIds); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setBulkIds(n); }} className="w-4 h-4" /> {c.name} <span className="text-white/40">({c.slug})</span></label>)}
          </div>

          <div className={cardClass}>
            <h3 className="text-sm font-bold mb-2 text-white">Export</h3>
            <button onClick={handleExport} className={primaryBtnClass()}>Download CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}
