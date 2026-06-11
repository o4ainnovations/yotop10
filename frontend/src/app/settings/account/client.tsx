'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { SecureMyAuthority } from '@/components/SecureMyAuthority';
import { API } from '@/lib/api';

export default function AccountSettingsClient() {
  const router = useRouter();
  const authUser = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const fetchAuthUser = useAuthStore(s => s.fetchUser);

  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(authUser?.custom_display_name || '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleUpdateName = async () => {
    if (!newDisplayName.trim()) return;
    try {
      await API.updateDisplayName(newDisplayName);
      await fetchAuthUser();
      setEditingName(false);
      setNameError(null);
    } catch {
      setNameError('Failed to update display name.');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 min-h-[calc(100vh-56px)]">
      <nav className="mb-6">
        <Link href="/settings" className="text-sm text-orange-400 hover:text-orange-300 transition">
          &larr; Back to Settings
        </Link>
      </nav>

      <h1 className="text-2xl font-bold text-white mb-8">Account Settings</h1>

      <div className="space-y-6">
        {/* Display Name */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-5 py-5">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Display Name</h2>
          {editingName ? (
            <div className="space-y-3">
              {nameError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{nameError}</div>
              )}
              <input
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                placeholder={authUser?.username || 'display name'}
                maxLength={32}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={handleUpdateName} className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl">
                  Save
                </button>
                <button onClick={() => setEditingName(false)} className="rounded-xl border border-white/10 bg-transparent px-5 py-2.5 text-xs font-medium text-zinc-400 transition hover:text-orange-400">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{authUser?.custom_display_name || authUser?.username || 'Anonymous'}</p>
                <p className="text-2xs text-zinc-600 mt-0.5">Shown on your posts and comments</p>
              </div>
              <button onClick={() => setEditingName(true)} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-400 transition hover:text-orange-400">
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02] px-5 py-5">
          <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Logout</h2>
          <p className="text-2xs text-zinc-600 mb-4">
            Clears your session and generates a new anonymous identity. Your existing posts and comments remain linked to your current identity.
          </p>
          {confirmLogout ? (
            <div className="flex items-center gap-3">
              <button onClick={handleLogout} className="rounded-xl bg-red-500 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-red-600">
                Confirm Logout
              </button>
              <button onClick={() => setConfirmLogout(false)} className="rounded-xl border border-white/10 bg-transparent px-5 py-2.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-200">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmLogout(true)} className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20">
              Logout &amp; Reset Identity
            </button>
          )}
        </div>

        {/* Transfer Identity */}
        <div className="rounded-xl border border-orange-500/10 bg-orange-500/[0.02] px-5 py-5">
          <h2 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">Transfer Identity</h2>
          <p className="text-2xs text-zinc-600 mb-4">
            Generate a seed phrase to transfer your identity to another device or browser.
          </p>
          <SecureMyAuthority />
        </div>

        {/* Recover Identity — always visible */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-5 py-5">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Recover Identity</h2>
          <p className="text-2xs text-zinc-600 mb-4">
            Already have a 12-word seed phrase? Use it to recover your identity on this device. All your posts, comments, and reputation will be restored.
          </p>
          <Link
            href="/claim"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl active:scale-[0.98]"
          >
            Recover Identity &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
