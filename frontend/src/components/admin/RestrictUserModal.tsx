'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/icons/Icon';
import type { UserSummary } from '@/lib/api/types';

interface RestrictUserModalProps {
  user: UserSummary;
  onClose: () => void;
  onSave: (userId: string, data: { restrict: boolean; until: string | null }) => Promise<void>;
}

export function RestrictUserModal({ user, onClose, onSave }: RestrictUserModalProps) {
  const [indefinite, setIndefinite] = useState(user.restricted);
  const [until, setUntil] = useState(user.restricted_until ? user.restricted_until.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleApply = async () => {
    setSaving(true);
    const restrictionUntil = indefinite ? null : (until || null);
    await onSave(user._id, { restrict: true, until: restrictionUntil });
    setSaving(false);
    onClose();
  };

  const handleRemove = async () => {
    setSaving(true);
    await onSave(user._id, { restrict: false, until: null });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">Restrict User</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="mb-3">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">User</span>
          <p className="text-white font-mono text-sm">{user.username}</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
          <span className="text-zinc-500 text-xs">Current Status:</span>
          <span className={`ml-2 text-sm font-semibold ${user.restricted ? 'text-red-400' : 'text-green-400'}`}>
            {user.restricted ? 'Restricted' : 'Active'}
          </span>
          {user.restricted && user.restricted_until && (
            <p className="text-zinc-500 text-3xs mt-1">
              Until: <span className="text-white/70 font-mono">{new Date(user.restricted_until).toLocaleString()}</span>
            </p>
          )}
        </div>

        {user.restricted && (
          <button
            onClick={handleRemove}
            disabled={saving}
            className="w-full mb-4 px-4 py-2.5 cursor-pointer bg-green-600/20 border border-green-500/20 rounded-xl text-green-400 text-sm font-semibold disabled:opacity-50"
          >
            Remove restriction
          </button>
        )}

        <div className="mb-4">
          <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1.5">Restrict until</label>
          <input
            type="date"
            value={until}
            onChange={e => setUntil(e.target.value)}
            disabled={indefinite}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none disabled:opacity-30"
          />
        </div>

        <div className="mb-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={indefinite}
              onChange={e => setIndefinite(e.target.checked)}
              className="w-4 h-4 rounded bg-white/10 border-white/20 cursor-pointer accent-orange-500"
            />
            <span className="text-white text-sm">Restrict indefinitely</span>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApply}
            disabled={saving || (!until && !indefinite)}
            className="flex-1 px-4 py-2.5 cursor-pointer bg-gradient-to-r from-orange-500 to-red-600 text-white border-none rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply Restriction'}
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
