'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';

interface FlipInfo {
  title: string;
  slug: string;
  fire_count: number;
  parent_fire_count: number;
}

export function AuthorityFlipBanner({ slug }: { slug: string }) {
  const [flips, setFlips] = useState<FlipInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/posts/${slug}/authority-flip`)
      .then(r => r.json())
      .then(data => { setFlips(data.flips || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading || flips.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 mb-6">
      <div className="flex items-start gap-3">
        <Icon name="Swords" size={20} className="text-orange-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-orange-400 mb-1">Authority Challenge</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The community has found a more popular version of this list.
          </p>
          <div className="mt-2 space-y-1">
            {flips.map(f => (
              <Link
                key={f.slug}
                href={`/${slug}?vs=${f.slug}`}
                className="inline-flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-400 hover:text-orange-300 transition"
              >
                <Icon name="Flame" size={12} />
                {f.title} ({f.fire_count} fires vs {f.parent_fire_count})
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
