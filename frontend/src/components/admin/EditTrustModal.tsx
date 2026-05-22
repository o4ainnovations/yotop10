'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/icons/Icon';
import type { UserSummary } from '@/lib/api/types';

interface EditTrustModalProps {
  user: UserSummary;
  onClose: () => void;
  onSave: (userId: string, data: { score: number; lock: boolean; reason: string }) => Promise<void>;
}

export function EditTrustModal({ user, onClose, onSave }: EditTrustModalProps) {
  const [score, setScore] = useState(user.trust_score);
  const [locked, setLocked] = useState(user.trust_locked);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const tierPreview = () => {
    if (score >= 1.5) return { label: 'Scholar', color: 'text-green-400' };
    if (score < 0.5) return { label: 'Troll', color: 'text-red-400' };
    return { label: 'Neutral', color: 'text-zinc-400' };
  };

  const tp = tierPreview();

  const handleSave = async () => {
    setSaving(true);
    await onSave(user._id, { score: Math.round(score * 100) / 100, lock: locked, reason: reason || 'Admin adjustment' });
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
          <h3 className="text-white font-semibold text-lg">Edit Trust Score</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="mb-4">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">User</span>
          <p className="text-white font-mono text-sm">{user.username}</p>
        </div>

        <div className="mb-4">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">Current Trust</span>
          <p className="text-white text-2xl font-bold font-mono">{user.trust_score.toFixed(2)}</p>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-xs uppercase tracking-wider">New Score</span>
            <span className="text-white font-mono font-bold text-lg">{score.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.01"
            value={score}
            onChange={e => setScore(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-orange-500 [&::-webkit-slider-thumb]:to-red-600 [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-2xs text-zinc-600 mt-1">
            <span>0.10</span><span>1.00</span><span>2.00</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
          <span className="text-xs text-zinc-500">Preview:</span>
          <span className={`ml-2 text-sm font-semibold ${tp.color}`}>
            This will make them a {tp.label}
          </span>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={locked}
              onChange={e => setLocked(e.target.checked)}
              className="w-4 h-4 rounded bg-white/10 border-white/20 cursor-pointer accent-orange-500"
            />
            <span className="text-white text-sm">Lock trust score</span>
          </label>
          <p className="text-zinc-600 text-3xs mt-1 ml-6">Prevents automated trust adjustments</p>
        </div>

        <div className="mb-5">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">Reason (optional)</span>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g., identified troll behavior"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none mt-1 placeholder:text-zinc-600"
          />
        </div>

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
