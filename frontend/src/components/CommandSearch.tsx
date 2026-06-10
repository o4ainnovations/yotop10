'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icons/Icon';
import { API } from '@/lib/api';

const RECENT_KEY = 'yotop10_recent_searches';
const MAX_RECENT = 5;

interface AutoTitle {
  title: string;
  slug: string;
  highlight?: string;
}

interface AutoCategory {
  name: string;
  slug: string;
  highlight?: string;
}

export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [results, setResults] = useState<{ titles: AutoTitle[]; categories: AutoCategory[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [trending, setTrending] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Load recent on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecent(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Fetch trending on open
  useEffect(() => {
    if (!open) return;
    setValue('');
    setResults(null);
    setActiveIdx(-1);
    inputRef.current?.focus();
    fetch('/api/search/trending')
      .then(r => r.json())
      .then(d => setTrending((d.trending || []).map((t: { query: string }) => t.query).slice(0, 8)))
      .catch(() => {});
  }, [open]);

  // Debounced autocomplete
  useEffect(() => {
    if (!open || value.trim().length < 2) {
      setResults(null);
      setActiveIdx(-1);
      return;
    }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await API.autocomplete(value.trim()) as { titles: AutoTitle[]; categories: AutoCategory[] };
        setResults(data);
        setActiveIdx(data.titles.length > 0 ? 0 : data.categories.length > 0 ? 0 : -1);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(debounceRef.current); };
  }, [value, open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current || activeIdx < 0) return;
    const items = listRef.current.querySelectorAll('[data-result-idx]');
    const el = items[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const saveRecent = useCallback((q: string) => {
    const next = [q, ...recent.filter(r => r !== q)].slice(0, MAX_RECENT);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, [recent]);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    saveRecent(q.trim());
    onClose();
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }, [onClose, router, saveRecent]);

  const removeRecent = (q: string) => {
    const next = recent.filter(r => r !== q);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const flatItems: Array<{ type: 'title'; data: AutoTitle } | { type: 'category'; data: AutoCategory }> = [];
  if (results) {
    for (const t of results.titles) flatItems.push({ type: 'title', data: t });
    for (const c of results.categories) flatItems.push({ type: 'category', data: c });
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < flatItems.length) {
        const item = flatItems[activeIdx];
        if (item.type === 'title') {
          saveRecent(item.data.title);
          onClose();
          router.push(`/${item.data.slug}`);
        } else {
          doSearch(value);
        }
      } else if (value.trim()) {
        doSearch(value);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(prev => Math.min(prev + 1, flatItems.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(prev => Math.max(prev - 1, -1));
      return;
    }
  };

  if (!open) return null;

  const hasSuggestions = results && flatItems.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[var(--color-bg)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="relative flex items-center px-4 border-b border-white/5">
          <Icon name="Search" size={18} className="shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search rankings, facts..."
            role="combobox"
            aria-expanded={hasSuggestions || false}
            aria-controls="search-suggestions"
            aria-activedescendant={activeIdx >= 0 ? `search-item-${activeIdx}` : undefined}
            className="w-full bg-transparent py-4 pl-3 pr-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
            autoComplete="off"
          />
          {loading && (
            <Icon name="RefreshCw" size={14} className="shrink-0 text-zinc-600 animate-spin" />
          )}
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 ml-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition"
            aria-label="Close search"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Suggestions list */}
        {hasSuggestions && (
          <div id="search-suggestions" ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-2">
            {results.titles.length > 0 && (
              <div>
                <p className="px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-zinc-600">Posts</p>
                {results.titles.map((t, i) => (
                  <button
                    key={t.slug}
                    id={`search-item-${i}`}
                    data-result-idx={i}
                    role="option"
                    aria-selected={activeIdx === i}
                    onClick={() => { saveRecent(t.title); onClose(); router.push(`/${t.slug}`); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition ${
                      activeIdx === i ? 'bg-white/5 text-white' : 'text-zinc-400'
                    }`}
                  >
                    <Icon name="FileText" size={14} className="shrink-0 text-zinc-600" />
                    <span
                      className="truncate"
                      dangerouslySetInnerHTML={{ __html: t.highlight || t.title }}
                    />
                  </button>
                ))}
              </div>
            )}
            {results.categories.length > 0 && (
              <div>
                <p className="px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-zinc-600 mt-1">Categories</p>
                {results.categories.map((c, i) => {
                  const idx = results.titles.length + i;
                  return (
                    <button
                      key={c.slug}
                      id={`search-item-${idx}`}
                      data-result-idx={idx}
                      role="option"
                      aria-selected={activeIdx === idx}
                      onClick={() => doSearch(c.name)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition ${
                        activeIdx === idx ? 'bg-white/5 text-white' : 'text-zinc-400'
                      }`}
                    >
                      <Icon name="Folder" size={14} className="shrink-0 text-zinc-600" />
                      <span
                        className="truncate"
                        dangerouslySetInnerHTML={{ __html: c.highlight || c.name }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recent searches */}
        {!value && recent.length > 0 && (
          <div className="px-4 py-3 border-t border-white/5">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-zinc-600">Recent</p>
            <div className="flex flex-wrap gap-2">
              {recent.map(q => (
                <span key={q} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-2xs text-zinc-400">
                  <button onClick={() => doSearch(q)} className="hover:text-white transition">{q}</button>
                  <button onClick={() => removeRecent(q)} className="text-zinc-700 hover:text-zinc-500 transition" aria-label={`Remove ${q}`}>
                    <Icon name="X" size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trending */}
        {!value && trending.length > 0 && (
          <div className="border-t border-white/5 px-4 py-3">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-zinc-600">Trending</p>
            <div className="flex flex-wrap gap-2">
              {trending.map(q => (
                <button
                  key={q}
                  onClick={() => doSearch(q)}
                  className="rounded-full border border-white/5 bg-white/[0.02] px-3 py-1 text-2xs text-zinc-500 hover:text-orange-400 hover:border-orange-500/20 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {value.trim().length >= 2 && !loading && hasSuggestions === false && (
          <div className="px-4 py-6 text-center text-2xs text-zinc-600">
            No results for &ldquo;{value}&rdquo;. Press Enter to search full site.
          </div>
        )}
      </div>
    </div>
  );
}
