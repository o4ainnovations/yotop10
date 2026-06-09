import Link from 'next/link';
import { Icon } from './icons/Icon';

interface DebateItem {
  slug: string;
  title: string;
  comment_count: number;
  velocity?: number;
  support_pct?: number;
  contradict_pct?: number;
  post_type?: string;
  item_a_title?: string;
  item_b_title?: string;
}

export function HomeDebates({ debates }: { debates: DebateItem[] }) {
  if (!debates || debates.length === 0) return null;

  return (
    <section className="px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="MessageCircle" size={16} className="text-orange-400" />
          Hot Debates
        </h2>
        <Link href="/arguments" className="text-xs text-orange-400 hover:text-orange-300 transition">
          View all &rarr;
        </Link>
      </div>
      <div className="space-y-3">
        {debates.slice(0, 4).map(d => {
          const aPct = d.support_pct ?? 50;
          const bPct = d.contradict_pct ?? 50;
          const totalPct = aPct + bPct || 1;
          const aWidth = Math.round((aPct / totalPct) * 100);
          const bWidth = 100 - aWidth;

          return (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              className="block rounded-xl border border-white/5 bg-white/5 px-4 py-4 transition hover:border-orange-500/20 hover:bg-white/10 group"
            >
              <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition mb-3 leading-snug">
                {d.title}
              </p>

              {/* Poll bar */}
              <div className="flex h-8 rounded-lg overflow-hidden mb-2">
                <div
                  className="bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-start px-2 transition-all"
                  style={{ width: `${aWidth}%` }}
                >
                  {aWidth > 20 && (
                    <span className="text-2xs font-bold text-white truncate">
                      {d.item_a_title || 'For'}
                    </span>
                  )}
                </div>
                <div
                  className="bg-zinc-700 flex items-center justify-end px-2 transition-all"
                  style={{ width: `${bWidth}%` }}
                >
                  {bWidth > 20 && (
                    <span className="text-2xs font-bold text-zinc-300 truncate">
                      {d.item_b_title || 'Against'}
                    </span>
                  )}
                </div>
              </div>

              {/* Percentages + CTA */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-orange-400 font-bold">{aPct}%</span>
                  <span className="text-zinc-700">|</span>
                  <span className="font-mono text-zinc-500">{bPct}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xs text-zinc-600 flex items-center gap-1">
                    <Icon name="MessageCircle" size={12} />
                    {d.comment_count}
                  </span>
                  <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-2xs font-semibold text-orange-400 transition group-hover:bg-orange-500/20">
                    Cast your vote &rarr;
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
