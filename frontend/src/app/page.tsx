import { GlassSlab } from '@/components/GlassSlab';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import type { Post, CategoriesResponse, PostsResponse } from '@/lib/api/types';

const API_BASE = process.env.INTERNAL_API_URL || 'http://localhost:8000/api';

const SPARKLINE_HEIGHTS = ['h-1', 'h-2', 'h-3', 'h-4', 'h-5'] as const;

function sparklineFromId(id: string): Array<typeof SPARKLINE_HEIGHTS[number]> {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const bars: Array<typeof SPARKLINE_HEIGHTS[number]> = [];
  for (let j = 0; j < 8; j++) {
    const v = Math.abs((hash >> (j * 3)) & 7);
    const idx = v < SPARKLINE_HEIGHTS.length ? v : v % SPARKLINE_HEIGHTS.length;
    bars.push(SPARKLINE_HEIGHTS[idx]);
  }
  return bars;
}

function computeVelocity(post: Post): string {
  const created = new Date(post.created_at).getTime();
  const hours = Math.max(0.1, (Date.now() - created) / 3600000);
  const vph = post.comment_count / hours;
  if (vph >= 1) return `${vph.toFixed(1)}/hr`;
  const vpm = vph / 60;
  return `${vpm.toFixed(1)}/min`;
}

async function getPosts(): Promise<{ posts: Post[]; hasMore: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/posts?page=1&limit=12`, { cache: 'no-store' });
    if (!res.ok) return { posts: [], hasMore: false };
    const data: PostsResponse = await res.json();
    return {
      posts: data.posts || [],
      hasMore: (data.pagination?.page || 1) < (data.pagination?.totalPages || 1),
    };
  } catch {
    return { posts: [], hasMore: false };
  }
}

interface FlatCategory { name: string; slug: string; }

async function getCategories(): Promise<FlatCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/categories?include_children=false`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data: CategoriesResponse = await res.json();
    if (!data.categories?.length) return [];

    const flat: FlatCategory[] = [];
    for (const cat of data.categories) {
      flat.push({ name: cat.name, slug: cat.slug });
      if (cat.children) {
        for (const child of cat.children) {
          flat.push({ name: child.name, slug: child.slug });
        }
      }
    }
    return flat;
  } catch {
    return [];
  }
}

export default async function Home() {
  const [{ posts }, categories] = await Promise.all([getPosts(), getCategories()]);
  const powerTrio = posts.slice(0, 3);
  const stripLogic = posts.slice(3, 12);
  const pulsePosts = posts.slice(0, 7);

  return (
    <>
      {/* MOBILE CARD DECK */}
      <div className="lg:hidden space-y-3 px-3 py-4 pb-24">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <Icon name="FileText" size={24} className="text-zinc-600" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-zinc-300">No ranked lists yet.</h3>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
            >
              <Icon name="Plus" size={16} />
              Submit a List
            </Link>
          </div>
        ) : (
          posts.map((post, i) => (
            <GlassSlab
              key={post.id}
              post={post}
              variant={i < 3 ? 'featured' : 'compact'}
              observe={i >= 2}
            />
          ))
        )}
      </div>

      {/* DESKTOP TRIPLE PANE */}
      <div className="hidden lg:flex h-[calc(100vh-56px)]">
        {/* LEFT WING — Category Rail */}
        <aside className="w-[200px] shrink-0 h-full overflow-y-auto border-r border-white/5">
          <nav className="py-6">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/c/${cat.slug}`}
                className="block border-l border-white/10 pl-4 py-3 transition-all hover:border-orange-500/60"
              >
                <span className="block font-sans font-extralight text-6xl tracking-widest text-zinc-800 transition-all hover:text-white hover:font-semibold">
                  {cat.name}
                </span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* CENTER STAGE */}
        <div className="flex-1 overflow-y-auto max-w-3xl mx-auto px-8 py-6">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                <Icon name="FileText" size={28} className="text-zinc-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-300">No ranked lists yet.</h3>
              <Link
                href="/submit"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
              >
                <Icon name="Plus" size={16} />
                Submit a List
              </Link>
            </div>
          ) : (
            <>
              {/* Power Trio */}
              <div className="space-y-4 mb-8">
                {powerTrio.map((post) => (
                  <GlassSlab key={post.id} post={post} variant="featured" />
                ))}
              </div>

              {/* Strip Logic */}
              {stripLogic.length > 0 && (
                <>
                  <div className="mb-4">
                    <h2 className="text-[11px] font-mono tracking-widest text-zinc-600 uppercase">
                      Strip Logic
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {stripLogic.map((post) => (
                      <GlassSlab key={post.id} post={post} variant="compact" observe />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* RIGHT WING — Live Pulse */}
        <aside className="w-[280px] shrink-0 h-full overflow-y-auto border-l border-white/5 p-4">
          <h2 className="text-[11px] font-mono tracking-widest text-zinc-600 mb-4">
            LIVE PULSE
          </h2>
          {pulsePosts.length === 0 ? (
            <p className="text-xs text-zinc-600">No pulse data yet.</p>
          ) : (
            <div className="space-y-3">
              {pulsePosts.map((post) => {
                const initial = (post.author_display_name || post.author_username || '?')[0].toUpperCase();
                const snippet = post.title.length > 40 ? post.title.slice(0, 40) + '\u2026' : post.title;
                const bars = sparklineFromId(post.id);
                const velocity = computeVelocity(post);

                return (
                  <Link
                    key={post.id}
                    href={`/${post.slug}`}
                    className="block rounded-2xl glass-obsidian p-3 transition hover:border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 font-mono text-xs flex items-center justify-center shrink-0">
                        {initial}
                      </span>
                      <span className="text-xs text-zinc-400 truncate">
                        {snippet}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-end gap-0.5 h-5">
                        {bars.map((h, i) => (
                          <div key={i} className={`w-1 rounded-full ${h} bg-orange-500/60`} />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono text-orange-400 ml-auto shrink-0">
                        {velocity}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
