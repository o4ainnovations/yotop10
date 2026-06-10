'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';

interface FactItem {
  slug: string;
  title: string;
  intro: string;
  author_display_name?: string;
}

export function HomeFactDrop({ facts }: { facts: FactItem[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (facts.length <= 1) return;
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % facts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [facts.length]);

  if (!facts || facts.length === 0) return null;

  const fact = facts[index];

  return (
    <section className="px-3 sm:px-6 py-6">
      <Link
        href={`/${fact.slug}`}
        className="block rounded-xl border border-orange-500/10 bg-gradient-to-r from-orange-500/5 to-pink-500/5 p-5 transition hover:border-orange-500/20 hover:from-orange-500/10 hover:to-pink-500/10 group"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-2xs font-bold text-orange-400 uppercase tracking-wider">
            <Icon name="Lightbulb" size={11} /> Did You Know?
          </span>
        </div>
        <p className="text-sm sm:text-base leading-relaxed text-zinc-300 group-hover:text-white transition">
          {fact.intro || fact.title}
        </p>
        <p className="text-3xs text-zinc-600 mt-2">
          {fact.author_display_name && `— ${fact.author_display_name}`}
        </p>
      </Link>
    </section>
  );
}
