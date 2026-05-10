'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

interface SearchResult {
  id: string; title: string; intro?: string; content?: string;
  slug: string; category_slug?: string; post_type?: string;
  author_username: string; author_display_name?: string;
  status?: string; fire_count?: number; comment_count?: number;
  view_count?: number; created_at: string; _score: number;
  highlight?: Record<string, string[]>;
  post_title?: string; post_slug?: string; depth?: number;
  _type?: 'post' | 'comment';
}
interface Facet { key: string; count: number; }
interface SearchResponse {
  posts: SearchResult[]; comments: SearchResult[];
  total: { posts: number; comments: number };
  facets: { categories: Facet[]; post_types: Facet[] };
  suggestions: { original: string; suggestion: string } | null;
  pagination: { page: number; pages: number };
}
interface AutocompleteItem { title?: string; slug?: string; name?: string; highlight?: string; }

const DEBOUNCE_MS = 100;

export default function SearchPage() {
  const sp = useSearchParams();
  const initialQ = sp.get('q') || '';

  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'comments'>('all');
  const [sort, setSort] = useState(sp.get('sort') || '_score');
  const [page, setPage] = useState(1);
  const [categorySlug, setCategorySlug] = useState(sp.get('category_slug') || '');
  const [postType, setPostType] = useState(sp.get('post_type') || '');
  const [author, setAuthor] = useState(sp.get('author') || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ titles: AutocompleteItem[]; categories: AutocompleteItem[] }>({ titles: [], categories: [] });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 2) { setShowSuggestions(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSuggestions({ titles: data.titles || [], categories: data.categories || [] });
        setShowSuggestions(true);
      } catch {}
    }, 100);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  // Debounced search
  const search = useCallback(async (searchPage: number) => {
    if (!q.trim() || q.trim().length < 2) { setResults(null); return; }
    setLoading(true); setError('');

    try {
      const params = new URLSearchParams({ q: q.trim(), page: String(searchPage), sort });
      if (categorySlug) params.set('category_slug', categorySlug);
      if (postType) params.set('post_type', postType);
      if (author) params.set('author', author);
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error('');
      setResults(await res.json());
      if (typeof window !== 'undefined') {
        const url = `/search?${params}`;
        window.history.replaceState(null, '', url);
      }
    } catch { setError('Search failed'); }
    setLoading(false);
  }, [q, sort, categorySlug, postType, author]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 2) { setResults(null); return; }
    timerRef.current = setTimeout(() => search(page), DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q, page, sort, categorySlug, postType, author, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) setShowSuggestions(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setShowSuggestions(false);
    if (e.key === 'Enter') { setShowSuggestions(false); search(page); }
  };

  const selectSuggestion = (text: string) => { setQ(text); setShowSuggestions(false); setPage(1); };

  const allResults = [...(results?.posts || []).map(p => ({ ...p, _type: 'post' as const })), ...(results?.comments || []).map(c => ({ ...c, _type: 'comment' as const }))].sort((a, b) => b._score - a._score);
  const activeResults = activeTab === 'all' ? allResults : activeTab === 'posts' ? (results?.posts || []) : (results?.comments || []);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      {/* Search bar with autocomplete */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input ref={inputRef} type="text" value={q} onChange={e => setQ(e.target.value)} onKeyDown={handleKeyDown}
              onFocus={() => q.length >= 2 && suggestions.titles.length > 0 && setShowSuggestions(true)}
              placeholder="Search posts and comments in real-time..."
              style={{ width: '100%', padding: '14px 18px', fontSize: '17px', border: '2px solid #ddd', borderRadius: '10px', outline: 'none', boxSizing: 'border-box' }}
              autoFocus autoComplete="off"
            />
            {loading && <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#999', fontSize: '13px' }}>...</span>}
          </div>
          <button onClick={() => { setShowSuggestions(false); search(page); }} disabled={loading}
            style={{ padding: '14px 28px', fontSize: '16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            Search
          </button>
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && (suggestions.titles.length > 0 || suggestions.categories.length > 0) && (
          <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: '4px', maxHeight: '360px', overflow: 'auto' }}>
            {suggestions.titles.length > 0 && (
              <div>
                <div style={{ padding: '8px 14px', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Posts</div>
                {suggestions.titles.map(t => (
                  <div key={t.slug} onClick={() => selectSuggestion(t.title || '')} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #f5f5f5' }}
                    dangerouslySetInnerHTML={{ __html: t.highlight || t.title || '' }} />
                ))}
              </div>
            )}
            {suggestions.categories.length > 0 && (
              <div>
                <div style={{ padding: '8px 14px', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid #eee' }}>Categories</div>
                {suggestions.categories.map(c => (
                  <div key={c.slug} onClick={() => selectSuggestion(c.name || '')} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #f5f5f5' }}
                    dangerouslySetInnerHTML={{ __html: c.highlight || c.name || '' }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {results?.suggestions && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', background: '#e3f2fd', borderRadius: '6px', fontSize: '14px' }}>
          Did you mean: <button onClick={() => { setQ(results.suggestions!.suggestion); setPage(1); }} style={{ background: 'none', border: 'none', color: '#1565c0', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline', fontSize: '14px' }}>
            {results.suggestions.suggestion}
          </button>?
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Filters */}
        <div style={{ width: '220px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Filters</h3>
          <div style={{ marginBottom: '14px' }}>
            <label style={lbl}>Category</label>
            <select value={categorySlug} onChange={e => { setCategorySlug(e.target.value); setPage(1); }} style={sel}>
              <option value="">All</option>
              {(results?.facets.categories || []).map(f => <option key={f.key} value={f.key}>{f.key} ({f.count})</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={lbl}>Post Type</label>
            <select value={postType} onChange={e => { setPostType(e.target.value); setPage(1); }} style={sel}>
              <option value="">All</option>
              {(results?.facets.post_types || []).map(f => <option key={f.key} value={f.key}>{f.key} ({f.count})</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={lbl}>Author</label>
            <input value={author} onChange={e => { setAuthor(e.target.value); setPage(1); }} placeholder="username..." style={inp} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={lbl}>Sort</label>
            <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={sel}>
              <option value="_score">Relevance</option><option value="newest">Newest</option><option value="most_comments">Most Comments</option><option value="most_fire">Most Fire</option>
            </select>
          </div>
          <button onClick={() => { setCategorySlug(''); setPostType(''); setAuthor(''); setSort('_score'); setPage(1); }} style={{ width: '100%', padding: '6px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#666' }}>Clear All</button>
        </div>

        {/* Results */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {results && (
            <div style={{ marginBottom: '14px', fontSize: '13px', color: '#666' }}>
              Found <strong>{results.total.posts + results.total.comments}</strong> results ({results.total.posts} posts, {results.total.comments} comments)
            </div>
          )}
          {results && (
            <div style={{ display: 'flex', gap: '0', marginBottom: '14px', borderBottom: '1px solid #ddd' }}>
              <button onClick={() => setActiveTab('all')} style={ts(activeTab === 'all')}>All</button>
              <button onClick={() => setActiveTab('posts')} style={ts(activeTab === 'posts')}>Posts ({results.total.posts})</button>
              <button onClick={() => setActiveTab('comments')} style={ts(activeTab === 'comments')}>Comments ({results.total.comments})</button>
            </div>
          )}
          {error && <p style={{ color: '#c62828' }}>{error}</p>}
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Searching...</div>}
          {!loading && results && activeResults.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}><Icon name="Search" size={40} color="#999" /></div>
              <h2>No results found</h2><p>Try different keywords or remove filters.</p>
            </div>
          )}
          {!loading && activeResults.map(r => (
            <div key={`${r._type}-${r.id}`} style={{ padding: '14px 0', borderBottom: '1px solid #eee' }}>
              {r._type === 'post' ? (
                <Link href={`/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#1565c0' }} dangerouslySetInnerHTML={{ __html: r.highlight?.title?.[0] || r.title }} />
                  <div style={{ fontSize: '13px', color: '#555', marginBottom: '6px', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: r.highlight?.intro?.[0] || (r.intro || '').substring(0, 200) }} />
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#999', flexWrap: 'wrap' }}>
                    <span>By {r.author_username}</span>
                    {r.category_slug && <span><Icon name="Folder" size={12} /> {r.category_slug}</span>}
                    {r.post_type && <span><Icon name="Tag" size={12} /> {r.post_type}</span>}
                    <span><Icon name="MessageCircle" size={12} /> {r.comment_count || 0}</span><span><Icon name="Flame" size={12} /> {r.fire_count || 0}</span>
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ) : (
                <Link href={`/${r.post_slug || ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '2px' }}><Icon name="MessageCircle" size={12} /> Comment on <strong>{r.post_title || 'a post'}</strong></div>
                  <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: r.highlight?.content?.[0] || (r.content || '').substring(0, 200) }} />
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>By {r.author_username} · {new Date(r.created_at).toLocaleDateString()}</div>
                </Link>
              )}
            </div>
          ))}
          {results && results.pagination.pages > 1 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '24px' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pb(page <= 1)}>← Prev</button>
              {Array.from({ length: Math.min(results.pagination.pages, 7) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 3, results.pagination.pages - 6));
                const pn = start + i; if (pn > results.pagination.pages) return null;
                return <button key={pn} onClick={() => setPage(pn)} style={{ padding: '6px 12px', border: pn === page ? '2px solid #1565c0' : '1px solid #ddd', borderRadius: '4px', background: pn === page ? '#e3f2fd' : '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: pn === page ? 'bold' : 'normal' }}>{pn}</button>;
              })}
              <button disabled={page >= results.pagination.pages} onClick={() => setPage(p => p + 1)} style={pb(page >= results.pagination.pages)}>Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ts = (a: boolean): React.CSSProperties => ({ padding: '8px 16px', border: 'none', borderBottom: a ? '2px solid #1565c0' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: a ? 'bold' : 'normal', color: a ? '#1565c0' : '#666' });
const pb = (d: boolean): React.CSSProperties => ({ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: d ? '#f5f5f5' : '#fff', cursor: d ? 'not-allowed' : 'pointer', fontSize: '13px', color: d ? '#ccc' : '#333' });
const lbl: React.CSSProperties = { fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' };
const sel: React.CSSProperties = { width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' };
const inp: React.CSSProperties = { width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' };
