'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';

const DEBATE_DRAFT_KEY = 'yotop10_debate_draft';

export default function DebateClient() {
  const [title, setTitle] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const [sideA, setSideA] = useState('');
  const [sideAJustification, setSideAJustification] = useState('');
  const [sideASource, setSideASource] = useState('');
  const [sideB, setSideB] = useState('');
  const [sideBJustification, setSideBJustification] = useState('');
  const [sideBSource, setSideBSource] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEBATE_DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (Date.now() - d.savedAt < 3600000) {
          if (d.title) setTitle(d.title);
          if (d.categorySlug) setCategorySlug(d.categorySlug);
          if (d.catSearch) setCatSearch(d.catSearch);
          if (d.sideA) setSideA(d.sideA);
          if (d.sideAJustification) setSideAJustification(d.sideAJustification);
          if (d.sideASource) setSideASource(d.sideASource);
          if (d.sideB) setSideB(d.sideB);
          if (d.sideBJustification) setSideBJustification(d.sideBJustification);
          if (d.sideBSource) setSideBSource(d.sideBSource);
          if (d.authorName) setAuthorName(d.authorName);
        } else {
          localStorage.removeItem(DEBATE_DRAFT_KEY);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Save draft on change
  useEffect(() => {
    const timeout = setTimeout(() => {
      const data = { title, categorySlug, catSearch, sideA, sideAJustification, sideASource, sideB, sideBJustification, sideBSource, authorName, savedAt: Date.now() };
      localStorage.setItem(DEBATE_DRAFT_KEY, JSON.stringify(data));
    }, 800);
    return () => clearTimeout(timeout);
  }, [title, categorySlug, catSearch, sideA, sideAJustification, sideASource, sideB, sideBJustification, sideBSource, authorName]);
  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(catSearch.toLowerCase()) || c.slug.toLowerCase().includes(catSearch.toLowerCase())
  );

  useEffect(() => {
    API.getCategories()
      .then(data => {
        const flat = (data as { categories?: Array<{ id: string; name: string; slug: string; children?: Array<{ id: string; name: string; slug: string }> }> }).categories || [];
        const all: Array<{ id: string; name: string; slug: string }> = [];
        for (const p of flat) {
          all.push({ id: p.id, name: p.name, slug: p.slug });
          if (p.children) for (const c of p.children) all.push({ id: c.id, name: `  ${c.name}`, slug: c.slug });
        }
        setCategories(all);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!catOpen) return;
    const handle = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [catOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categorySlug || !title || !sideA || !sideB) {
      setError('Title, category, and both sides are required.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const response = await API.addPost({
        title,
        post_type: 'this_vs_that',
        intro: `${sideA} vs ${sideB}`,
        category_slug: categorySlug,
        items: [
          { rank: 1, title: sideA, justification: sideAJustification, source_url: sideASource || undefined },
          { rank: 2, title: sideB, justification: sideBJustification, source_url: sideBSource || undefined },
        ],
        author_display_name: authorName || undefined,
      }) as { post?: { id: string; title: string; status: string; slug?: string } };

      localStorage.removeItem(DEBATE_DRAFT_KEY);
      const slug = response.post?.slug || '';

      setSubmitting(false);
      toast.success('Debate submitted! It\'s now pending review.');
      window.location.href = `/${slug}`;
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : '';
      const s = parseInt(msg.match(/API Error: (\d+)/)?.[1] || '0', 10);
      let body: Record<string, unknown> | null = null;
      try { const j = msg.lastIndexOf('{'); if (j !== -1) body = JSON.parse(msg.slice(j)); } catch { /* not json */ }
      if (s === 400 && body?.format_code) setError((body.error as string) || 'Invalid format.');
      else if (s === 400 && body?.error) setError(body.error as string);
      else if (s === 409) setError((body?.error as string) || 'This already exists.');
      else if (s === 429) setError((body?.error as string) || 'Rate limit exceeded.');
      else if (body?.error) setError(body.error as string);
      else setError(msg || 'Failed to submit debate.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10 min-h-[calc(100vh-56px)]">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="Swords" size={20} className="text-purple-400" />
          <h1 className="text-xl font-bold text-white sm:text-2xl">Create a Debate</h1>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">Set up two sides for the community to debate and vote on. Exactly two options — no more, no less.</p>
        <nav className="mt-3 flex items-center gap-3 text-xs">
          <Link href="/new" className="text-purple-400 hover:text-purple-300 transition">&larr; Change type</Link>
          <span className="text-zinc-700">|</span>
          <Link href="/" className="text-zinc-500 hover:text-purple-400 transition">Home</Link>
        </nav>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="debate-title" className="mb-1 block text-xs font-medium text-zinc-400">Debate Title <span className="text-purple-400">*</span></label>
          <input id="debate-title" type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Ronaldo vs Messi — Who Is The Better Footballer?"
            maxLength={300} className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-purple-500/50"
          />
        </div>

        {/* Category */}
        <div ref={catRef} className="relative">
          <label htmlFor="debate-cat" className="mb-1 block text-xs font-medium text-zinc-400">Category <span className="text-purple-400">*</span></label>
          <input id="debate-cat" type="text" value={catSearch} onChange={e => { setCatSearch(e.target.value); setCatOpen(true); setCategorySlug(''); }}
            onFocus={() => setCatOpen(true)} placeholder="Search categories..."
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-purple-500/50"
          />
          {catOpen && filteredCategories.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
              {filteredCategories.map(c => (
                <button key={c.slug} type="button" onClick={() => { setCategorySlug(c.slug); setCatSearch(c.name); setCatOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm transition ${c.slug === categorySlug ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-300 hover:bg-white/5'}`}
                >{c.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* Side A */}
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.02] p-4">
          <h2 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">Side A</h2>
          <div className="space-y-3">
            <input type="text" value={sideA} onChange={e => setSideA(e.target.value)}
              placeholder="Option name (e.g. Ronaldo)" maxLength={200}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
            />
            <textarea value={sideAJustification} onChange={e => setSideAJustification(e.target.value)}
              placeholder="Why this side wins? (optional)" maxLength={2000} rows={2}
              className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
            />
            <input type="url" value={sideASource} onChange={e => setSideASource(e.target.value)}
              placeholder="Source URL (optional)" aria-label="Source URL for side A"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-400 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50"
            />
          </div>
        </div>

        {/* VS divider */}
        <div className="flex items-center justify-center -my-1">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-xs shadow-lg">VS</span>
        </div>

        {/* Side B */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.02] p-4">
          <h2 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Side B</h2>
          <div className="space-y-3">
            <input type="text" value={sideB} onChange={e => setSideB(e.target.value)}
              placeholder="Option name (e.g. Messi)" maxLength={200}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
            />
            <textarea value={sideBJustification} onChange={e => setSideBJustification(e.target.value)}
              placeholder="Why this side wins? (optional)" maxLength={2000} rows={2}
              className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
            />
            <input type="url" value={sideBSource} onChange={e => setSideBSource(e.target.value)}
              placeholder="Source URL (optional)" aria-label="Source URL for side B"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-400 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Author */}
        <div>
          <label htmlFor="debate-author" className="mb-1 block text-xs font-medium text-zinc-400">Display Name <span className="text-zinc-600">(optional)</span></label>
          <input id="debate-author" type="text" value={authorName} onChange={e => setAuthorName(e.target.value)} maxLength={50}
            placeholder="Leave blank for auto-generated username"
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-purple-500/50"
          />
        </div>

        {/* Error */}
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>}

        {/* Submit */}
        <button type="submit" disabled={submitting || !categorySlug || !title || !sideA || !sideB}
          className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit Debate for Review'}
        </button>
      </form>
    </div>
  );
}
