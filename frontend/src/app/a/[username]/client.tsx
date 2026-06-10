'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { API } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { Icon } from '@/components/icons/Icon';
import { useAuthStore } from '@/stores/auth';
import { useRateLimitStore } from '@/stores/rateLimit';
import { SecureMyAuthority } from '@/components/SecureMyAuthority';

interface UserProfile {
  username: string;
  canonical_url?: string;
  profile_image_url?: string | null;
  trust_level: 'troll' | 'neutral' | 'scholar';
  created_at: string;
  stats: {
    member_since: string;
    total_posts: number;
    total_comments: number;
    approval_rate: number;
    total_views?: number;
  };
  posts: Array<{
    id: string; title: string; slug: string; status: string; post_type: string;
    view_count?: number; comment_count: number; created_at: string;
    category: { name?: string; slug: string } | null;
    revision_guidance?: string; rejection_reason?: string;
  }>;
  comments: Array<{ id: string; content: string; post_id: string; fire_count: number; reply_count: number; created_at: string }>;
  is_own_profile: boolean;
  trust_score?: number;
}

const POST_TYPE_LABELS: Record<string, string> = {
  top_list: 'Top List', this_vs_that: 'Debate', fact_drop: 'Fact Drop',
  best_of: 'Best Of', worst_of: 'Worst Of', counter_list: 'Counter',
};

const TIERS = [
  { min: 6, label: 'Scholar', color: 'text-amber-400', bar: 'bg-amber-500', icon: 'ShieldCheck' as const },
  { min: 3, label: 'Neutral', color: 'text-zinc-400', bar: 'bg-zinc-500', icon: 'Minus' as const },
  { min: 0, label: 'Troll', color: 'text-red-400', bar: 'bg-red-500', icon: 'TriangleAlert' as const },
];

function getTier(score: number) {
  return TIERS.find(t => score >= t.min) || TIERS[2];
}

