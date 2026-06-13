'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';

interface FactItem {
  slug: string;
  title: string;
  intro: string;
  author_display_name?: string;
  author_username?: string;
}

export function DesktopFacts({ facts, className = '' }: { facts: FactItem[]; className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (facts.length <= 1) return;
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % facts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [facts.length]);

  if (!facts || facts.length === 0) return null;

  const fact = facts[index];

  return (
    <section className={`${className}`}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="Lightbulb" size={16} className="text-orange-400" />
          Did You Know?
        </h2>
      </div>
      <Link
        href={`/${fact.slug}`}
        className="group block rounded-xl border border-orange-500/10 bg-gradient-to-br from-orange-500/[0.04] to-pink-500/[0.04] p-6 transition hover:border-orange-500/20 hover:from-orange-500/[0.08] hover:to-pink-500/[0.08]"
      >
        <div className="flex items-start gap-5">
          <div className="hidden sm:flex shrink-0 h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/15 to-pink-500/15">
            <Icon name="Lightbulb" size={24} className="text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base leading-relaxed text-zinc-300 group-hover:text-white transition line-clamp-4">
              {fact.intro || fact.title}
            </p>
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-orange-500/10">
              <span className="text-3xs text-zinc-600">
                {fact.author_display_name || fact.author_username || ''}
              </span>
              <span className="text-3xs text-orange-400/60 group-hover:text-orange-400 transition">
                Read full fact &rarr;
              </span>
            </div>
          </div>
        </div>
      </Link>
      {facts.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {facts.slice(0, Math.min(facts.length, 8)).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-orange-400' : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
              }`}
              aria-label={`Fact ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
