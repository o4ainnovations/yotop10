'use client';

import { useState, useCallback } from 'react';
import { Icon } from './icons/Icon';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ShareButtonProps {
  slug: string;
  title: string;
  postId: string;
}

export function buildShareUrl(slug: string, postId: string): string {
  return `https://yotop10.fun/${slug}?utm_source=share&utm_medium=user&utm_campaign=post_${postId}`;
}

export function ShareButton({ slug, title, postId }: ShareButtonProps) {
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pending) return;

      const url = buildShareUrl(slug, postId);
      setPending(true);

      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
      } catch {
        toast.error('Failed to copy link');
      } finally {
        setPending(false);
      }

      try {
        await API.trackShare(slug);
      } catch {
        // Non-critical — share tracking is fire-and-forget
      }
    },
    [slug, postId, pending]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg transition-all duration-200 min-w-11 min-h-11 text-zinc-500 hover:text-zinc-300"
      aria-label={`Share ${title}`}
    >
      <Icon name="Share2" size={16} />
    </button>
  );
}
