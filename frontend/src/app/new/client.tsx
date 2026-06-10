'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon, type LucideIconName } from '@/components/icons/Icon';

interface PostTypeCard {
  type: string;
  name: string;
  description: string;
  icon: LucideIconName;
  color: string;
  borderClass: string;
  bgClass: string;
}

const TYPES: PostTypeCard[] = [
  {
    type: 'top_list',
    name: 'Ranked List',
    description: 'Classic top 10 format with ranked items',
    icon: 'ListOrdered',
    color: 'orange',
    borderClass: 'border-orange-500/30 hover:border-orange-500/50',
    bgClass: 'from-orange-500/10 to-orange-600/5',
  },
  {
    type: 'this_vs_that',
    name: 'This vs That',
    description: 'Two sides head-to-head, community votes',
    icon: 'Swords',
    color: 'purple',
    borderClass: 'border-purple-500/30 hover:border-purple-500/50',
    bgClass: 'from-purple-500/10 to-purple-600/5',
  },
  {
    type: 'fact_drop',
    name: 'Fact Drop',
    description: 'Share a surprising fact with a source',
    icon: 'Lightbulb',
    color: 'pink',
    borderClass: 'border-pink-500/30 hover:border-pink-500/50',
    bgClass: 'from-pink-500/10 to-pink-600/5',
  },
  {
    type: 'best_of',
    name: 'Best Of',
    description: 'Curate the best picks in a category',
    icon: 'Award',
    color: 'emerald',
    borderClass: 'border-emerald-500/30 hover:border-emerald-500/50',
    bgClass: 'from-emerald-500/10 to-emerald-600/5',
  },
  {
    type: 'worst_of',
    name: 'Worst Of',
    description: 'Call out the worst offenders',
    icon: 'ThumbsDown',
    color: 'red',
    borderClass: 'border-red-500/30 hover:border-red-500/50',
    bgClass: 'from-red-500/10 to-red-600/5',
  },
];

const COLOR_MAP: Record<string, string> = {
  orange: 'text-orange-400',
  purple: 'text-purple-400',
  pink: 'text-pink-400',
  emerald: 'text-emerald-400',
  red: 'text-red-400',
};

export default function NewPostClient() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-orange-400 hover:text-orange-300 transition">
          &larr; Back to Home
        </Link>
      </nav>

      <h1 className="text-2xl font-bold text-white mb-2 sm:text-3xl">Create New Post</h1>
      <p className="text-sm text-zinc-500 mb-8">Choose a format to get started. No account required.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TYPES.map(t => (
          <button
            key={t.type}
            onClick={() => router.push(`/submit?type=${t.type}`)}
            className={`rounded-2xl border bg-gradient-to-br ${t.borderClass} ${t.bgClass} p-5 text-left transition hover:shadow-lg hover:shadow-${t.color}-500/5 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500`}
          >
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ${COLOR_MAP[t.color]}`}>
              <Icon name={t.icon} size={20} />
            </div>
            <h3 className={`text-sm font-bold text-white mb-1 ${COLOR_MAP[t.color]}`}>{t.name}</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">{t.description}</p>
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-3xs text-zinc-700">
        All posts are anonymous. Your device fingerprint acts as your identity.
      </p>
    </div>
  );
}
