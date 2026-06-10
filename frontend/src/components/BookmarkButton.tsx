'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from './icons/Icon';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';

interface BookmarkButtonProps {
  postId: string;
  initialBookmarked?: boolean;
}

export function BookmarkButton({ postId, initialBookmarked }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked ?? false);
  const [pending, setPending] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (initialBookmarked !== undefined) {
      setBookmarked(initialBookmarked);
      setFetched(true);
      return;
    }
    let cancelled = false;
    API.checkBookmark(postId)
      .then(res => { if (!cancelled) { setBookmarked(res.bookmarked); setFetched(true); } })
      .catch(() => { if (!cancelled) setFetched(true); });
    return () => { cancelled = true; };
  }, [postId, initialBookmarked]);

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
      disabled={pending || !fetched}
      className={`inline-flex items-center justify-center rounded-lg transition-all duration-200 min-w-11 min-h-11 ${
        bookmarked
          ? 'text-orange-400 hover:text-orange-300'
          : 'text-zinc-500 hover:text-zinc-300'
      } ${!fetched ? 'opacity-30' : ''}`}
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
