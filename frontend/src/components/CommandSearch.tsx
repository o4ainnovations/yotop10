'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icons/Icon';

const FALLBACK_TRENDING = [
  'best movies 2024',
  'top albums',
  'favorite games',
  'best restaurants',
  'coding languages',
  'workout routines',
];

interface CommandSearchProps {
  open: boolean;
  onClose: () => void;
}

export function CommandSearch({ open, onClose }: CommandSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [trending, setTrending] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue('');
    inputRef.current?.focus();

    const baseUrl = typeof window === 'undefined'
      ? ''
      : window.location.origin;
    fetch(`${baseUrl}/api/search/trending`)
      .then((r) => r.json())
      .then((d) => setTrending((d.trending || []).map((t: { query: string }) => t.query).slice(0, 8)))
      .catch(() => setTrending(FALLBACK_TRENDING));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const doSearch = (q: string) => {
    if (!q.trim()) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      doSearch(value);
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <Icon
            name="Search"
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Fact mine. Debate ground. Search rankings..."
            className="w-full rounded-t-2xl bg-transparent py-4 pl-12 pr-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
            autoComplete="off"
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition"
            aria-label="Close search"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {trending.length > 0 && (
          <div className="border-t border-white/5 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Trending
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {trending.map((q, i) => (
                <button
                  key={q}
                  onClick={() => doSearch(q)}
                  className="text-[11px] font-mono text-zinc-500 hover:text-orange-400 transition"
                >
                  {(i + 1).toString().padStart(2, '0')}{' '}
                  #{q.toUpperCase().replace(/\s/g, '_')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
