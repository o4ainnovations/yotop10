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

export default function AdminCategoriesPage() {
  const [tab, setTab] = useState<Tab>('tree');
  const [categories, setCategories] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Cat | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('published');
  const [editSort, setEditSort] = useState(0);
  const [editFeatured, setEditFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newParent, setNewParent] = useState('');

  // Analytics
  const [analytics, setAnalytics] = useState<{ distribution: Array<{ name: string; total_posts: number }> } | null>(null);
  const [health, setHealth] = useState<{ dead: Cat[]; overloaded: Cat[] } | null>(null);

  // Bulk
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

  const bt = (a: boolean): React.CSSProperties => ({ padding: '8px 14px', border: 'none', borderBottom: a ? '2px solid #1565c0' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: a ? 'bold' : 'normal', color: a ? '#1565c0' : '#666' });
  const btn = (d?: boolean) => ({ padding: '6px 14px', background: d ? '#ccc' : '#1565c0', color: '#fff', border: 'none', borderRadius: '4px', cursor: d ? 'not-allowed' : 'pointer', fontSize: '12px' });
  const inp = { padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="Folder" size={22} /> Category Management</h1>
        <button onClick={() => setShowCreate(!showCreate)} style={btn()}>+ Create</button>
      </div>

      {showCreate && (
        <div style={{ marginBottom: '16px', padding: '14px', background: '#f5f5f5', borderRadius: '6px', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><label style={{ fontSize: '11px', display: 'block' }}>Name *</label><input value={newName} onChange={e => setNewName(e.target.value)} style={inp} /></div>
          <div><label style={{ fontSize: '11px', display: 'block' }}>Slug</label><input value={newSlug} onChange={e => setNewSlug(e.target.value)} style={inp} /></div>
          <div><label style={{ fontSize: '11px', display: 'block' }}>Parent</label><select value={newParent} onChange={e => setNewParent(e.target.value)} style={inp}><option value="">None (parent)</option>{parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <button onClick={handleCreate} style={btn()}>Create</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid #ddd' }}>
        <button onClick={() => setTab('tree')} style={bt(tab === 'tree')}>Tree</button>
        <button onClick={() => setTab('table')} style={bt(tab === 'table')}>Table</button>
        <button onClick={() => setTab('analytics')} style={bt(tab === 'analytics')}>Analytics</button>
        <button onClick={() => setTab('bulk')} style={bt(tab === 'bulk')}>Bulk</button>
      </div>

      {/* ═══ TREE ════════════════════════════════════════════ */}
      {tab === 'tree' && (
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ width: '320px', flexShrink: 0, maxHeight: '70vh', overflow: 'auto', border: '1px solid #eee', borderRadius: '6px', padding: '10px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box' }} />
            {parents.map(p => {
              const kids = p.children || [];
              const isOpen = expanded.has(p.id);
              const icon = p.icon || <Icon name="Folder" size={14} />;
              return <div key={p.id}>
                <div onClick={() => { toggleExpanded(p.id); selectCat(p); }}
                  style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', background: selected?.id === p.id ? '#e3f2fd' : 'transparent', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px' }}>{isOpen ? '▼' : '▶'}</span>
                  <span>{icon}</span> <span>{p.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#999' }}>{p.post_count}</span>
                  {p.is_featured && <span style={{ fontSize: '10px', color: '#f57c00' }}><Icon name="Star" size={10} /></span>}
                  {p.status === 'draft' && <span style={{ fontSize: '10px', background: '#fff3e0', padding: '1px 4px', borderRadius: '2px' }}>draft</span>}
                </div>
                {isOpen && kids.map(c => <div key={c.id} onClick={() => selectCat(c)}
                  style={{ padding: '4px 8px 4px 28px', cursor: 'pointer', borderRadius: '3px', background: selected?.id === c.id ? '#e3f2fd' : 'transparent', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span><Icon name="FileText" size={12} /></span> <span>{c.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#999' }}>{c.post_count}</span>
                </div>)}
              </div>;
            })}
          </div>

          <div style={{ flex: 1 }}>
            {selected ? (
              <div style={{ border: '1px solid #eee', borderRadius: '6px', padding: '16px' }}>
                <h2 style={{ fontSize: '16px', margin: '0 0 12px' }}>{selected.icon || <Icon name="Folder" size={18} />} {selected.name}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div><label style={lbl}>Name</label><input value={editName} onChange={e => setEditName(e.target.value)} disabled={!selected.parent_id} style={{ width: '100%', ...inp, background: selected.parent_id ? '#fff' : '#f5f5f5' }} /></div>
                  <div><label style={lbl}>Slug</label><input value={editSlug} onChange={e => setEditSlug(e.target.value)} disabled={!selected.parent_id} style={{ width: '100%', ...inp, background: selected.parent_id ? '#fff' : '#f5f5f5' }} /></div>
                  <div><label style={lbl}>Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} disabled={!selected.parent_id} style={{ width: '100%', ...inp, background: selected.parent_id ? '#fff' : '#f5f5f5' }}>
                      <option value="published">Published</option><option value="draft">Draft</option><option value="hidden">Hidden</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Sort Order</label><input type="number" value={editSort} onChange={e => setEditSort(parseInt(e.target.value) || 0)} disabled={!selected.parent_id} style={{ width: '80px', ...inp, background: selected.parent_id ? '#fff' : '#f5f5f5' }} /></div>
                  <div><label style={lbl}><input type="checkbox" checked={editFeatured} onChange={e => setEditFeatured(e.target.checked)} disabled={!selected.parent_id} />Featured</label></div>
                </div>
                {!selected.parent_id && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fff3e0', borderRadius: '4px', fontSize: '12px', color: '#e65100' }}>
                    <Icon name="TriangleAlert" size={12} color="#e65100" /> Parent categories are locked. Only child categories can be edited.
                  </div>
                )}
                <div style={{ marginTop: '14px', fontSize: '12px', color: '#666' }}>
                  Posts: <strong>{selected.post_count}</strong> · Health: <strong style={{ color: selected.grown ? '#2e7d32' : '#999' }}>{selected.health_score || '—'}</strong>
                  {selected.grown && <span style={{ marginLeft: '6px' }}><Icon name="TrendingUp" size={12} color="#2e7d32" /> Growing</span>}
                  {selected.dead && <span style={{ marginLeft: '6px' }}><Icon name="TriangleAlert" size={12} color="#e65100" /> Dead</span>}
                </div>
                {selected.parent_id && (
                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={handleSave} disabled={saving} style={btn(saving)}>{saving ? '...' : 'Save'}</button>
                    <button onClick={() => handleDuplicate(selected.id)} style={{ ...btn(), background: '#f57c00' }}>Duplicate</button>
                    {selected.status !== 'published' && <button onClick={() => handlePublish(selected.id)} style={{ ...btn(), background: '#2e7d32' }}>Publish</button>}
                    {selected.status !== 'hidden' && <button onClick={() => handleHide(selected.id)} style={{ ...btn(), background: '#666' }}>Hide</button>}
                    <button onClick={() => handleArchive(selected.id)} style={{ ...btn(), background: '#c62828' }}>Archive</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '60px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
                Select a category from the tree to edit it
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TABLE ════════════════════════════════════════════ */}
      {tab === 'table' && (
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories..." style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', marginBottom: '12px', width: '250px' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead><tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '6px' }}>Name</th><th style={{ padding: '6px' }}>Slug</th><th style={{ padding: '6px' }}>Parent</th><th style={{ padding: '6px' }}>Posts</th><th style={{ padding: '6px' }}>Status</th><th style={{ padding: '6px' }}>Featured</th><th style={{ padding: '6px' }}>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '6px', fontWeight: 'bold' }}>{c.icon || <Icon name="Folder" size={14} />} {c.name}</td>
                <td style={{ padding: '6px', color: '#999' }}>{c.slug}</td>
                <td style={{ padding: '6px', color: '#999' }}>{categories.find(p => p.id === c.parent_id)?.name || '—'}</td>
                <td style={{ padding: '6px' }}>{c.post_count}</td>
                <td style={{ padding: '6px' }}><span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: c.status === 'draft' ? '#fff3e0' : c.status === 'hidden' ? '#f5f5f5' : '#e8f5e9' }}>{c.status}</span></td>
                <td style={{ padding: '6px' }}>{c.is_featured ? <Icon name="Star" size={12} color="#f57c00" /> : ''}</td>
                <td style={{ padding: '6px', display: 'flex', gap: '4px' }}>
                  <button onClick={() => { selectCat(c); setTab('tree'); }} style={{ ...btn(), padding: '3px 8px', fontSize: '11px' }}>Edit</button>
                  <button onClick={() => handleArchive(c.id)} style={{ ...btn(), padding: '3px 8px', fontSize: '11px', background: '#c62828' }}>Archive</button>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ ANALYTICS ════════════════════════════════════════ */}
      {tab === 'analytics' && (
        <div>
          {analytics && (
            <div style={{ marginBottom: '20px', padding: '16px', background: '#fafafa', borderRadius: '6px', border: '1px solid #eee' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="BarChart3" size={16} /> Content Distribution</h3>
              {analytics.distribution.map(d => (
                <div key={d.name} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '120px', fontSize: '13px', fontWeight: 'bold' }}>{d.name}</span>
                  <div style={{ flex: 1, background: '#e0e0e0', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#1565c0', width: `${Math.min(100, (d.total_posts / Math.max(1, analytics.distribution[0]?.total_posts || 1)) * 100)}%`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#fff' }}>{d.total_posts}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {health && (
            <div style={{ padding: '16px', background: '#fafafa', borderRadius: '6px', border: '1px solid #eee' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '15px' }}>🏥 Health</h3>
              {health.dead.length > 0 && <div style={{ marginBottom: '10px' }}>
                <strong style={{ color: '#c62828' }}>Dead Categories ({health.dead.length})</strong>
                {health.dead.map(d => <div key={d.id} style={{ fontSize: '12px', color: '#666' }}>• {d.name} ({d.slug})</div>)}
              </div>}
              {health.overloaded.length > 0 && <div>
                <strong style={{ color: '#f57c00' }}>Overloaded ({health.overloaded.length})</strong>
                {health.overloaded.map(o => <div key={o.id} style={{ fontSize: '12px', color: '#666' }}>• {o.name} — {o.post_count} posts</div>)}
              </div>}
              {health.dead.length === 0 && health.overloaded.length === 0 && <div style={{ color: '#2e7d32', fontSize: '13px' }}><Icon name="Check" size={14} color="#2e7d32" /> All categories healthy</div>}
            </div>
          )}
        </div>
      )}

      {/* ═══ BULK ════════════════════════════════════════════ */}
      {tab === 'bulk' && (
        <div style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
          <div style={{ padding: '14px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 8px' }}>Merge Category</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={mergeSource} onChange={e => setMergeSource(e.target.value)} style={inp}><option value="">Source...</option>{allCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <span>→</span>
              <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} style={inp}><option value="">Target...</option>{allCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <button onClick={handleMerge} style={btn()}>Merge</button>
            </div>
          </div>

          <div style={{ padding: '14px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 8px' }}>Reparent Categories</h3>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              Select categories in the table, then choose a new parent:
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={reparentTarget} onChange={e => setReparentTarget(e.target.value)} style={inp}><option value="">New parent...</option>{parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <button onClick={handleReparent} style={btn()}>Reparent {bulkIds.size > 0 ? `(${bulkIds.size})` : ''}</button>
            </div>
            {filtered.map(c => <label key={c.id} style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}><input type="checkbox" checked={bulkIds.has(c.id)} onChange={() => { const n = new Set(bulkIds); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setBulkIds(n); }} /> {c.name} ({c.slug})</label>)}
          </div>

          <div style={{ padding: '14px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 8px' }}>Export</h3>
            <button onClick={handleExport} style={btn()}>Download CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: '11px', color: '#666', display: 'block', marginBottom: '2px' };
