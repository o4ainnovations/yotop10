'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon, type LucideIconName } from '@/components/icons/Icon';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
  is_featured: boolean;
  children: Array<{ id: string; name: string; slug: string; post_count: number }>;
}

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => { setCategories(d.categories || []); setLoading(false); })
      .catch(() => { setError('Failed to load categories'); setLoading(false); });
  }, []);

  if (loading) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] px-3 py-6 sm:px-6 sm:py-10">
        <nav className="show-desktop mb-6 flex items-center gap-4">
          <Link href="/" className="text-sm font-bold text-orange-400 transition hover:text-orange-300">Home</Link>
          <span className="text-sm font-semibold text-white">Categories</span>
        </nav>
        <main className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-sm sm:p-8">
            <div className="mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <h2 className="text-lg font-bold text-orange-400">Error Loading Categories</h2>
            </div>
            <p className="mb-1 text-sm text-zinc-400"><strong className="text-zinc-300">Message:</strong> {error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] px-3 py-6 sm:px-6 sm:py-10">
        <nav className="show-desktop mb-8 flex items-center gap-4">
          <Link href="/" className="text-sm font-bold text-orange-400 transition hover:text-orange-300">Home</Link>
          <span className="text-sm font-semibold text-white">Categories</span>
        </nav>
        <main className="mx-auto max-w-6xl">
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No categories available.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-3 py-6 sm:px-6 sm:py-10">
      <nav className="show-desktop mb-8 flex items-center gap-4">
        <Link href="/" className="text-sm font-bold text-orange-400 transition hover:text-orange-300">Home</Link>
        <span className="text-sm font-semibold text-white">Categories</span>
      </nav>

      <main className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold text-white sm:text-3xl">Categories</h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {categories.map(cat => (
            <Link
              key={cat.id}
              href={`/c/${cat.slug}`}
              className="group block rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-orange-500/30 hover:bg-white/5 hover:shadow-lg hover:shadow-orange-500/5 sm:p-6"
            >
              <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-white">
                {cat.icon && <Icon name={cat.icon as LucideIconName} size={20} />}
                {cat.name}
              </h2>
              {cat.description && (
                <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                  {cat.description}
                </p>
              )}
              <span className="text-xs text-zinc-600">
                {cat.post_count} {cat.post_count === 1 ? 'post' : 'posts'}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
