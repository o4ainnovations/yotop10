'use client';

import { useState, useCallback } from 'react';
import { Icon } from './icons/Icon';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';

interface BookmarkButtonProps {
  postId: string;
  initialBookmarked?: boolean;
}

export function BookmarkButton({ postId, initialBookmarked = false }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pending) return;

      const wasBookmarked = bookmarked;
      setBookmarked(!wasBookmarked);
      setPending(true);

      try {
        if (wasBookmarked) {
          await API.unsave(postId);
          toast.info('Removed from Bookmarks');
        } else {
          await API.save(postId);
          toast.success('Saved to Bookmarks');
        }
      } catch {
        setBookmarked(wasBookmarked);
        toast.error('Something went wrong. Please try again.');
      } finally {
        setPending(false);
      }
    },
    [postId, bookmarked, pending]
  );

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] ${
        bookmarked
          ? 'text-orange-400 hover:text-orange-300'
          : 'text-zinc-500 hover:text-zinc-300'
      }`}
      aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this post'}
    >
      <Icon
        name="Bookmark"
        size={16}
        fill={bookmarked ? 'currentColor' : 'none'}
      />
    </button>
  );
}
