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

  // Design tokens
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'none', cursor: 'pointer', fontSize: '13px',
    fontWeight: active ? 'bold' : 'normal',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
  });
  const primaryBtn = (disabled?: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: disabled ? 'var(--border-primary)' : 'var(--accent-gradient)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold',
  });
  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none',
  };
  const cardStyle: React.CSSProperties = {
    padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)', marginBottom: '16px',
  };

  if (loading) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Icon name="Folder" size={22} color="var(--accent)" /> Category Management
        </h1>
        <button onClick={() => setShowCreate(!showCreate)} style={primaryBtn()}>+ Create</button>
      </div>

      {showCreate && (
        <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><label style={lbl}>Name *</label><input value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} /></div>
          <div><label style={lbl}>Slug</label><input value={newSlug} onChange={e => setNewSlug(e.target.value)} style={inputStyle} /></div>
          <div><label style={lbl}>Parent</label><select value={newParent} onChange={e => setNewParent(e.target.value)} style={inputStyle}><option value="">None (parent)</option>{parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <button onClick={handleCreate} style={primaryBtn()}>Create</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid var(--border-primary)' }}>
        <button onClick={() => setTab('tree')} style={tabBtn(tab === 'tree')}>Tree</button>
        <button onClick={() => setTab('table')} style={tabBtn(tab === 'table')}>Table</button>
        <button onClick={() => setTab('analytics')} style={tabBtn(tab === 'analytics')}>Analytics</button>
        <button onClick={() => setTab('bulk')} style={tabBtn(tab === 'bulk')}>Bulk</button>
      </div>

      {/* TREE */}
      {tab === 'tree' && (
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ width: '320px', flexShrink: 0, maxHeight: '70vh', overflow: 'auto', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '12px', background: 'var(--bg-secondary)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }} />
            {parents.map(p => {
              const kids = p.children || [];
              const isOpen = expanded.has(p.id);
              return <div key={p.id}>
                <div onClick={() => { toggleExpanded(p.id); selectCat(p); }}
                  style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', background: selected?.id === p.id ? 'var(--accent-soft)' : 'transparent', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{isOpen ? '\u25BC' : '\u25B6'}</span>
                  <span><Icon name="Folder" size={14} /></span> <span>{p.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>{p.post_count}</span>
                  {p.is_featured && <Icon name="Star" size={10} color="#f57c00" />}
                  {p.status === 'draft' && <span style={{ fontSize: '10px', background: 'var(--accent-soft)', padding: '1px 4px', borderRadius: '2px', color: 'var(--accent)' }}>draft</span>}
                </div>
                {isOpen && kids.map(c => <div key={c.id} onClick={() => selectCat(c)}
                  style={{ padding: '6px 8px 6px 28px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', background: selected?.id === c.id ? 'var(--accent-soft)' : 'transparent', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-primary)' }}>
                  <span><Icon name="FileText" size={12} /></span> <span>{c.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{c.post_count}</span>
                </div>)}
              </div>;
            })}
          </div>

          <div style={{ flex: 1 }}>
            {selected ? (
              <div style={cardStyle}>
                <h2 style={{ fontSize: '16px', margin: '0 0 12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="Folder" size={18} color="var(--accent)" /> {selected.name}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div><label style={lbl}>Name</label><input value={editName} onChange={e => setEditName(e.target.value)} disabled={!selected.parent_id} style={{ width: '100%', ...inputStyle, opacity: selected.parent_id ? 1 : 0.6 }} /></div>
                  <div><label style={lbl}>Slug</label><input value={editSlug} onChange={e => setEditSlug(e.target.value)} disabled={!selected.parent_id} style={{ width: '100%', ...inputStyle, opacity: selected.parent_id ? 1 : 0.6 }} /></div>
                  <div><label style={lbl}>Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} disabled={!selected.parent_id} style={{ width: '100%', ...inputStyle, opacity: selected.parent_id ? 1 : 0.6 }}>
                      <option value="published">Published</option><option value="draft">Draft</option><option value="hidden">Hidden</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Sort Order</label><input type="number" value={editSort} onChange={e => setEditSort(parseInt(e.target.value) || 0)} disabled={!selected.parent_id} style={{ width: '80px', ...inputStyle, opacity: selected.parent_id ? 1 : 0.6 }} /></div>
                  <div><label style={lbl}><input type="checkbox" checked={editFeatured} onChange={e => setEditFeatured(e.target.checked)} disabled={!selected.parent_id} />Featured</label></div>
                </div>
                {!selected.parent_id && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--accent)' }}>
                    <Icon name="TriangleAlert" size={12} /> Parent categories are locked. Only child categories can be edited.
                  </div>
                )}
                <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Posts: <strong style={{ color: 'var(--text-primary)' }}>{selected.post_count}</strong> · Health: <strong style={{ color: selected.grown ? '#2e7d32' : 'var(--text-muted)' }}>{selected.health_score || '\u2014'}</strong>
                  {selected.grown && <span style={{ marginLeft: '6px' }}><Icon name="TrendingUp" size={12} color="#2e7d32" /> Growing</span>}
                  {selected.dead && <span style={{ marginLeft: '6px' }}><Icon name="TriangleAlert" size={12} color="#e65100" /> Dead</span>}
                </div>
                {selected.parent_id && (
                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={handleSave} disabled={saving} style={primaryBtn(saving)}>{saving ? 'Saving...' : 'Save'}</button>
                    <button onClick={() => handleDuplicate(selected.id)} style={{ ...primaryBtn(), background: '#f57c00' }}>Duplicate</button>
                    {selected.status !== 'published' && <button onClick={() => handlePublish(selected.id)} style={{ ...primaryBtn(), background: '#2e7d32' }}>Publish</button>}
                    {selected.status !== 'hidden' && <button onClick={() => handleHide(selected.id)} style={{ ...primaryBtn(), background: 'var(--text-muted)' }}>Hide</button>}
                    <button onClick={() => handleArchive(selected.id)} style={{ ...primaryBtn(), background: '#c62828' }}>Archive</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                Select a category from the tree to edit it
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABLE */}
      {tab === 'table' && (
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories..." style={{ padding: '8px 10px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '12px', width: '250px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead><tr style={{ borderBottom: '2px solid var(--border-primary)', textAlign: 'left' }}>
              <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Name</th><th style={{ padding: '8px', color: 'var(--text-muted)' }}>Slug</th><th style={{ padding: '8px', color: 'var(--text-muted)' }}>Parent</th><th style={{ padding: '8px', color: 'var(--text-muted)' }}>Posts</th><th style={{ padding: '8px', color: 'var(--text-muted)' }}>Status</th><th style={{ padding: '8px', color: 'var(--text-muted)' }}>Featured</th><th style={{ padding: '8px', color: 'var(--text-muted)' }}>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => <tr key={c.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.name}</td>
                <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{c.slug}</td>
                <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{categories.find(p => p.id === c.parent_id)?.name || '\u2014'}</td>
                <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{c.post_count}</td>
                <td style={{ padding: '8px' }}><span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: c.status === 'draft' ? 'var(--accent-soft)' : c.status === 'hidden' ? 'var(--bg-tertiary)' : '#e8f5e9', color: c.status === 'draft' ? 'var(--accent)' : c.status === 'hidden' ? 'var(--text-muted)' : '#2e7d32' }}>{c.status}</span></td>
                <td style={{ padding: '8px' }}>{c.is_featured ? <Icon name="Star" size={12} color="#f57c00" /> : ''}</td>
                <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                  <button onClick={() => { selectCat(c); setTab('tree'); }} style={{ ...primaryBtn(), padding: '4px 10px', fontSize: '11px' }}>Edit</button>
                  <button onClick={() => handleArchive(c.id)} style={{ ...primaryBtn(), padding: '4px 10px', fontSize: '11px', background: '#c62828' }}>Archive</button>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <div>
          {analytics && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                <Icon name="ChartBar" size={16} color="var(--accent)" /> Content Distribution
              </h3>
              {analytics.distribution.map(d => (
                <div key={d.name} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '120px', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{d.name}</span>
                  <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', height: '20px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent-gradient)', width: `${Math.min(100, (d.total_posts / Math.max(1, analytics.distribution[0]?.total_posts || 1)) * 100)}%`, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#fff' }}>{d.total_posts}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {health && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="HeartPulse" size={16} color="var(--accent)" /> Health
              </h3>
              {health.dead.length > 0 && <div style={{ marginBottom: '10px' }}>
                <strong style={{ color: '#c62828' }}>Dead Categories ({health.dead.length})</strong>
                {health.dead.map(d => <div key={d.id} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.name} ({d.slug})</div>)}
              </div>}
              {health.overloaded.length > 0 && <div>
                <strong style={{ color: '#f57c00' }}>Overloaded ({health.overloaded.length})</strong>
                {health.overloaded.map(o => <div key={o.id} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{o.name} \u2014 {o.post_count} posts</div>)}
              </div>}
              {health.dead.length === 0 && health.overloaded.length === 0 && <div style={{ color: '#2e7d32', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Icon name="Check" size={14} color="#2e7d32" /> All categories healthy</div>}
            </div>
          )}
        </div>
      )}

      {/* BULK */}
      {tab === 'bulk' && (
        <div style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '14px', margin: '0 0 8px', color: 'var(--text-primary)' }}>Merge Category</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={mergeSource} onChange={e => setMergeSource(e.target.value)} style={inputStyle}><option value="">Source...</option>{allCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <span style={{ color: 'var(--text-muted)' }}>{'\u2192'}</span>
              <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} style={inputStyle}><option value="">Target...</option>{allCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <button onClick={handleMerge} style={primaryBtn()}>Merge</button>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: '14px', margin: '0 0 8px', color: 'var(--text-primary)' }}>Reparent Categories</h3>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Select categories in the table, then choose a new parent:
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={reparentTarget} onChange={e => setReparentTarget(e.target.value)} style={inputStyle}><option value="">New parent...</option>{parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <button onClick={handleReparent} style={primaryBtn()}>Reparent {bulkIds.size > 0 ? `(${bulkIds.size})` : ''}</button>
            </div>
            {filtered.map(c => <label key={c.id} style={{ display: 'block', fontSize: '12px', marginTop: '6px', color: 'var(--text-primary)', cursor: 'pointer' }}><input type="checkbox" checked={bulkIds.has(c.id)} onChange={() => { const n = new Set(bulkIds); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setBulkIds(n); }} /> {c.name} ({c.slug})</label>)}
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: '14px', margin: '0 0 8px', color: 'var(--text-primary)' }}>Export</h3>
            <button onClick={handleExport} style={primaryBtn()}>Download CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' };
