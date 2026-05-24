import { PostCarouselCard } from '@/components/PostCarouselCard';
import CtaButton from '@/components/CtaButton';
import { Icon } from '@/components/icons/Icon';
import { DesktopCarousel } from '@/components/DesktopCarousel';
import type { PostsResponse } from '@/lib/api/types';

const API_BASE = process.env.INTERNAL_API_URL || 'http://localhost:8000/api';

async function getSiteData(): Promise<{
  posts: PostsResponse['posts'];
  hasMore: boolean;
  totalPosts: number;
  totalComments: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/posts?page=1&limit=12`, { cache: 'no-store' });
    if (!res.ok) return { posts: [], hasMore: false, totalPosts: 0, totalComments: 0 };
    const data: PostsResponse = await res.json();
    const posts = data.posts || [];
    return {
      posts,
      hasMore: (data.pagination?.page || 1) < (data.pagination?.totalPages || 1),
      totalPosts: data.pagination?.total || posts.length,
      totalComments: posts.reduce((sum, p) => sum + (p.comment_count || 0), 0),
    };
  } catch {
    return { posts: [], hasMore: false, totalPosts: 0, totalComments: 0 };
  }
}

export default async function Home() {
  const { posts } = await getSiteData();

  return (
    <>
      {/* ── MOBILE HORIZONTAL CAROUSEL ── */}
      <div className="lg:hidden pb-24">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <Icon name="FileText" size={24} className="text-zinc-600" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-zinc-300">No ranked lists yet.</h3>
            <CtaButton href="/submit">
              <Icon name="Plus" size={16} />
              Submit a List
            </CtaButton>
          </div>
        ) : (
          <div className="flex flex-row overflow-x-auto overflow-y-hidden gap-3 pl-4 py-4 -webkit-overflow-scrolling-touch snap-x snap-mandatory scroll-smooth">
            {posts.map((post) => (
              <div key={post.id} className="flex-shrink-0 w-[calc(76vw-12px)] scroll-snap-align-start">
                <PostCarouselCard post={post} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DESKTOP HORIZONTAL CAROUSEL ── */}
      <div className="hidden lg:block">
        <DesktopCarousel posts={posts} />
      </div>
    </>
  );
}
