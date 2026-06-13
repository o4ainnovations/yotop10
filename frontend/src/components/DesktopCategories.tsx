'use client';

import Link from 'next/link';
import { Icon, type LucideIconName } from './icons/Icon';

interface CategoryItem {
  name: string;
  slug: string;
  post_count: number;
  icon?: string;
}

const CATEGORY_META: Record<string, { icon: LucideIconName; gradient: string }> = {
  technology: { icon: 'Cpu' as const, gradient: 'from-cyan-500/20 to-blue-600/20' },
  music: { icon: 'Music' as const, gradient: 'from-purple-500/20 to-pink-600/20' },
  movies: { icon: 'Film' as const, gradient: 'from-yellow-500/20 to-orange-600/20' },
  sports: { icon: 'Trophy' as const, gradient: 'from-emerald-500/20 to-teal-600/20' },
  food: { icon: 'UtensilsCrossed' as const, gradient: 'from-red-500/20 to-orange-600/20' },
  science: { icon: 'FlaskConical' as const, gradient: 'from-indigo-500/20 to-violet-600/20' },
  education: { icon: 'BookOpen' as const, gradient: 'from-sky-500/20 to-indigo-600/20' },
  gaming: { icon: 'Gamepad2' as const, gradient: 'from-rose-500/20 to-pink-600/20' },
  politics: { icon: 'Landmark' as const, gradient: 'from-stone-500/20 to-zinc-600/20' },
  travel: { icon: 'Compass' as const, gradient: 'from-teal-500/20 to-emerald-600/20' },
  health: { icon: 'Heart' as const, gradient: 'from-rose-500/20 to-red-600/20' },
  business: { icon: 'TrendingUp' as const, gradient: 'from-amber-500/20 to-orange-600/20' },
};

export function DesktopCategories({ categories, className = '' }: { categories: CategoryItem[]; className?: string }) {
  const top = categories.filter(c => c.name && c.post_count > 0).slice(0, 9);

  if (top.length === 0) return null;

  return (
    <section className={`${className}`}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="Grid3x3" size={16} className="text-orange-400" />
          Categories
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {top.map(cat => {
          const meta = CATEGORY_META[cat.slug] || { icon: 'Folder' as LucideIconName, gradient: 'from-zinc-500/20 to-zinc-600/20' };
          return (
            <Link
              key={cat.slug}
              href={`/c/${cat.slug}`}
              className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-orange-500/20 hover:bg-white/[0.05] text-center"
            >
              <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} transition group-hover:scale-110`}>
                <Icon name={meta.icon} size={18} className="text-white/70" />
              </div>
              <p className="text-xs font-semibold text-zinc-300 group-hover:text-white transition truncate">{cat.name}</p>
              <p className="text-3xs text-zinc-600 mt-1">{cat.post_count} posts</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
