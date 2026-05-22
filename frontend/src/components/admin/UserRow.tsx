'use client';

import { Icon } from '@/components/icons/Icon';
import { formatDate } from '@/lib/dates';
import type { UserSummary } from '@/lib/api/types';

interface UserRowProps {
  user: UserSummary;
  isMobile?: boolean;
  onAction: (user: UserSummary, action: 'trust' | 'rate' | 'restrict') => void;
  onClickRow: (user: UserSummary) => void;
}

export function UserRow({ user, isMobile, onAction, onClickRow }: UserRowProps) {
  const tierBadge = () => {
    if (user.trust_tier === 'scholar') {
      return <span className="bg-green-500/15 text-green-400 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider">Scholar</span>;
    }
    if (user.trust_tier === 'troll') {
      return <span className="bg-red-500/15 text-red-400 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider">Troll</span>;
    }
    return <span className="bg-white/10 text-white/50 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider">Neutral</span>;
  };

  const initial = (user.display_name || user.username || '?')[0].toUpperCase();

  if (isMobile) {
    return (
      <div
        onClick={() => onClickRow(user)}
        className={`bg-white/5 border border-white/10 rounded-xl p-3 cursor-pointer transition-colors hover:border-white/20 ${user.restricted ? 'border-red-500/30' : ''}`}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <span className="text-white text-sm font-semibold block truncate">{user.display_name}</span>
            <span className="text-zinc-500 text-3xs font-mono">{user.username}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {user.restricted && <Icon name="TriangleAlert" size={14} color="#f87171" />}
            {user.trust_locked && <Icon name="Lock" size={12} color="#a1a1aa" />}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-3xs text-white/50">
          <span className="flex items-center gap-1">
            <span className="text-white/70 font-semibold">{user.trust_score.toFixed(2)}</span>
            {tierBadge()}
          </span>
          <span><Icon name="FileText" size={11} /> {user.post_count}</span>
          <span><Icon name="MessageCircle" size={11} /> {user.comment_count}</span>
          <span suppressHydrationWarning>{formatDate(user.created_at)}</span>
        </div>
        <div className="flex gap-1 flex-wrap mt-2">
          <button onClick={e => { e.stopPropagation(); onAction(user, 'trust'); }} className="text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white">
            Edit Trust
          </button>
          <button onClick={e => { e.stopPropagation(); onAction(user, 'rate'); }} className="text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white">
            Override Rate
          </button>
          <button onClick={e => { e.stopPropagation(); onAction(user, 'restrict'); }} className="text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-orange-400">
            Restrict
          </button>
        </div>
      </div>
    );
  }

  return (
    <tr
      onClick={() => onClickRow(user)}
      className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${user.restricted ? 'bg-red-500/[0.04]' : ''}`}
    >
      <td className="p-1.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-2xs font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <span className="text-white text-sm2 font-semibold block truncate">{user.display_name}</span>
            <span className="text-zinc-600 text-2xs font-mono">{user.username}</span>
          </div>
        </div>
      </td>
      <td className="p-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-white/80 font-mono text-xs">{user.trust_score.toFixed(2)}</span>
          {tierBadge()}
        </div>
      </td>
      <td className="p-1.5">
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-3xs font-mono tabular-nums">{user.post_count}</span>
          <span className="text-zinc-600 text-3xs font-mono tabular-nums">{user.comment_count}</span>
        </div>
      </td>
      <td className="p-1.5">
        <span className="text-white/50 text-3xs font-mono tabular-nums">
          {user.effective_rate_limit_posts}/{user.effective_rate_limit_comments}
        </span>
      </td>
      <td className="p-1.5 text-center">
        {user.restricted && <Icon name="TriangleAlert" size={14} color="#f87171" />}
        {user.trust_locked && <Icon name="Lock" size={12} color="#a1a1aa" />}
      </td>
      <td className="p-1.5 text-right">
        <div className="flex gap-1 justify-end">
          <button onClick={e => { e.stopPropagation(); onAction(user, 'trust'); }} className="text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white">
            Edit Trust
          </button>
          <button onClick={e => { e.stopPropagation(); onAction(user, 'rate'); }} className="text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white">
            Override Rate
          </button>
          <button onClick={e => { e.stopPropagation(); onAction(user, 'restrict'); }} className="text-3xs cursor-pointer px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-orange-400">
            Restrict
          </button>
        </div>
      </td>
    </tr>
  );
}
