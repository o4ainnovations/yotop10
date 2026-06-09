'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icons/Icon';
import { BookmarkButton } from './BookmarkButton';
import { ShareButton } from './ShareButton';
import { relativeTime } from '@/lib/dates';
interface ListItem {
  id: string;
  rank: number;
  title: string;
  justification: string;
  image_url?: string;
  source_url?: string;
}

interface ThisVsThatViewProps {
  slug: string;
  post: {
    id: string;
    title: string;
    intro: string;
    category_slug: string;
    category_name?: string;
    author_username: string;
    author_display_name: string;
    view_count: number;
    comment_count: number;
    created_at: string;
    format?: string;
    hero_image_url?: string | null;
  };
  items: ListItem[];
}

export function ThisVsThatView({ slug, post, items }: ThisVsThatViewProps) {
  const sideA = items.find(i => i.rank === 1);
  const sideB = items.find(i => i.rank === 2);

  const [votes, setVotes] = useState<Record<string, number>>({});
  const [userVote, setUserVote] = useState<string | null>(null);

  const handleVote = useCallback((side: string) => {
    if (userVote === side) {
      setUserVote(null);
      setVotes(prev => ({ ...prev, [side]: (prev[side] || 3) - 1 }));
    } else {
      if (userVote) {
        setVotes(prev => ({ ...prev, [userVote]: Math.max(0, (prev[userVote] || 3) - 1) }));
      }
      setUserVote(side);
      setVotes(prev => ({ ...prev, [side]: (prev[side] || 3) + 1 }));
    }
  }, [userVote]);

  const totalVotes = Math.max(1, Object.values(votes).reduce((a, b) => a + b, 0));
  const voteA = votes['A'] || 3;
  const voteB = votes['B'] || 3;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 sm:pb-16">
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mb-3">
          <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-2xs font-bold text-red-400 uppercase tracking-wider">
            This vs That
          </span>
          <Link href={`/c/${post.category_slug}`} className="hover:text-orange-400 transition">
            {post.category_name || post.category_slug}
          </Link>
          <span suppressHydrationWarning>{relativeTime(post.created_at)}</span>
        </div>

        <h1 className="text-2xl font-bold leading-tight text-white mb-3 sm:text-3xl sm:leading-tight">
          {post.title}
        </h1>

        <p className="text-sm leading-relaxed text-zinc-400 sm:text-base sm:leading-relaxed">
          {post.intro}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-white/5">
          <span className="text-sm text-zinc-400">
            By{' '}
            <Link href={`/a/${post.author_username.replace(/^a_/, '')}`} className="font-semibold text-orange-400 hover:text-orange-300 transition">
              {post.author_display_name}
            </Link>
            <span className="ml-3 text-xs text-zinc-600">{post.view_count} views</span>
          </span>
          <div className="flex items-center gap-3">
            <BookmarkButton postId={post.id} />
            <ShareButton slug={slug} title={post.title} postId={post.id} />
          </div>
        </div>
      </header>

      {/* VS Battle Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Side A */}
        <div className={`rounded-2xl border-2 p-5 sm:p-6 transition-all duration-300 ${
          userVote === 'A' 
            ? 'border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/10' 
            : 'border-white/5 bg-white/5 hover:border-white/10'
        }`}>
          {sideA?.image_url && (
            <div className="mb-4 overflow-hidden rounded-xl border border-white/5">
              <Image src={sideA.image_url} alt={sideA.title} width={600} height={400} className="w-full object-cover" unoptimized />
            </div>
          )}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white font-bold text-lg mb-3">
              A
            </div>
            <h2 className="text-xl font-bold text-white">{sideA?.title || 'Side A'}</h2>
          </div>
          <p className="text-sm leading-relaxed text-zinc-400 mb-5 text-center">
            {sideA?.justification || ''}
          </p>
          {sideA?.source_url && (
            <a href={sideA.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition">
              <Icon name="ExternalLink" size={11} /> Source
            </a>
          )}
          <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/5">
            <button
              onClick={() => handleVote('A')}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                userVote === 'A'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg'
                  : 'border border-white/10 text-zinc-400 hover:border-orange-500/30 hover:text-orange-400'
              }`}
            >
              <Icon name={userVote === 'A' ? 'ThumbsUp' : 'ArrowUp'} size={16} />
              {userVote === 'A' ? 'Voted' : 'Vote'}
            </button>
            <span className="text-sm font-mono text-zinc-500 flex items-center gap-1">
              <Icon name="Flame" size={14} className="text-orange-500" />
              {Math.round((voteA / totalVotes) * 100)}%
            </span>
          </div>
        </div>

        {/* VS Divider (mobile) */}
        <div className="flex items-center justify-center sm:hidden -my-2">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-sm shadow-lg">
            VS
          </span>
        </div>

        {/* Side B */}
        <div className={`rounded-2xl border-2 p-5 sm:p-6 transition-all duration-300 ${
          userVote === 'B' 
            ? 'border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/10' 
            : 'border-white/5 bg-white/5 hover:border-white/10'
        }`}>
          {sideB?.image_url && (
            <div className="mb-4 overflow-hidden rounded-xl border border-white/5">
              <Image src={sideB.image_url} alt={sideB.title} width={600} height={400} className="w-full object-cover" unoptimized />
            </div>
          )}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg mb-3">
              B
            </div>
            <h2 className="text-xl font-bold text-white">{sideB?.title || 'Side B'}</h2>
          </div>
          <p className="text-sm leading-relaxed text-zinc-400 mb-5 text-center">
            {sideB?.justification || ''}
          </p>
          {sideB?.source_url && (
            <a href={sideB.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition">
              <Icon name="ExternalLink" size={11} /> Source
            </a>
          )}
          <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/5">
            <button
              onClick={() => handleVote('B')}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                userVote === 'B'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg'
                  : 'border border-white/10 text-zinc-400 hover:border-orange-500/30 hover:text-orange-400'
              }`}
            >
              <Icon name={userVote === 'B' ? 'ThumbsUp' : 'ArrowUp'} size={16} />
              {userVote === 'B' ? 'Voted' : 'Vote'}
            </button>
            <span className="text-sm font-mono text-zinc-500 flex items-center gap-1">
              <Icon name="Flame" size={14} className="text-blue-500" />
              {Math.round((voteB / totalVotes) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* VS Divider (desktop) */}
      <div className="hidden sm:flex items-center justify-center -mt-6 mb-8">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold shadow-lg">
          VS
        </span>
      </div>

      {/* Debate info bar */}
      <div className="rounded-xl border border-white/5 bg-white/5 p-4 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="MessageCircle" size={15} />
            {post.comment_count} comments — pick a side when you join
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="Users" size={15} />
            {totalVotes} votes cast
          </span>
        </div>
      </div>
    </main>
  );
}
