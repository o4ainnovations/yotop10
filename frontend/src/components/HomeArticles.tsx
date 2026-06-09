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

export function HomeArticles({ articles }: { articles: ArticleItem[] }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="FileText" size={16} className="text-orange-400" />
          Recent Articles
        </h2>
        <Link href="/articles" className="text-xs text-orange-400 hover:text-orange-300 transition">
          Read more &rarr;
        </Link>
      </div>
      <div className="space-y-2">
        {articles.slice(0, 3).map(a => (
          <Link
            key={a.slug}
            href={`/articles/${a.slug}`}
            className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition hover:border-orange-500/20 hover:bg-white/10 group"
          >
            <div className="shrink-0 w-14 h-14 rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
              {a.cover_image ? (
                <Image src={a.cover_image} alt="" width={56} height={56} className="object-cover w-full h-full" unoptimized />
              ) : (
                <Icon name="FileText" size={20} className="text-zinc-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-300 leading-snug line-clamp-2 group-hover:text-white transition">{a.title}</p>
              <p className="text-3xs text-zinc-600 mt-1">
                {a.author_display_name || a.author_username || ''}
                {a.reading_time ? ` · ${a.reading_time} min read` : ''}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
