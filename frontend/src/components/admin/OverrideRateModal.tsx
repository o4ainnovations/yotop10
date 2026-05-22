'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/icons/Icon';
import type { UserSummary } from '@/lib/api/types';

interface OverrideRateModalProps {
  user: UserSummary;
  onClose: () => void;
  onSave: (userId: string, data: { posts_per_hour: number | null; comments_per_hour: number | null }) => Promise<void>;
}

export function OverrideRateModal({ user, onClose, onSave }: OverrideRateModalProps) {
  const [postsPerHour, setPostsPerHour] = useState(user.effective_rate_limit_posts);
  const [commentsPerHour, setCommentsPerHour] = useState(user.effective_rate_limit_comments);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(user._id, { posts_per_hour: postsPerHour, comments_per_hour: commentsPerHour });
    setSaving(false);
    onClose();
  };

  const handleReset = () => {
    setPostsPerHour(0);
    setCommentsPerHour(0);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">Override Rate Limits</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="mb-3">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">User</span>
          <p className="text-white font-mono text-sm">{user.username}</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-500 text-xs">Current Effective Rate</span>
          </div>
          <div className="flex gap-4 text-sm2">
            <span className="text-white/70">Posts: <span className="text-white font-mono">{user.effective_rate_limit_posts}/h</span></span>
            <span className="text-white/70">Comments: <span className="text-white font-mono">{user.effective_rate_limit_comments}/h</span></span>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1.5">Posts per hour</label>
          <input
            type="number"
            min={0}
            value={postsPerHour}
            onChange={e => setPostsPerHour(parseInt(e.target.value) || 0)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none font-mono"
          />
        </div>

        <div className="mb-4">
          <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1.5">Comments per hour</label>
          <input
            type="number"
            min={0}
            value={commentsPerHour}
            onChange={e => setCommentsPerHour(parseInt(e.target.value) || 0)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none font-mono"
          />
        </div>

        <button
          onClick={handleReset}
          className="w-full mb-5 px-4 py-2 cursor-pointer bg-white/5 border border-white/10 rounded-xl text-white/60 text-sm hover:text-white transition-colors"
        >
          Reset to tier defaults
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 cursor-pointer bg-gradient-to-r from-orange-500 to-red-600 text-white border-none rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 cursor-pointer bg-white/5 border border-white/10 rounded-xl text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
