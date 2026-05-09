'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

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

export default function SearchPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get('q') || '');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'comments'>('all');
  const [sort, setSort] = useState(sp.get('sort') || '_score');
  const [page, setPage] = useState(parseInt(sp.get('page') || '1'));
  const [categorySlug, setCategorySlug] = useState(sp.get('category_slug') || '');
  const [postType, setPostType] = useState(sp.get('post_type') || '');
  const [author, setAuthor] = useState(sp.get('author') || '');

  const search = useCallback(async (searchPage: number) => {
    if (!q.trim() || q.trim().length < 2) return;
    setLoading(true); setError('');

    const params = new URLSearchParams({ q: q.trim(), page: String(searchPage), sort });
    if (categorySlug) params.set('category_slug', categorySlug);
    if (postType) params.set('post_type', postType);
    if (author) params.set('author', author);

    try {
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error('Search failed');
      setResults(await res.json());
    } catch { setError('Search failed. Please try again.'); }
    setLoading(false);
  }, [q, sort, categorySlug, postType, author]);

  useEffect(() => {
    if (q.trim().length >= 2) { search(page); }
  }, [page, search]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); search(1); };

  const allResults = [
    ...(results?.posts || []).map(p => ({ ...p, _type: 'post' as const })),
    ...(results?.comments || []).map(c => ({ ...c, _type: 'comment' as const })),
  ].sort((a, b) => b._score - a._score);

  const activeResults = activeTab === 'all' ? allResults
    : activeTab === 'posts' ? (results?.posts || [])
    : (results?.comments || []);

  const activeTotal = activeTab === 'all'
    ? (results?.total.posts || 0) + (results?.total.comments || 0)
    : activeTab === 'posts' ? (results?.total.posts || 0)
    : (results?.total.comments || 0);

  const handleSuggestion = () => {
    if (results?.suggestions) { setQ(results.suggestions.suggestion); setPage(1); }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search posts and comments..."
            style={{ flex: 1, padding: '12px 16px', fontSize: '16px', border: '2px solid #ddd', borderRadius: '8px', outline: 'none' }}
            autoFocus
          />
          <button type="submit" disabled={loading}
            style={{ padding: '12px 28px', fontSize: '16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            {loading ? '...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Suggestions */}
      {results?.suggestions && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', background: '#e3f2fd', borderRadius: '6px', fontSize: '14px' }}>
          Did you mean: <button onClick={handleSuggestion} style={{ background: 'none', border: 'none', color: '#1565c0', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline', fontSize: '14px' }}>
            {results.suggestions.suggestion}
          </button>?
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Filters sidebar */}
        <div style={{ width: '220px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Filters</h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Category</label>
            <select value={categorySlug} onChange={e => { setCategorySlug(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
              <option value="">All</option>
              {(results?.facets.categories || []).map(f => <option key={f.key} value={f.key}>{f.key} ({f.count})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Post Type</label>
            <select value={postType} onChange={e => { setPostType(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
              <option value="">All</option>
              {(results?.facets.post_types || []).map(f => <option key={f.key} value={f.key}>{f.key} ({f.count})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Author</label>
            <input value={author} onChange={e => { setAuthor(e.target.value); setPage(1); }}
              placeholder="username..." style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Sort</label>
            <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
              <option value="_score">Relevance</option>
              <option value="newest">Newest</option>
              <option value="most_comments">Most Comments</option>
              <option value="most_fire">Most Fire</option>
            </select>
          </div>

          <button onClick={() => { setCategorySlug(''); setPostType(''); setAuthor(''); setSort('_score'); setPage(1); }}
            style={{ width: '100%', padding: '6px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#666' }}>
            Clear All Filters
          </button>
        </div>

        {/* Results */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {results && (
            <div style={{ marginBottom: '16px', fontSize: '13px', color: '#666' }}>
              Found <strong>{results.total.posts + results.total.comments}</strong> results
              ({results.total.posts} posts, {results.total.comments} comments)
            </div>
          )}

          {results && (
            <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid #ddd' }}>
              <button onClick={() => setActiveTab('all')} style={tabStyle(activeTab === 'all')}>All</button>
              <button onClick={() => setActiveTab('posts')} style={tabStyle(activeTab === 'posts')}>Posts ({results.total.posts})</button>
              <button onClick={() => setActiveTab('comments')} style={tabStyle(activeTab === 'comments')}>Comments ({results.total.comments})</button>
            </div>
          )}

          {error && <p style={{ color: '#c62828' }}>{error}</p>}

          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Searching...</div>}

          {!loading && results && activeResults.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
              <h2>No results found</h2>
              <p>Try different keywords or remove filters.</p>
            </div>
          )}

          {!loading && activeResults.map(r => (
            <div key={`${r._type}-${r.id}`} style={{ padding: '14px 0', borderBottom: '1px solid #eee' }}>
              {r._type === 'post' ? (
                <Link href={`/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#1565c0' }}
                    dangerouslySetInnerHTML={{ __html: r.highlight?.title?.[0] || r.title }} />
                  <div style={{ fontSize: '13px', color: '#555', marginBottom: '6px', lineHeight: '1.5' }}
                    dangerouslySetInnerHTML={{ __html: r.highlight?.intro?.[0] || (r.intro || '').substring(0, 200) }} />
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#999' }}>
                    <span>By {r.author_username}</span>
                    {r.category_slug && <span>📁 {r.category_slug}</span>}
                    {r.post_type && <span>🏷 {r.post_type}</span>}
                    <span>💬 {r.comment_count || 0}</span>
                    <span>🔥 {r.fire_count || 0}</span>
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ) : (
                <Link href={`/${r.post_slug || ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '2px' }}>
                    💬 Comment on <strong>{r.post_title || 'a post'}</strong>
                  </div>
                  <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.5' }}
                    dangerouslySetInnerHTML={{ __html: r.highlight?.content?.[0] || (r.content || '').substring(0, 200) }} />
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    By {r.author_username} · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </Link>
              )}
            </div>
          ))}

          {/* Pagination */}
          {results && results.pagination.pages > 1 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '24px' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                style={pageBtn(page <= 1)}>← Prev</button>
              {Array.from({ length: Math.min(results.pagination.pages, 7) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 3, results.pagination.pages - 6));
                const pn = start + i;
                if (pn > results.pagination.pages) return null;
                return <button key={pn} onClick={() => setPage(pn)}
                  style={{ padding: '6px 12px', border: pn === page ? '2px solid #1565c0' : '1px solid #ddd', borderRadius: '4px', background: pn === page ? '#e3f2fd' : '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: pn === page ? 'bold' : 'normal' }}>
                  {pn}</button>;
              })}
              <button disabled={page >= results.pagination.pages} onClick={() => setPage(p => p + 1)}
                style={pageBtn(page >= results.pagination.pages)}>Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px', border: 'none', borderBottom: active ? '2px solid #1565c0' : '2px solid transparent',
  background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 'bold' : 'normal',
  color: active ? '#1565c0' : '#666',
});

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px',
  background: disabled ? '#f5f5f5' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '13px', color: disabled ? '#ccc' : '#333',
});
