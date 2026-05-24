'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';

interface EditPost { _id: string; title: string; intro: string; post_type: string; category_slug: string; status: string; version: number; items: Array<{ _id: string; rank: number; title: string; justification: string }> }

export default function EditPostClient() {
  const router = useRouter(); const params = useParams(); const postId = params.id as string;
  const [post, setPost] = useState<EditPost | null>(null);
  const [title, setTitle] = useState(''); const [intro, setIntro] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [items, setItems] = useState<Array<{ _id?: string; rank: number; title: string; justification: string }>>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ post: EditPost }>(`/admin/posts/${postId}?fields=title,intro,post_type,category_slug,status,version`);
        const p = data.post; setPost(p); setTitle(p.title); setIntro(p.intro || ''); setCategorySlug(p.category_slug);
        const itemsData = await apiFetch<{ post: { items: Array<{ _id: string; rank: number; title: string; justification: string }> } }>(`/admin/posts/pending/${postId}`);
        setItems(itemsData.post.items || []);
      } catch { setError('Failed to load post.'); }
      finally { setLoading(false); }
    })();
  }, [postId]);

  const addItem = () => setItems(prev => [...prev, { rank: prev.length + 1, title: '', justification: '' }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, rank: i + 1 })));

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      await apiFetch(`/admin/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, intro, category_slug: categorySlug, items: items.map(i => ({ rank: i.rank, title: i.title, justification: i.justification })), version: post?.version }),
      });
      toast.success('Post updated.');
      router.push('/admin/posts');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg.includes('CONFLICT') ? 'Post was modified by another session. Reload the page and try again.' : 'Save failed.');
    } finally { setSaving(false); }
  };

  if (loading) return <div>Loading...</div>;
  if (!post) return <div>{error || 'Post not found'}</div>;

  return (<div style={{ maxWidth: '800px' }}>
    <h2>Edit Post</h2>
    {error && <div style={{ background: '#ffebee', padding: '8px', borderRadius: '4px', marginBottom: '12px', color: '#c62828' }}>{error}</div>}
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Title</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '14px' }} />
    </div>
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Intro</label>
      <textarea value={intro} onChange={e => setIntro(e.target.value)} rows={4} style={{ width: '100%', padding: '8px' }} />
    </div>
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Category Slug</label>
      <input value={categorySlug} onChange={e => setCategorySlug(e.target.value)} style={{ width: '100%', padding: '8px' }} />
    </div>
    <div style={{ marginBottom: '12px' }}>
      <h4>Items ({items.length})</h4>
      {items.map((item, idx) => (<div key={idx} style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '8px', marginBottom: '6px' }}>
        <input value={item.title} onChange={e => setItems(prev => prev.map((i, j) => j === idx ? { ...i, title: e.target.value } : i))} placeholder={`Item #${item.rank} title`} style={{ width: '100%', padding: '6px', marginBottom: '4px' }} />
        <textarea value={item.justification} onChange={e => setItems(prev => prev.map((i, j) => j === idx ? { ...i, justification: e.target.value } : i))} placeholder="Justification" rows={2} style={{ width: '100%', padding: '6px' }} />
        <button onClick={() => removeItem(idx)} style={{ fontSize: '11px', color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>Remove</button>
      </div>))}
      <button onClick={addItem} style={{ padding: '6px 14px', cursor: 'pointer' }}>+ Add Item</button>
    </div>
    <div style={{ display: 'flex', gap: '10px' }}>
      <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', fontSize: '14px', cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
      <button onClick={() => router.push('/admin/posts')} style={{ padding: '10px 24px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
    </div>
    <p style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>Version: {post.version} — changes are rejected if another session edits concurrently.</p>
  </div>);
}
