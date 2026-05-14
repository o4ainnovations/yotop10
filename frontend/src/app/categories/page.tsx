'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API, CategoriesResponse } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';

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

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    API.getCategories()
      .then((data: CategoriesResponse) => {
        setCategories(data.categories || []);
        setError(null);
      })
      .catch(err => {
        console.error('[Categories] API error:', err);
        setError(err.message || 'Failed to load categories');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 px-3 py-6 sm:px-6 sm:py-10">
        <nav className="mb-6 flex items-center gap-4">
          <Link href="/" className="text-sm font-bold text-orange-400 transition hover:text-orange-300">Home</Link>
          <span className="text-sm font-semibold text-white">Categories</span>
        </nav>
        <main className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-sm sm:p-8">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="TriangleAlert" size={20} className="text-orange-400" />
              <h2 className="text-lg font-bold text-orange-400">Error Loading Categories</h2>
            </div>
            <p className="mb-1 text-sm text-zinc-400"><strong className="text-zinc-300">Message:</strong> {error}</p>
            <p className="text-sm text-zinc-500">Check browser console for more details.</p>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-3 py-6 sm:px-6 sm:py-10">
        <nav className="mb-6 flex items-center gap-4">
          <Link href="/" className="text-sm font-bold text-orange-400 transition hover:text-orange-300">Home</Link>
          <span className="text-sm font-semibold text-white">Categories</span>
        </nav>
        <main className="mx-auto max-w-6xl py-12 text-center">
          <p className="text-sm text-zinc-500">Loading categories...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-3 py-6 sm:px-6 sm:py-10">
      <nav className="mb-8 flex items-center gap-4">
        <Link href="/" className="text-sm font-bold text-orange-400 transition hover:text-orange-300">Home</Link>
        <span className="text-sm font-semibold text-white">Categories</span>
      </nav>

      <main className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold text-white sm:text-3xl">Categories</h1>

        {categories.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No categories available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {categories.map(cat => (
              <div
                key={cat.id}
                onClick={() => router.push(`/c/${cat.slug}`)}
                className="group block cursor-pointer rounded-2xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-sm transition-all duration-300 hover:border-orange-500/30 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-orange-500/5 sm:p-6"
              >
                <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-white">
                  {cat.icon && <span>{cat.icon}</span>}
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
                {cat.children.length > 0 && (
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Subcategories
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {cat.children.map(child => (
                        <li key={child.id}>
                          <Link
                            href={`/c/${child.slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-[13px] text-zinc-400 transition hover:bg-orange-500/10 hover:text-orange-400"
                          >
                            <span>{child.name}</span>
                            <span className="text-xs text-zinc-600">{child.post_count}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
