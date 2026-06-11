'use client';

import { useState, useCallback } from 'react';
import { Icon } from './icons/Icon';
import { ShareModal } from './ShareModal';
import { API } from '@/lib/api';

interface ShareButtonProps {
  slug: string;
  title: string;
  postId: string;
}

export function buildShareUrl(slug: string, postId: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://yotop10.com';
  return `${baseUrl}/${slug}?utm_source=share&utm_medium=user&utm_campaign=post_${postId}`;
}

export function ShareButton({ slug, title, postId }: ShareButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pending) return;
      setPending(true);
      setModalOpen(true);
      setPending(false);
      try { await API.trackShare(slug); } catch { /* non-critical */ }
    },
    [slug, pending]
  );

  const url = buildShareUrl(slug, postId);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg transition-all duration-200 min-w-11 min-h-11 text-zinc-500 hover:text-zinc-300"
        aria-label={`Share ${title}`}
      >
        <Icon name="Share2" size={16} />
      </button>
      <ShareModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        url={url}
        title={title}
        slug={slug}
      />
    </>
  );
}
