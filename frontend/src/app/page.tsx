import { GlassSlab } from '@/components/GlassSlab';
import { ArgumentBar } from '@/components/ArgumentBar';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/icons/Icon';
import { relativeTime } from '@/lib/dates';
import type { Post, CategoriesResponse, PostsResponse } from '@/lib/api/types';

const API_BASE = process.env.INTERNAL_API_URL || 'http://localhost:8000/api';

function generateSerial(post: Post): string {
  const prefix = (post.category_slug || 'UNK').substring(0, 3).toUpperCase();
  let hash = 0;
  for (let i = 0; i < post.id.length; i++) {
    hash = ((hash << 5) - hash) + post.id.charCodeAt(i);
    hash |= 0;
  }
  const num = String(Math.abs(hash) % 10000).padStart(4, '0');
  const suffix = (post.author_username || 'X')[0].toUpperCase();
  return `${prefix}-${num}-${suffix}`;
}

async function getSiteData(): Promise<{
  posts: Post[];
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
  const [{ posts, totalPosts, totalComments }, categories] = await Promise.all([
    getSiteData(),
    getCategories(),
  ]);
  const powerTrio = posts.slice(0, 3);
  const stripLogic = posts.slice(3, 12);

  return (
    <>
      {/* ── MOBILE CARD DECK ── */}
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

      {/* ── DESKTOP TRIPLE PANE ── */}
      <div className="hidden lg:flex h-[calc(100vh-56px)] bg-[var(--color-bg)]">
        {/* LEFT WING — Navigator */}
        <aside className="w-1/5 min-w-[200px] max-w-[260px] flex flex-col h-full border-r border-white/5 overflow-y-auto p-6">
          <nav className="flex flex-col">
            {categories.map((cat) => (
              <div key={cat.slug} className="relative group/cat">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent opacity-0 group-hover/cat:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <Link
                  href={`/c/${cat.slug}`}
                  className="relative block border-l-2 border-white/5 pl-4 py-3 transition-all hover:border-orange-500"
                >
                  <span className="font-sans font-extralight text-4xl tracking-widest text-white/10 uppercase transition-all duration-500 hover:text-white/90 hover:font-semibold">
                    {cat.name}
                  </span>
                </Link>
              </div>
            ))}
          </nav>
          <div className="mt-auto pt-8 border-t border-white/5">
            <div className="text-[10px] font-mono text-zinc-600 space-y-1">
              <div>TOTAL FACT-MINES <span className="text-white/60 font-bold">{totalPosts}</span></div>
              <div>ACTIVE ARGUMENTS <span className="text-white/60 font-bold">{totalComments}</span></div>
            </div>
          </div>
        </aside>

        {/* CENTER STAGE — Workstation */}
        <div className="flex-1 max-w-3xl mx-auto overflow-y-auto px-8 py-6 space-y-5">
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
              {/* Power Trio #1-#3 */}
              {powerTrio.map((post) => {
                const hasHero = (post.format === 'hero_list' || post.format === 'full_list') && post.hero_image_url;
                return (
                  <Link key={post.id} href={`/${post.slug}`} className="block">
                    <article className="glass-slab spatial-depth rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="wiki-badge">{generateSerial(post)}</span>
                        <span className="text-[10px] font-mono text-zinc-600" suppressHydrationWarning>
                          {relativeTime(post.created_at)}
                        </span>
                      </div>
                      <div className="flex gap-5">
                        {hasHero && (
                          <Image
                            src={post.hero_image_url!}
                            alt=""
                            width={224}
                            height={144}
                            className="w-56 h-36 rounded-xl object-cover shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-display text-white mb-2">{post.title}</h3>
                          <div className="flex items-center gap-4 mb-3">
                            <span className="font-mono text-xs text-zinc-600">@{post.author_username}</span>
                            <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-600">
                              <Icon name="Eye" size={11} />
                              {post.view_count}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-600">
                              <Icon name="MessageCircle" size={11} />
                              {post.comment_count}
                            </span>
                          </div>
                          <ArgumentBar supportPct={50} contradictPct={50} />
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}

              {/* Strip Logic #4+ */}
              {stripLogic.length > 0 && (
                <>
                  <div className="pt-2">
                    <h2 className="text-[11px] font-mono tracking-widest text-zinc-600 uppercase">
                      Strip Logic
                    </h2>
                  </div>
                  {stripLogic.map((post) => (
                    <Link key={post.id} href={`/${post.slug}`} className="block">
                      <article className="glass-slab rounded-2xl py-2 px-4 overflow-hidden max-h-[40px] transition-all duration-500 ease-out hover:max-h-[150px] group/strip">
                        <div className="flex items-center justify-between min-h-[24px]">
                          <h3 className="font-bold text-white text-sm truncate mr-4">{post.title}</h3>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="wiki-badge">{post.category_slug}</span>
                            <span className="text-[10px] font-mono text-zinc-600" suppressHydrationWarning>
                              {relativeTime(post.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="opacity-0 transition-opacity duration-300 group-hover/strip:opacity-100 mt-2">
                          {post.intro && (
                            <p className="text-xs text-zinc-500 mb-2 line-clamp-2">{post.intro}</p>
                          )}
                          <ArgumentBar supportPct={50} contradictPct={50} />
                        </div>
                      </article>
                    </Link>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
