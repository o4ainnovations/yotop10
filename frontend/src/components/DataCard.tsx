'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icons/Icon';
import { relativeTime } from '@/lib/dates';
import type { Post } from '@/lib/api/types';

export function DataCard({ post }: { post: Post }) {
  const hasHero =
    (post.format === 'hero_list' || post.format === 'full_list') &&
    post.hero_image_url;
  const topItems = post.topItems?.slice(0, 3);

  return (
    <Link href={`/${post.slug}`} className="block group">
      <article className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 transition hover:border-white/10 hover:bg-white/[0.03]">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-zinc-500">
                CAT/{post.category_slug}
              </span>
              <span
                className="font-mono text-xs text-zinc-600"
                suppressHydrationWarning
              >
                {relativeTime(post.created_at)}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white mb-3">
              {post.title}
            </h3>

            {topItems && topItems.length > 0 && (
              <div className="mb-3 space-y-0.5">
                {topItems.map((item) => (
                  <p key={item.rank} className="text-sm text-zinc-400">
                    <span className="font-mono text-zinc-500">
                      {item.rank}.
                    </span>{' '}
                    {item.title}
                  </p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-zinc-500">
                by @{post.author_username}
              </span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                  <Icon name="ChartBar" size={13} />
                  {post.view_count}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                  <Icon name="MessageCircle" size={13} />
                  {post.comment_count}
                </span>
              </div>
            </div>
          </div>

          {hasHero && (
            <div className="hidden sm:block shrink-0">
              <Image
                src={post.hero_image_url!}
                alt=""
                width={120}
                height={120}
                className="rounded-xl object-cover w-[120px] h-[120px]"
              />
            </div>
          )}
        </div>

        {hasHero && (
          <div className="sm:hidden mt-4">
            <Image
              src={post.hero_image_url!}
              alt=""
              width={600}
              height={300}
              className="rounded-xl w-full object-cover"
            />
          </div>
        )}
      </article>
    </Link>
  );
}
