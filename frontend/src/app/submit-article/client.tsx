'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';
import type { ArticleSubmission } from '@/lib/api/types';
import { Icon } from '@/components/icons/Icon';

interface SourceField {
  id: string;
  url: string;
  title: string;
}

interface FormErrors {
  title?: string;
  body?: string;
  category?: string;
}

const CATEGORIES = [
  'technology',
  'science',
  'politics',
  'culture',
  'history',
  'business',
  'health',
];

export default function SubmitArticleClient() {
  const idCounter = useRef(0);
  const generateId = () => `source-${++idCounter.current}`;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [sources, setSources] = useState<SourceField[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const validate = useCallback((): boolean => {
    const next: FormErrors = {};
    if (!title.trim()) {
      next.title = 'Title is required';
    }
    if (!categorySlug) {
      next.category = 'Category is required';
    }
    if (body.trim().length < 100) {
      next.body = `Body must be at least 100 characters (currently ${body.trim().length})`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [title, categorySlug, body]);

  const addSource = () => {
    setSources((prev) => [...prev, { id: generateId(), url: '', title: '' }]);
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSource = (id: string, field: 'url' | 'title', value: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    const payload: ArticleSubmission = {
      title: title.trim(),
      body: body.trim(),
      category_slug: categorySlug,
    };

    if (coverImage.trim()) {
      payload.cover_image = coverImage.trim();
    }

    const activeSources = sources.filter((s) => s.url.trim());
    if (activeSources.length > 0) {
      payload.sources = activeSources.map((s) => ({
        url: s.url.trim(),
        title: s.title.trim(),
      }));
    }

    try {
      await API.submitArticle(payload);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit article');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="rounded-2xl border border-white/5 bg-white/5 p-8 text-center backdrop-blur-xl sm:p-12">
          <Icon name="Check" size={48} className="mx-auto mb-4 text-emerald-400" />
          <h1 className="font-display text-2xl text-white">Article Submitted</h1>
          <p className="mt-3 text-zinc-400">
            Your article has been submitted for review. We&apos;ll notify you once it&apos;s published.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/articles"
              className="rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
            >
              View all articles
            </Link>
            <button
              onClick={() => {
                setSubmitted(false);
                setTitle('');
                setBody('');
                setCategorySlug('');
                setCoverImage('');
                setSources([]);
                setErrors({});
                setError(null);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm text-zinc-400 backdrop-blur-xl transition hover:border-white/20 hover:text-white"
            >
              Submit another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="mb-10">
        <h1 className="font-display text-3xl text-white">Submit an Article</h1>
        <p className="mt-2 text-zinc-500">
          Long-form knowledge pieces. Fact-checked. Sourced. Submit your article for review.
        </p>
      </header>

      {error && (
        <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="article-title" className="mb-2 block text-sm font-medium text-zinc-400">
            Title
          </label>
          <input
            id="article-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter article title"
            className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600 ${errors.title ? 'border-red-500/50' : 'border-white/10'}`}
          />
          {errors.title && (
            <p className="mt-1.5 text-xs text-red-400">{errors.title}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="article-category" className="mb-2 block text-sm font-medium text-zinc-400">
            Category
          </label>
          <select
            id="article-category"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-white ${errors.category ? 'border-red-500/50' : 'border-white/10'}`}
          >
            <option value="" className="bg-zinc-900">Select a category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-zinc-900 capitalize">
                {cat}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1.5 text-xs text-red-400">{errors.category}</p>
          )}
        </div>

        {/* Body */}
        <div>
          <label htmlFor="article-body" className="mb-2 block text-sm font-medium text-zinc-400">
            Body
          </label>
          <textarea
            id="article-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your article content... Separate paragraphs with blank lines."
            rows={14}
            className={`min-h-[300px] w-full resize-y rounded-xl border bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600 ${errors.body ? 'border-red-500/50' : 'border-white/10'}`}
          />
          <div className="mt-1.5 flex items-center justify-between">
            {errors.body ? (
              <p className="text-xs text-red-400">{errors.body}</p>
            ) : (
              <span />
            )}

          </div>
        </div>

        {/* Cover Image */}
        <div>
          <label htmlFor="article-cover" className="mb-2 block text-sm font-medium text-zinc-400">
            Cover Image URL
            <span className="ml-1 text-zinc-600">(optional)</span>
          </label>
          <input
            id="article-cover"
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-600"
          />
        </div>

        {/* Sources */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-400">Sources</label>
            <button
              type="button"
              onClick={addSource}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-xl transition hover:border-white/20 hover:text-white"
            >
              <Icon name="Plus" size={12} />
              Add Source
            </button>
          </div>

          {sources.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-zinc-600 backdrop-blur-xl">
              No sources added yet. Sources strengthen fact-checking.
            </p>
          )}

          <div className="space-y-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4 backdrop-blur-xl sm:flex-row sm:items-center"
              >
                <input
                  type="text"
                  value={source.title}
                  onChange={(e) => updateSource(source.id, 'title', e.target.value)}
                  placeholder="Source title (e.g., Wikipedia)"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                />
                <input
                  type="url"
                  value={source.url}
                  onChange={(e) => updateSource(source.id, 'url', e.target.value)}
                  placeholder="https://..."
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => removeSource(source.id)}
                  className="flex-shrink-0 self-end rounded-lg p-2 text-zinc-500 transition hover:text-red-400"
                  aria-label="Remove source"
                >
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !title.trim() || !categorySlug || body.trim().length < 100}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-600 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </form>
    </main>
  );
}
