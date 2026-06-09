'use client';

import Link from 'next/link';
import { Icon, type LucideIconName } from './icons/Icon';

interface CategoryItem {
  name: string;
  slug: string;
  icon?: string;
  post_count: number;
}

export function HomeCategories({ categories }: { categories: CategoryItem[] }) {
  const top = categories.filter(c => c.post_count > 0).length > 0
    ? categories.sort((a, b) => b.post_count - a.post_count).slice(0, 6)
    : categories.slice(0, 6);

  return (
    <section className="px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="Folder" size={16} className="text-orange-400" />
          Categories
        </h2>
        <Link href="/categories" className="text-xs text-orange-400 hover:text-orange-300 transition">
          Browse all &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {top.map(cat => (
          <Link
            key={cat.slug}
            href={`/c/${cat.slug}`}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-2 py-3 transition hover:border-orange-500/30 hover:bg-white/10 group"
          >
            {cat.icon && (
              <Icon name={cat.icon as LucideIconName} size={20} className="text-zinc-400 group-hover:text-orange-400 transition" />
            )}
            <span className="text-xs text-zinc-400 text-center leading-tight line-clamp-1 group-hover:text-zinc-200 transition">
              {cat.name}
            </span>
            <span className="text-3xs text-zinc-600">{cat.post_count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
