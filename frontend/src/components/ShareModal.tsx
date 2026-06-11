'use client';

import { useState } from 'react';
import { Icon } from './icons/Icon';
import { API } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  slug: string;
}

const SOCIALS = [
  {
    name: 'Twitter / X',
    icon: 'MessageCircle' as const,
    color: 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30',
    getUrl: (u: string, t: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`,
  },
  {
    name: 'Facebook',
    icon: 'ThumbsUp' as const,
    color: 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30',
    getUrl: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
  },
  {
    name: 'Reddit',
    icon: 'MessageCircle' as const,
    color: 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30',
    getUrl: (u: string, t: string) => `https://reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`,
  },
  {
    name: 'Telegram',
    icon: 'Send' as const,
    color: 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30',
    getUrl: (u: string, t: string) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    name: 'WhatsApp',
    icon: 'MessageCircle' as const,
    color: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
    getUrl: (u: string, t: string) => `https://wa.me/?text=${encodeURIComponent(t + ' ' + u)}`,
  },
];

export function ShareModal({ open, onClose, url, title, slug }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  if (!open) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
    API.trackShare(slug).catch(() => {});
  };

  const embedHtml = `<a href="${url}">${title}</a>`;

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedHtml);
      setEmbedCopied(true);
      toast.success('Embed code copied!');
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch {
      toast.error('Failed to copy embed');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--color-bg)] shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-white">Share</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition" aria-label="Close">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Link copy */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex-1 truncate rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400 font-mono">
            {url}
          </div>
          <button
            onClick={handleCopyLink}
            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition ${copied ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'}`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Social grid */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {SOCIALS.map(s => (
            <a
              key={s.name}
              href={s.getUrl(url, title)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 transition ${s.color}`}
              aria-label={`Share on ${s.name}`}
            >
              <Icon name={s.icon} size={18} />
              <span className="text-3xs font-medium truncate w-full text-center">{s.name.split(' ')[0]}</span>
            </a>
          ))}
        </div>

        {/* Embed */}
        <button
          onClick={handleCopyEmbed}
          className={`w-full rounded-lg border px-3 py-2 text-xs font-medium transition flex items-center gap-2 justify-center ${embedCopied ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-white/10 text-zinc-400 hover:bg-white/5'}`}
        >
          <Icon name="Code" size={14} />
          {embedCopied ? 'Embed code copied!' : 'Copy embed code'}
        </button>
      </div>
    </div>
  );
}
