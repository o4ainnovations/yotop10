'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icons/Icon';

interface ArticleItem {
  slug: string;
  title: string;
  cover_image?: string;
  reading_time?: number;
  author_username?: string;
  author_display_name?: string;
}

export function DesktopArticles({ articles, className = '' }: { articles: ArticleItem[]; className?: string }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className={`${className}`}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="FileText" size={16} className="text-orange-400" />
          Recent Articles
        </h2>
        <Link href="/articles" className="text-xs text-orange-400 hover:text-orange-300 transition">
          Read more &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
        {articles.slice(0, 4).map(a => (
          <Link
            key={a.slug}
            href={`/articles/${a.slug}`}
            className="group rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden transition hover:border-orange-500/20 hover:bg-white/[0.05]"
          >
            <div className="relative h-32 w-full overflow-hidden bg-zinc-900">
              {a.cover_image ? (
                <Image src={a.cover_image} alt="" fill className="object-cover transition duration-500 group-hover:scale-105" unoptimized />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="FileText" size={32} className="text-zinc-700" />
                </div>
              )}
              {a.reading_time && (
                <span className="absolute top-2 right-2 rounded-md bg-black/50 backdrop-blur-sm px-2 py-0.5 text-3xs font-medium text-zinc-300">
                  {a.reading_time} min read
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-zinc-200 leading-snug line-clamp-2 group-hover:text-white transition mb-2">
                {a.title}
              </h3>
              <p className="text-3xs text-zinc-600">
                {a.author_display_name || a.author_username || ''}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
