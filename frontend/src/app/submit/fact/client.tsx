'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';

const FACT_DRAFT_KEY = 'yotop10_fact_draft';

export default function FactClient() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FACT_DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (Date.now() - d.savedAt < 3600000) {
          if (d.title) setTitle(d.title);
          if (d.body) setBody(d.body);
          if (d.sourceUrl) setSourceUrl(d.sourceUrl);
          if (d.authorName) setAuthorName(d.authorName);
        } else {
          localStorage.removeItem(FACT_DRAFT_KEY);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Save draft on change
  useEffect(() => {
    const timeout = setTimeout(() => {
      const data = { title, body, sourceUrl, authorName, savedAt: Date.now() };
      localStorage.setItem(FACT_DRAFT_KEY, JSON.stringify(data));
    }, 800);
    return () => clearTimeout(timeout);
  }, [title, body, sourceUrl, authorName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body || !sourceUrl) {
      setError('Headline, fact body, and source URL are required.');
      return;
    }
    try { new URL(sourceUrl); } catch { setError('Please enter a valid source URL.'); return; }
    if (body.length < 20) { setError('Fact body must be at least 20 characters.'); return; }
    if (body.length > 2000) { setError('Fact body must be less than 2000 characters.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const response = await API.addPost({
        title,
        post_type: 'fact_drop',
        intro: body,
        category_slug: 'education',
        items: [{ rank: 1, title: title, justification: body, source_url: sourceUrl }],
        author_display_name: authorName || undefined,
      }) as { post?: { id: string; title: string; status: string; slug?: string } };

      localStorage.removeItem(FACT_DRAFT_KEY);
      const slug = response.post?.slug || '';

      setSubmitting(false);
      toast.success('Fact submitted! It\'s now pending review.');
      window.location.href = `/${slug}`;
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : '';
      try { const j = msg.lastIndexOf('{'); if (j !== -1) { const body = JSON.parse(msg.slice(j)); setError(body.error || msg); return; } } catch { /* */ }
      setError(msg || 'Failed to submit fact.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10 min-h-[calc(100vh-56px)]">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="Lightbulb" size={20} className="text-pink-400" />
          <h1 className="text-xl font-bold text-white sm:text-2xl">Drop a Fact</h1>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">Share a surprising fact with a verifiable source. Facts are automatically categorized under Education.</p>
        <nav className="mt-3 flex items-center gap-3 text-xs">
          <Link href="/new" className="text-pink-400 hover:text-pink-300 transition">&larr; Change type</Link>
          <span className="text-zinc-700">|</span>
          <Link href="/" className="text-zinc-500 hover:text-pink-400 transition">Home</Link>
        </nav>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Headline */}
        <div>
          <label htmlFor="fact-title" className="mb-1 block text-xs font-medium text-zinc-400">Fact Headline <span className="text-pink-400">*</span></label>
          <input id="fact-title" type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Octopuses have three hearts"
            maxLength={200} className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-pink-500/50"
          />
        </div>

        {/* Body */}
        <div>
          <label htmlFor="fact-body" className="mb-1 block text-xs font-medium text-zinc-400">The Fact <span className="text-pink-400">*</span></label>
          <textarea id="fact-body" value={body} onChange={e => setBody(e.target.value)}
            placeholder="Explain the fact in detail. Include context and any relevant background information."
            maxLength={2000} rows={5}
            className="w-full resize-y rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-pink-500/50"
          />
          <div className="mt-1 text-right text-3xs text-zinc-600">{body.length}/2000</div>
        </div>

        {/* Category (static — always Education) */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <Icon name="Folder" size={14} className="text-zinc-500" />
            <span className="text-zinc-400">Category:</span>
            <span className="text-white font-medium">Education</span>
          </div>
        </div>

        {/* Source */}
        <div>
          <label htmlFor="fact-source" className="mb-1 block text-xs font-medium text-zinc-400">Source URL <span className="text-pink-400">*</span></label>
          <input id="fact-source" type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://..." required
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-pink-500/50"
          />
          <p className="mt-1 text-3xs text-zinc-600">Facts require a verifiable source for credibility.</p>
        </div>

        {/* Author */}
        <div>
          <label htmlFor="fact-author" className="mb-1 block text-xs font-medium text-zinc-400">Display Name <span className="text-zinc-600">(optional)</span></label>
          <input id="fact-author" type="text" value={authorName} onChange={e => setAuthorName(e.target.value)} maxLength={50}
            placeholder="Leave blank for auto-generated username"
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-pink-500/50"
          />
        </div>

        {/* Error */}
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>}

        {/* Submit */}
        <button type="submit" disabled={submitting || !title || !body || !sourceUrl}
          className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit Fact for Review'}
        </button>
      </form>
    </div>
  );
}
