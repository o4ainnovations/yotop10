'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { formatDate } from '@/lib/dates';

export default function AdminUserDetailClient() {
  const params = useParams();
  const router = useRouter();
  const username = typeof params.username === 'string' ? params.username : '';

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [rateLimitPosts, setRateLimitPosts] = useState('');
  const [rateLimitComments, setRateLimitComments] = useState('');
  const [trustScore, setTrustScore] = useState('');
  const [trustLocked, setTrustLocked] = useState(false);
  const [restrictDate, setRestrictDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    // First find the user_id from the public endpoint, then fetch admin detail
    apiFetch(`/admin/users?q=${encodeURIComponent(username)}&limit=1`)
      .then((data: any) => {
        const found = data.users?.[0];
        if (!found) { setError('User not found'); return; }
        setUser(found);
        setRateLimitPosts(String(found.rate_limit_override?.posts_per_hour ?? ''));
        setRateLimitComments(String(found.rate_limit_override?.comments_per_hour ?? ''));
        setTrustScore(String(found.trust_score ?? ''));
        setTrustLocked(found.trust_locked ?? false);
        setRestrictDate(found.restricted_until ? new Date(found.restricted_until).toISOString().slice(0, 16) : '');
      })
      .catch(() => setError('Failed to load user'))
      .finally(() => setLoading(false));
  }, [username]);

  const handleSaveRateLimits = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/users/${user.user_id}/rate-limits`, {
        method: 'PATCH',
        body: JSON.stringify({
          posts_per_hour: rateLimitPosts ? parseInt(rateLimitPosts) : null,
          comments_per_hour: rateLimitComments ? parseInt(rateLimitComments) : null,
        }),
      });
      alert('Rate limits updated.');
    } catch { alert('Failed to update'); }
    setSaving(false);
  };

  const handleSaveTrust = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/users/${user.user_id}/trust`, {
        method: 'PATCH',
        body: JSON.stringify({
          trust_score: trustScore ? parseFloat(trustScore) : undefined,
          trust_locked: trustLocked,
        }),
      });
      alert('Trust score updated.');
    } catch { alert('Failed to update'); }
    setSaving(false);
  };

  const handleSaveRestrict = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/users/${user.user_id}/restrict`, {
        method: 'PATCH',
        body: JSON.stringify({
          restricted_until: restrictDate ? new Date(restrictDate).toISOString() : null,
        }),
      });
      alert('Restriction updated.');
    } catch { alert('Failed to update'); }
    setSaving(false);
  };

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Loading...</div>;
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{error}</div>;
  if (!user) return null;

  const displayName = user.custom_display_name || user.username;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.push('/admin/users')} className="text-xs text-orange-400 hover:text-orange-300 transition mb-4 flex items-center gap-1">
        <Icon name="ArrowLeft" size={14} /> Back to Users
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-red-600/20 text-xl font-bold text-zinc-400">
          {(displayName || '?')[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{displayName}</h1>
          <p className="text-xs text-zinc-500 font-mono">
            @{user.username} {user.custom_display_name && <span className="text-zinc-700">(ID: {user.user_id})</span>}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stats row */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div><p className="text-lg font-bold font-mono text-white">{user.post_count ?? 0}</p><p className="text-zinc-500">Posts</p></div>
            <div><p className="text-lg font-bold font-mono text-white">{user.comment_count ?? 0}</p><p className="text-zinc-500">Comments</p></div>
            <div><p className="text-lg font-bold font-mono text-green-400">{user.posts_approved ?? 0}</p><p className="text-zinc-500">Approved</p></div>
            <div><p className="text-lg font-bold font-mono text-red-400">{user.posts_rejected ?? 0}</p><p className="text-zinc-500">Rejected</p></div>
          </div>
        </div>

        {/* Trust Score */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Trust Score</h2>
          <div className="flex items-center gap-3 mb-3">
            <input type="number" step="0.01" min="0.1" max="2.0" value={trustScore} onChange={e => setTrustScore(e.target.value)}
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white text-center font-mono focus:border-orange-500/50 focus:outline-none" />
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input type="checkbox" checked={trustLocked} onChange={e => setTrustLocked(e.target.checked)} className="accent-orange-500" />
              Locked (admin override)
            </label>
            <button onClick={handleSaveTrust} disabled={saving} className="ml-auto rounded-lg bg-orange-500/20 text-orange-400 px-4 py-2 text-xs font-semibold hover:bg-orange-500/30 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <p className="text-2xs text-zinc-600">Current level: <span className="font-semibold text-zinc-400 capitalize">{user.trust_level || 'neutral'}</span></p>
        </div>

        {/* Rate Limits */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Rate Limit Override</h2>
          <div className="flex items-center gap-3 mb-3">
            <div><label className="text-2xs text-zinc-600 block mb-1">Posts/hr</label>
              <input type="number" min="0" max="100" value={rateLimitPosts} onChange={e => setRateLimitPosts(e.target.value)} placeholder="Default"
                className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white text-center font-mono focus:border-orange-500/50 focus:outline-none" />
            </div>
            <div><label className="text-2xs text-zinc-600 block mb-1">Comments/hr</label>
              <input type="number" min="0" max="100" value={rateLimitComments} onChange={e => setRateLimitComments(e.target.value)} placeholder="Default"
                className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white text-center font-mono focus:border-orange-500/50 focus:outline-none" />
            </div>
            <button onClick={handleSaveRateLimits} disabled={saving} className="ml-auto rounded-lg bg-orange-500/20 text-orange-400 px-4 py-2 text-xs font-semibold hover:bg-orange-500/30 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Restriction */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Restriction</h2>
          <div className="flex items-center gap-3 mb-3">
            <input type="datetime-local" value={restrictDate} onChange={e => setRestrictDate(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white font-mono focus:border-orange-500/50 focus:outline-none" />
            <button onClick={handleSaveRestrict} disabled={saving} className="rounded-lg bg-orange-500/20 text-orange-400 px-4 py-2 text-xs font-semibold hover:bg-orange-500/30 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Set'}
            </button>
          </div>
          <button onClick={async () => { setRestrictDate(''); await handleSaveRestrict(); }}
            className="text-2xs text-red-400 hover:text-red-300 transition">Remove restriction</button>
        </div>

        {/* Info */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Account Info</h2>
          <div className="space-y-1 text-xs text-zinc-500">
            <p><span className="text-zinc-400">Username:</span> <span className="font-mono text-white">{user.username}</span></p>
            <p><span className="text-zinc-400">User ID:</span> <span className="font-mono text-white">{user.user_id}</span></p>
            <p><span className="text-zinc-400">Custom Name:</span> {user.custom_display_name || <span className="text-zinc-600">None</span>}</p>
            <p><span className="text-zinc-400">Joined:</span> {user.created_at ? formatDate(user.created_at) : 'Unknown'}</p>
            <p><span className="text-zinc-400">Restricted until:</span> {user.restricted_until ? formatDate(user.restricted_until) : <span className="text-green-400">Not restricted</span>}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
