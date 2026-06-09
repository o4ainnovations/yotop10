'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { formatDate } from '@/lib/dates';
import { SafeHTML } from '@/components/SafeHTML';
import { API } from '@/lib/api';
interface SearchResult {
  id: string; title: string; intro?: string; content?: string;
  slug: string; category_slug?: string; category_name?: string; post_type?: string;
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

export default function SearchClient() {
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ titles: AutocompleteItem[]; categories: AutocompleteItem[] }>({ titles: [], categories: [] });
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 2) { setShowSuggestions(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const data = await API.autocomplete(q) as { titles: Array<{ slug: string; title?: string; highlight?: string }>; categories: Array<{ slug: string; name?: string; highlight?: string }> };
        setSuggestions({ titles: data.titles || [], categories: data.categories || [] });
        setShowSuggestions(true);
      } catch {}
    }, 100);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  const search = useCallback(async (searchPage: number) => {
    if (!q.trim() || q.trim().length < 2) { setResults(null); return; }
    setLoading(true); setError('');

    try {
      const params: Record<string, string> = { q: q.trim(), page: String(searchPage), sort };
      if (categorySlug) params.category_slug = categorySlug;
      if (postType) params.post_type = postType;
      if (author) params.author = author;
      const data = await API.search(params) as SearchResponse;
      setResults(data);
      if (typeof window !== 'undefined') {
        const url = `/search?${new URLSearchParams(params)}`;
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node) && !(e.target as Element).closest('[data-filters-toggle]')) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSuggestionItems = [
    ...(suggestions.titles || []).map(t => ({ ...t, _type: 'title' as const, label: t.title })),
    ...(suggestions.categories || []).map(c => ({ ...c, _type: 'category' as const, label: c.name })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setShowSuggestions(false); return; }
    if (e.key === 'ArrowDown' && showSuggestions && allSuggestionItems.length > 0) {
      e.preventDefault();
      setActiveSuggestionIndex(prev => Math.min(prev + 1, allSuggestionItems.length - 1));
      return;
    }
    if (e.key === 'ArrowUp' && showSuggestions && allSuggestionItems.length > 0) {
      e.preventDefault();
      setActiveSuggestionIndex(prev => Math.max(prev - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      if (showSuggestions && activeSuggestionIndex >= 0 && allSuggestionItems[activeSuggestionIndex]) {
        const selected = allSuggestionItems[activeSuggestionIndex].label || '';
        setQ(selected);
        setShowSuggestions(false);
        setPage(1);
        setActiveSuggestionIndex(-1);
      } else {
        setShowSuggestions(false);
        search(page);
      }
    }
  };

  const selectSuggestion = (text: string) => { setQ(text); setShowSuggestions(false); setPage(1); setActiveSuggestionIndex(-1); };

  const allResults = [...(results?.posts || []).map(p => ({ ...p, _type: 'post' as const })), ...(results?.comments || []).map(c => ({ ...c, _type: 'comment' as const }))].sort((a, b) => b._score - a._score);
  const activeResults = activeTab === 'all' ? allResults : activeTab === 'posts' ? (results?.posts || []) : (results?.comments || []);

  const selectClasses = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm2 text-white outline-none transition focus:border-orange-500/50";

  return (
    <div className="min-h-screen bg-zinc-950 px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="relative mb-4 sm:mb-6">
          <div className="flex gap-2 sm:gap-3">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-4">
                <Icon name="Search" size={18} className="text-zinc-600" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => q.length >= 2 && suggestions.titles.length > 0 && setShowSuggestions(true)}
                placeholder="Search posts and comments in real-time..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none backdrop-blur-sm transition focus:border-orange-500/50 sm:py-3.5 sm:pl-11 sm:text-base"
                autoFocus
                autoComplete="off"
              />
              {loading && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-4">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-400" />
                </span>
              )}
            </div>
            <button
              onClick={() => { setShowSuggestions(false); search(page); }}
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 disabled:opacity-50 sm:px-6"
            >
              Search
            </button>
          </div>

          {showSuggestions && (suggestions.titles.length > 0 || suggestions.categories.length > 0) && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-auto rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
            >
              <div role="listbox" aria-label="Search suggestions">
                {suggestions.titles.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-3xs font-semibold uppercase tracking-wider text-zinc-600 sm:px-4">
                      Posts
                    </div>
                    {suggestions.titles.map((t, i) => (
                      <div
                        key={t.slug}
                        role="option"
                        aria-selected={i === activeSuggestionIndex}
                        tabIndex={-1}
                        onClick={() => selectSuggestion(t.title || '')}
                        onMouseEnter={() => setActiveSuggestionIndex(i)}
                        className={`cursor-pointer border-t border-white/5 px-3 py-2.5 text-sm transition sm:px-4 ${
                          i === activeSuggestionIndex ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5'
                        }`}
                      >
                        <SafeHTML html={t.highlight || t.title || ''} variant="highlight" />
                      </div>
                    ))}
                  </div>
                )}
                {suggestions.categories.length > 0 && (
                  <div>
                    <div className="border-t border-white/10 px-3 py-2 text-3xs font-semibold uppercase tracking-wider text-zinc-600 sm:px-4">
                      Categories
                    </div>
                    {suggestions.categories.map((c, i) => {
                      const idx = (suggestions.titles?.length || 0) + i;
                      return (
                        <div
                          key={c.slug}
                          role="option"
                          aria-selected={idx === activeSuggestionIndex}
                          tabIndex={-1}
                          onClick={() => selectSuggestion(c.name || '')}
                          onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          className={`cursor-pointer border-t border-white/5 px-3 py-2.5 text-sm transition sm:px-4 ${
                            idx === activeSuggestionIndex ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5'
                          }`}
                        >
                          <SafeHTML html={c.highlight || c.name || ''} variant="highlight" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {results?.suggestions && (
          <div className="mb-4 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-2.5 text-sm text-zinc-400 sm:mb-6">
            Did you mean:{' '}
            <button
              onClick={() => { setQ(results.suggestions!.suggestion); setPage(1); }}
              className="font-bold text-orange-400 underline transition hover:text-orange-300"
            >
              {results.suggestions.suggestion}
            </button>
            ?
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Mobile filters toggle */}
          <div className="lg:hidden">
            <button
              data-filters-toggle
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-300 backdrop-blur-sm transition hover:border-white/20"
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="SlidersHorizontal" size={14} />
                Filters
              </span>
              <Icon name={filtersOpen ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-zinc-500" />
            </button>

            {filtersOpen && (
              <div ref={filtersRef} className="mt-2 rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-3xs font-semibold uppercase tracking-wider text-zinc-600">Category</label>
                    <select value={categorySlug} onChange={e => { setCategorySlug(e.target.value); setPage(1); }} className={selectClasses}>
                      <option value="">All</option>
                      {(results?.facets.categories || []).map(f => <option key={f.key} value={f.key}>{f.key} ({f.count})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-3xs font-semibold uppercase tracking-wider text-zinc-600">Post Type</label>
                    <select value={postType} onChange={e => { setPostType(e.target.value); setPage(1); }} className={selectClasses}>
                      <option value="">All</option>
                      {(results?.facets.post_types || []).map(f => <option key={f.key} value={f.key}>{f.key} ({f.count})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-3xs font-semibold uppercase tracking-wider text-zinc-600">Author</label>
                    <input value={author} onChange={e => { setAuthor(e.target.value); setPage(1); }} placeholder="username..." className={selectClasses} />
                  </div>
                  <div>
                    <label className="mb-1 block text-3xs font-semibold uppercase tracking-wider text-zinc-600">Sort</label>
                    <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className={selectClasses}>
                      <option value="_score">Relevance</option>
                      <option value="newest">Newest</option>
                      <option value="most_comments">Most Comments</option>
                      <option value="most_fire">Most Fire</option>
                    </select>
                  </div>
                  <button
                    onClick={() => { setCategorySlug(''); setPostType(''); setAuthor(''); setSort('_score'); setPage(1); }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop filters sidebar */}
          <div className="hidden w-52 shrink-0 lg:block">
            <h3 className="mb-3 text-sm font-semibold text-white">Filters</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-3xs font-semibold uppercase tracking-wider text-zinc-600">Category</label>
                <select value={categorySlug} onChange={e => { setCategorySlug(e.target.value); setPage(1); }} className={selectClasses}>
                  <option value="">All</option>
                  {(results?.facets.categories || []).map(f => <option key={f.key} value={f.key}>{f.key} ({f.count})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-3xs font-semibold uppercase tracking-wider text-zinc-600">Post Type</label>
                <select value={postType} onChange={e => { setPostType(e.target.value); setPage(1); }} className={selectClasses}>
                  <option value="">All</option>
                  {(results?.facets.post_types || []).map(f => <option key={f.key} value={f.key}>{f.key} ({f.count})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-3xs font-semibold uppercase tracking-wider text-zinc-600">Author</label>
                <input value={author} onChange={e => { setAuthor(e.target.value); setPage(1); }} placeholder="username..." className={selectClasses} />
              </div>
              <div>
                <label className="mb-1 block text-3xs font-semibold uppercase tracking-wider text-zinc-600">Sort</label>
                <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className={selectClasses}>
                  <option value="_score">Relevance</option>
                  <option value="newest">Newest</option>
                  <option value="most_comments">Most Comments</option>
                  <option value="most_fire">Most Fire</option>
                </select>
              </div>
              <button
                onClick={() => { setCategorySlug(''); setPostType(''); setAuthor(''); setSort('_score'); setPage(1); }}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="min-w-0 flex-1">
            {results && (
              <div className="mb-3 text-sm2 text-zinc-500">
                Found{' '}
                <strong className="text-white">{results.total.posts + results.total.comments}</strong>{' '}
                results ({results.total.posts} posts, {results.total.comments} comments)
              </div>
            )}

            {results && (
              <div className="mb-4 flex border-b border-white/5">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-2 text-sm2 font-semibold transition sm:px-4 ${
                    activeTab === 'all'
                      ? 'border-b-2 border-orange-500 text-orange-400'
                      : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab('posts')}
                  className={`px-3 py-2 text-sm2 font-semibold transition sm:px-4 ${
                    activeTab === 'posts'
                      ? 'border-b-2 border-orange-500 text-orange-400'
                      : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Posts ({results.total.posts})
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`px-3 py-2 text-sm2 font-semibold transition sm:px-4 ${
                    activeTab === 'comments'
                      ? 'border-b-2 border-orange-500 text-orange-400'
                      : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Comments ({results.total.comments})
                </button>
              </div>
            )}

            {error && <p className="py-8 text-center text-sm text-red-400">{error}</p>}

            {!loading && results && activeResults.length === 0 && (
              <div className="py-16 text-center">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 sm:h-16 sm:w-16">
                  <Icon name="Search" size={28} className="text-zinc-600 sm:size-8" />
                </div>
                <h2 className="mb-1 text-base font-semibold text-zinc-300">No results found</h2>
                <p className="text-sm text-zinc-500">Try different keywords or remove filters.</p>
              </div>
            )}

            {!loading && activeResults.map(r => (
              <div key={`${r._type}-${r.id}`} className="border-b border-white/5 py-3.5 sm:py-4">
                {r._type === 'post' ? (
                  <Link href={`/${r.slug}`} className="block group">
                    <h3 className="mb-1 text-base font-semibold text-orange-400 transition group-hover:text-orange-300">
                      <SafeHTML html={r.highlight?.title?.[0] || r.title} variant="highlight" />
                    </h3>
                    <div className="mb-2 text-sm2 leading-relaxed text-zinc-400 line-clamp-2">
                      <SafeHTML html={r.highlight?.intro?.[0] || (r.intro || '').substring(0, 200)} variant="highlight" />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                      <span>By {r.author_username}</span>
                      {r.category_slug && (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="Folder" size={12} />
                          {r.category_name || r.category_slug}
                        </span>
                      )}
                      {r.post_type && (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="Tag" size={12} />
                          {r.post_type}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Icon name="MessageCircle" size={12} />
                        {r.comment_count || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="Flame" size={12} />
                        {r.fire_count || 0}
                      </span>
                      <span suppressHydrationWarning>{formatDate(r.created_at)}</span>
                    </div>
                  </Link>
                ) : (
                  <Link href={`/${r.post_slug || ''}`} className="block group">
                    <div className="mb-0.5 text-xs text-zinc-600">
                      <Icon name="MessageCircle" size={12} className="inline mr-1" />
                      Comment on <strong className="text-zinc-500">{r.post_title || 'a post'}</strong>
                    </div>
                    <div className="mb-1.5 text-sm leading-relaxed text-zinc-400 line-clamp-2">
                      <SafeHTML html={r.highlight?.content?.[0] || (r.content || '').substring(0, 200)} variant="highlight" />
                    </div>
                    <div className="text-xs text-zinc-600">
                      By {r.author_username} &middot; <span suppressHydrationWarning>{formatDate(r.created_at)}</span>
                    </div>
                  </Link>
                )}
              </div>
            ))}

            {results && results.pagination.pages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-8 sm:gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm2 text-zinc-400 transition hover:border-white/20 disabled:opacity-30"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(results.pagination.pages, 7) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 3, results.pagination.pages - 6));
                  const pn = start + i;
                  if (pn > results.pagination.pages) return null;
                  return (
                    <button
                      key={pn}
                      onClick={() => setPage(pn)}
                      className={`rounded-lg px-3 py-2 text-sm2 font-medium transition ${
                        pn === page
                          ? 'border border-orange-500/30 bg-orange-500/10 text-orange-400'
                          : 'border border-white/5 bg-white/5 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {pn}
                    </button>
                  );
                })}
                <button
                  disabled={page >= results.pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm2 text-zinc-400 transition hover:border-white/20 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
