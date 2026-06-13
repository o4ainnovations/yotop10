import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PostCarouselCard } from '@/components/PostCarouselCard';
import { DesktopCarousel } from '@/components/DesktopCarousel';
import { HomeCategoryFeed } from '@/components/HomeCategoryFeed';
import { HomeDebates } from '@/components/HomeDebates';
import { HomeArticles } from '@/components/HomeArticles';
import { HomeFactDrop } from '@/components/HomeFactDrop';
import { HomeSkeleton } from '@/components/HomeSkeleton';
import { DesktopDebates } from '@/components/DesktopDebates';
import { DesktopArticles } from '@/components/DesktopArticles';
import { DesktopCategories } from '@/components/DesktopCategories';
import { DesktopFacts } from '@/components/DesktopFacts';
import { DesktopCta } from '@/components/DesktopCta';

import { DesktopTrending } from '@/components/DesktopTrending';
import { DesktopHallOfFame } from '@/components/DesktopHallOfFame';
import { DesktopStats } from '@/components/DesktopStats';
import CtaButton from '@/components/CtaButton';
import { Icon } from '@/components/icons/Icon';
import type { PostsResponse } from '@/lib/api/types';

const API_BASE = process.env.INTERNAL_API_URL || 'http://localhost:8000/api';

interface CategoryItem {
  name: string;
  slug: string;
  icon?: string;
  post_count: number;
}

interface DebateItem {
  id?: string;
  slug: string;
  title: string;
  comment_count: number;
  velocity?: number;
  support_pct?: number;
  contradict_pct?: number;
  post_type?: string;
  item_a_title?: string;
  item_b_title?: string;
  votes_a?: number;
  votes_b?: number;
  hero_image_url?: string | null;
  user_display_name?: string;
  view_count?: number;
  created_at?: string;
}

interface ArticleItem {
  slug: string;
  title: string;
  cover_image?: string;
  reading_time?: number;
  author_username?: string;
  author_display_name?: string;
}

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export const metadata: Metadata = {
  title: 'YoTop10 — Fact Mine. Debate Ground.',
  description: 'The open catalog of ranked lists. Submit your list. Defend your rankings. Vote on debates, discover facts, and curate the best of everything.',
  openGraph: {
    title: 'YoTop10 — Fact Mine. Debate Ground.',
    description: 'The open catalog of ranked lists. Submit your list. Defend your rankings.',
  },
};

export default async function Home() {
  const [postsData, catsData, argsData, artsData, factsData] = await Promise.all([
    fetchJson<PostsResponse>(`${API_BASE}/posts?post_type=top_list%2Cbest_of%2Cworst_of`, { posts: [] }),
    fetchJson<{ categories: CategoryItem[] }>(`${API_BASE}/categories`, { categories: [] }),
    fetchJson<{ arguments: DebateItem[] }>(`${API_BASE}/arguments?limit=12`, { arguments: [] }),
    fetchJson<{ articles: ArticleItem[] }>(`${API_BASE}/articles?limit=8`, { articles: [] }),
    fetchJson<PostsResponse>(`${API_BASE}/posts?post_type=fact_drop&limit=10`, { posts: [] }),
  ]);

  // Deduplicate by title — never show the same content twice
  const uniqueByTitle = <T extends { title: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const posts = uniqueByTitle(postsData.posts || []);
  const categories = catsData.categories || [];
  const debates = uniqueByTitle(argsData.arguments || []);
  const articles = uniqueByTitle(artsData.articles || []);
  const facts = uniqueByTitle(factsData.posts || []);

  const hasContent = posts.length > 0 || debates.length > 0 || categories.some(c => c.post_count > 0) || articles.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5">
          <Icon name="FileText" size={36} className="text-zinc-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-white">Welcome to YoTop10</h2>
        <p className="mb-8 max-w-md text-sm text-zinc-500 leading-relaxed">
          The open catalog of ranked lists. Be the first to submit a list and start the conversation.
        </p>
        <CtaButton href="/new">
          <Icon name="Plus" size={16} />
          Submit a List
        </CtaButton>
      </div>
    );
  }

  return (
    <Suspense fallback={<HomeSkeleton />}>
    <>
      {/* Section 1: Latest Lists — horizontal carousel */}
      <div className="pb-2">
        <div className="px-3 sm:px-6 pt-6 pb-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Icon name="Flame" size={16} className="text-orange-400" />
            Latest Lists
          </h2>
        </div>
        <div className="lg:hidden">
          <div className="flex flex-row overflow-x-auto overflow-y-hidden gap-3 pl-4 py-2 -webkit-overflow-scrolling-touch snap-x snap-mandatory scroll-smooth">
            {posts.map(post => (
              <div key={post.id} className="flex-shrink-0 w-[calc(76vw-12px)] scroll-snap-align-start">
                <PostCarouselCard post={post} />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block">
          <DesktopCarousel posts={posts} />
        </div>
      </div>

      {/* ─── Mobile sections (unchanged, hidden on md+) ─── */}
      <div className="md:hidden">
        {/* Section 2: Hot Debates */}
        <HomeDebates debates={debates} />

        {debates.length > 0 && <hr className="border-white/5 mx-3 sm:mx-6" />}

        {/* Section 3: Categories — pills + 3-slide post feed */}
        <HomeCategoryFeed categories={categories} />

        <hr className="border-white/5 mx-3 sm:mx-6" />

        {/* Section 4: Did You Know? (Fact Drop widget) */}
        <HomeFactDrop facts={facts} />

        {facts.length > 0 && <hr className="border-white/5 mx-3 sm:mx-6" />}

        {/* Section 5: Recent Articles */}
        <HomeArticles articles={articles} />

        <hr className="border-white/5 mx-3 sm:mx-6" />

        {/* Section 6: Bottom CTA */}
        <section className="px-3 sm:px-6 py-8 text-center">
          <p className="mb-4 text-sm text-zinc-500 leading-relaxed max-w-md mx-auto">
            Have a ranking to share? Submit your list and join the debate.
          </p>
          <CtaButton href="/new">
            <Icon name="Plus" size={16} />
            Submit a List
          </CtaButton>
        </section>
      </div>

      {/* ─── Desktop sections (hidden below md) ─── */}
      <div className="hidden md:block px-4 lg:px-6 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Row 1: Debates Arena (2/3 width) + Articles (1/3 width) */}
          <DesktopDebates className="col-span-2 lg:col-span-2" debates={debates} />
          <DesktopArticles className="col-span-2 lg:col-span-1" articles={articles} />

          {/* Row 2: Categories + Did You Know */}
          <DesktopCategories className="col-span-2 lg:col-span-1" categories={categories} />
          <DesktopFacts className="col-span-2 lg:col-span-1" facts={facts} />

          {/* Row 3: Trending + Hall of Fame + Stats */}
          <DesktopTrending className="col-span-2 lg:col-span-1" />
          <DesktopHallOfFame className="col-span-2 lg:col-span-1" />
          <DesktopStats className="col-span-2 lg:col-span-1" />

          {/* Row 4: CTA */}
          <DesktopCta className="col-span-2 lg:col-span-3" />
        </div>
      </div>
    </>
    </Suspense>
  );
}
