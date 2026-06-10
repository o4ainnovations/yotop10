import { PostCarouselCard } from '@/components/PostCarouselCard';
import { DesktopCarousel } from '@/components/DesktopCarousel';
import { HomeCategoryFeed } from '@/components/HomeCategoryFeed';
import { HomeDebates } from '@/components/HomeDebates';
import { HomeArticles } from '@/components/HomeArticles';
import { HomeFactDrop } from '@/components/HomeFactDrop';
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

export default async function Home() {
  const [postsData, catsData, argsData, artsData, factsData] = await Promise.all([
    fetchJson<PostsResponse>(`${API_BASE}/posts?page=1&limit=12&post_type=top_list%2Cbest_of%2Cworst_of`, { posts: [] }),
    fetchJson<{ categories: CategoryItem[] }>(`${API_BASE}/categories`, { categories: [] }),
    fetchJson<{ arguments: DebateItem[] }>(`${API_BASE}/arguments?limit=4`, { arguments: [] }),
    fetchJson<{ articles: ArticleItem[] }>(`${API_BASE}/articles?limit=3`, { articles: [] }),
    fetchJson<PostsResponse>(`${API_BASE}/posts?post_type=fact_drop&limit=5`, { posts: [] }),
  ]);

  const posts = postsData.posts || [];
  const categories = catsData.categories || [];
  const debates = argsData.arguments || [];
  const articles = artsData.articles || [];
  const facts = factsData.posts || [];

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
        <CtaButton href="/submit">
          <Icon name="Plus" size={16} />
          Submit a List
        </CtaButton>
      </div>
    );
  }

  return (
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
        <CtaButton href="/submit">
          <Icon name="Plus" size={16} />
          Submit a List
        </CtaButton>
      </section>
    </>
  );
}