export default function UserProfileClient({ initialProfile }: { initialProfile: UserProfile }) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'stats'>('posts');
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const fetchAuthUser = useAuthStore((s) => s.fetchUser);
  const rateLimitStatus = useRateLimitStore((s) => s.status);
  const rateLimitCountdown = useRateLimitStore((s) => s.countdown);
  const fetchRateStatus = useRateLimitStore((s) => s.fetchStatus);
  const tickCountdown = useRateLimitStore((s) => s.tickCountdown);
  const rateLimitErrorCount = useRateLimitStore((s) => s.errorCount);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const trustScore = profile.is_own_profile && authUser ? authUser.trust_score : profile.trust_score ?? 0;
  const tier = getTier(trustScore);
  const trustPct = Math.min(100, (trustScore / 10) * 100);

  useEffect(() => {
    if (profile.is_own_profile && activeTab === 'stats' && rateLimitErrorCount > 0) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(fetchRateStatus, Math.min(1000 * Math.pow(2, rateLimitErrorCount), 10000));
    }
  }, [profile.is_own_profile, activeTab, rateLimitErrorCount, fetchRateStatus]);
  useEffect(() => {
    if (profile.is_own_profile && activeTab === 'stats') fetchRateStatus();
  }, [profile.is_own_profile, activeTab, fetchRateStatus]);
  useEffect(() => {
    if (!rateLimitStatus || activeTab !== 'stats') return;
    const interval = setInterval(tickCountdown, 1000);
    return () => clearInterval(interval);
  }, [rateLimitStatus, activeTab, tickCountdown]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && activeTab === 'stats') fetchRateStatus(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); clearTimeout(retryTimeoutRef.current); };
  }, [activeTab, fetchRateStatus]);

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) return;
    try { await API.updateDisplayName(newDisplayName); await fetchAuthUser(); setEditingName(false); setNewDisplayName(''); setNameError(null); }
    catch { setNameError('Failed to update display name.'); }
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingImage(true); setImageError(null);
    try {
      const uploadRes = await API.uploadProfileImage(file) as { success: boolean; url: string };
      await API.updateProfileImage(uploadRes.url); await fetchAuthUser();
      setProfile(p => p ? { ...p, profile_image_url: uploadRes.url } : p);
    } catch { setImageError('Upload failed.'); } finally { setUploadingImage(false); }
  };

  const initials = (profile.username[0] || '?').toUpperCase();

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-[var(--color-bg)] text-white">
      {/* ─── Profile Header ─── */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/5 bg-white/5 sm:mb-8">
        {/* Cover gradient */}
        <div className={`h-24 sm:h-32 w-full bg-gradient-to-r ${
          tier.label === 'Scholar' ? 'from-amber-600/30 via-amber-800/20 to-zinc-900' :
          tier.label === 'Troll' ? 'from-red-600/20 via-zinc-800/10 to-zinc-900' :
          'from-zinc-600/20 via-zinc-800/10 to-zinc-900'
        }`} />

        <div className="px-4 sm:px-6 pb-5 sm:pb-6">
          {/* Avatar + Trust ring */}
          <div className="relative -mt-10 sm:-mt-14 mb-3 flex items-end gap-4">
            <div className={`relative rounded-full p-0.5 ${tier.label === 'Scholar' ? 'bg-amber-500' : tier.label === 'Troll' ? 'bg-red-500' : 'bg-zinc-500'}`}>
              {profile.profile_image_url ? (
                <Image src={profile.profile_image_url} alt="" width={72} height={72} className="h-18 w-18 sm:h-20 sm:w-20 rounded-full border-2 border-zinc-900 object-cover" />
              ) : (
                <div className="flex h-18 w-18 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-zinc-900 bg-gradient-to-br from-orange-500/20 to-red-600/20 text-2xl font-bold text-zinc-400">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-6 sm:pt-8">
              <h1 className="text-xl font-bold leading-tight sm:text-2xl truncate">{profile.username}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold capitalize ${
                  tier.label === 'Scholar' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  tier.label === 'Troll' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}>
                  <Icon name={tier.icon} size={11} /> {tier.label}
                </span>
                {profile.is_own_profile && (
                  <span className="text-2xs text-zinc-600">{trustScore.toFixed(2)} / 10</span>
                )}
              </div>
            </div>
          </div>

          {/* Trust ring gauge */}
          {profile.is_own_profile && (
            <div className="mb-3">
              <div className="flex h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div className={`transition-all duration-500 ${tier.bar}`} style={{ width: `${trustPct}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-3xs text-zinc-700">
                <span>Troll</span>
                <span>Neutral</span>
                <span>Scholar</span>
              </div>
            </div>
          )}

          {/* Stats pills */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-2xs text-zinc-400">
              <Icon name="FileText" size={12} className="text-zinc-500" /> {profile.stats.total_posts} posts
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-2xs text-zinc-400">
              <Icon name="MessageCircle" size={12} className="text-zinc-500" /> {profile.stats.total_comments}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-2xs text-zinc-400">
              <Icon name="Eye" size={12} className="text-zinc-500" /> {profile.stats.total_views ?? 0}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-2xs text-zinc-400">
              <Icon name="BadgeCheck" size={12} className="text-zinc-500" /> {profile.stats.approval_rate}%
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-2xs text-zinc-500" suppressHydrationWarning>
              <Icon name="Calendar" size={12} /> {formatDate(profile.stats.member_since)}
            </span>
          </div>

          {/* Profile image upload (own only) */}
          {profile.is_own_profile && (
            <div className="mt-3">
              {imageError && <div role="alert" className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-2xs text-red-400">{imageError}</div>}
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-2xs text-zinc-600 hover:text-zinc-400 transition">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileUpload} disabled={uploadingImage} className="hidden" />
                {uploadingImage ? <><Icon name="RefreshCw" size={11} className="animate-spin" /> Uploading...</> : <><Icon name="Camera" size={11} /> Change photo</>}
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ─── Actions (own only) ─── */}
      {profile.is_own_profile && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => setEditingName(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-2xs font-medium text-zinc-300 transition hover:border-orange-500/30 hover:text-orange-400">
            <Icon name="Pencil" size={12} /> Edit Name
          </button>
          <button onClick={() => router.push('/username-history')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-2xs font-medium text-zinc-300 transition hover:border-orange-500/30 hover:text-orange-400">
            <Icon name="Clock" size={12} /> History
          </button>
          {editingName && (
            <div className="w-full mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
              {nameError && <div role="alert" className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-2xs text-red-400">{nameError}</div>}
              <div className="flex items-center gap-2">
                <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="a_newname" maxLength={32}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none" />
                <button onClick={handleUpdateDisplayName} className="rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-xs font-semibold text-white">Save</button>
                <button onClick={() => setEditingName(false)} className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-xs font-medium text-zinc-400 hover:text-orange-400">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="mb-6 flex border-b border-white/5">
        <button onClick={() => setActiveTab('posts')} className={`relative px-4 sm:px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'posts' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Posts ({profile.posts.length})
          {activeTab === 'posts' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
        </button>
        <button onClick={() => setActiveTab('comments')} className={`relative px-4 sm:px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'comments' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Comments ({profile.comments.length})
          {activeTab === 'comments' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
        </button>
        {profile.is_own_profile && (
          <button onClick={() => setActiveTab('stats')} className={`relative px-4 sm:px-5 py-3 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${activeTab === 'stats' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Icon name="ChartBar" size={13} /> Stats
            {activeTab === 'stats' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
          </button>
        )}
      </div>

      {/* ─── Posts Tab ─── */}
      {activeTab === 'posts' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {profile.posts.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <Icon name="FileText" size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500 mb-4">No posts yet.</p>
              {profile.is_own_profile && (
                <Link href="/new" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl active:scale-[0.98]">
                  <Icon name="Plus" size={14} /> Create your first post
                </Link>
              )}
            </div>
          ) : (
            profile.posts.map(post => (
              <Link key={post.id} href={`/${post.slug}`} className="group rounded-xl border border-white/5 bg-white/[0.03] p-4 transition hover:border-orange-500/20 hover:bg-white/[0.06]">
                <div className="flex items-start gap-3 mb-2">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-bold font-mono ${
                    post.post_type === 'best_of' ? 'bg-emerald-500/10 text-emerald-400' :
                    post.post_type === 'worst_of' ? 'bg-red-500/10 text-red-400' :
                    post.post_type === 'this_vs_that' ? 'bg-purple-500/10 text-purple-400' :
                    post.post_type === 'fact_drop' ? 'bg-pink-500/10 text-pink-400' :
                    'bg-orange-500/10 text-orange-400'
                  }`}>
                    {POST_TYPE_LABELS[post.post_type] || post.post_type.replace(/_/g, ' ')}
                  </span>
                  {profile.is_own_profile && post.status !== 'approved' && (
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-semibold ${
                      post.revision_guidance ? 'bg-orange-500/10 text-orange-400' :
                      post.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {post.revision_guidance ? 'Revision' : post.status.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 leading-snug group-hover:text-white transition mb-2 line-clamp-2">{post.title}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-3xs text-zinc-600">
                  <span className="inline-flex items-center gap-1"><Icon name="MessageCircle" size={11} /> {post.comment_count}</span>
                  <span className="inline-flex items-center gap-1"><Icon name="Eye" size={11} /> {post.view_count ?? 0}</span>
                  <span suppressHydrationWarning>{formatDate(post.created_at)}</span>
                </div>
                {profile.is_own_profile && post.rejection_reason && (
                  <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-2xs text-red-400"><strong>Reason:</strong> {post.rejection_reason}</div>
                )}
                {profile.is_own_profile && post.revision_guidance && (
                  <div className="mt-2 rounded-lg border border-orange-500/20 bg-orange-500/5 p-2 text-2xs text-orange-400"><strong>Feedback:</strong> {post.revision_guidance}</div>
                )}
              </Link>
            ))
          )}
        </div>
      )}

      {/* ─── Comments Tab ─── */}
      {activeTab === 'comments' && (
        <div className="space-y-3">
          {profile.comments.length === 0 ? (
            <div className="py-16 text-center">
              <Icon name="MessageCircle" size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No comments yet.</p>
            </div>
          ) : (
            profile.comments.map(c => (
              <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <p className="mb-2 text-sm leading-relaxed text-zinc-300 line-clamp-3">{c.content}</p>
                <div className="flex items-center gap-3 text-3xs text-zinc-600">
                  <span className="inline-flex items-center gap-1"><Icon name="Flame" size={11} color="#ea580c" /> {c.fire_count}</span>
                  <span className="inline-flex items-center gap-1"><Icon name="MessageCircle" size={11} /> {c.reply_count}</span>
                  <span suppressHydrationWarning>{formatDate(c.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Stats Tab (own only) ─── */}
      {activeTab === 'stats' && profile.is_own_profile && rateLimitStatus && (
        <div className="space-y-3">
          {/* Engagement overview */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Engagement</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-lg font-bold font-mono text-white">{profile.stats.total_views ?? 0}</p>
                <p className="text-2xs text-zinc-500">Total Views</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-lg font-bold font-mono text-white">{profile.stats.total_posts}</p>
                <p className="text-2xs text-zinc-500">Posts</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-lg font-bold font-mono text-white">{profile.stats.total_comments}</p>
                <p className="text-2xs text-zinc-500">Comments</p>
              </div>
            </div>
          </div>

          {/* Approval rate */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Approval Rate</h3>
            <div className="flex h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="bg-green-500 transition-all" style={{ width: `${profile.stats.approval_rate}%` }} />
              <div className="bg-red-500/50 transition-all" style={{ width: `${100 - profile.stats.approval_rate}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-2xs text-zinc-600">
              <span>{profile.stats.approval_rate}% approved</span>
              <span>{100 - profile.stats.approval_rate}% rejected</span>
            </div>
          </div>

          {/* Trust score */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Trust Score</h3>
              <span className={`text-sm font-bold font-mono ${tier.color}`}>{trustScore.toFixed(2)}</span>
            </div>
            <div className="flex h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className={`transition-all duration-500 ${tier.bar}`} style={{ width: `${trustPct}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-3xs text-zinc-700">
              <span>0</span>
              <span>3 Neutral</span>
              <span>6 Scholar</span>
              <span>10</span>
            </div>
          </div>

          {/* Rate limits */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Current Limits</h3>
            <div className="space-y-2">
              {(['posts', 'comments', 'counter_lists'] as const).map(key => {
                const limit = rateLimitStatus.limits[key];
                if (!limit || typeof limit.remaining === 'undefined') return null;
                const pct = limit.total !== 'Unlimited' ? Math.round((limit.remaining as number) / (limit.total as number) * 100) : 100;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="capitalize text-zinc-400">{key.replace('_', ' ')}</span>
                      <span className="font-mono text-zinc-500">{limit.remaining} / {limit.total}</span>
                    </div>
                    {typeof limit.total === 'number' && (
                      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-2xs text-zinc-600">
              <Icon name="RefreshCw" size={11} /> Resets in: {rateLimitCountdown !== null ? `${Math.floor(rateLimitCountdown / 60)}m ${rateLimitCountdown % 60}s` : '...'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Secure My Authority ─── */}
      {profile.is_own_profile && <div className="mt-8"><SecureMyAuthority /></div>}
    </div>
  );
}
