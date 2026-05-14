'use client';

import Link from 'next/link';

const CATS = [
  'movies','music','food','gaming','books','technology','sports','television','business','lifestyle'
];

export function CategoryBar({ active }: { active?: string }) {
  return (
    <div className="flex gap-0 overflow-x-auto border-b border-white/5">
      <Link
        href="/"
        className={`px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider transition ${
          !active
            ? 'border-b-2 border-orange-500 text-white'
            : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-300'
        }`}
      >
        All
      </Link>
      {CATS.map((cat) => (
        <Link
          key={cat}
          href={`/c/${cat}`}
          className={`px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wider transition ${
            active === cat
              ? 'border-b-2 border-orange-500 text-white'
              : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {cat}
        </Link>
      ))}
    </div>
  );
}
